import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import * as ms from 'ms';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

interface OAuthProfile {
  id: string;
  email?: string | null;
  displayName?: string | null;
  emailVerified?: boolean;
}

@Injectable()
export class AuthService {
  private readonly otpLength: number;
  private readonly otpExpiryMs: number;
  private readonly accessTokenTtl: string;
  private readonly refreshTokenTtl: string;
  private readonly accessTokenExpiryMs: number;
  private readonly refreshTokenExpiryMs: number;
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.otpLength = Number(
      this.configService.get('AUTH_EMAIL_OTP_LENGTH') ?? 6,
    );
    this.otpExpiryMs = this.parseDuration(
      this.configService.get('AUTH_EMAIL_OTP_TTL') ?? '10m',
      10 * 60 * 1000,
    );
    this.accessTokenTtl = this.configService.get<string>(
      'JWT_ACCESS_TOKEN_TTL',
      '15m',
    );
    this.refreshTokenTtl = this.configService.get<string>(
      'JWT_REFRESH_TOKEN_TTL',
      '30d',
    );
    this.accessTokenExpiryMs = this.parseDuration(
      this.accessTokenTtl,
      15 * 60 * 1000,
    );
    this.refreshTokenExpiryMs = this.parseDuration(
      this.refreshTokenTtl,
      30 * 24 * 60 * 60 * 1000,
    );

    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(googleClientId);
  }

  private parseDuration(value: string | number, fallback: number): number {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    const parsed = typeof value === 'string' ? ms(value) : undefined;
    return typeof parsed === 'number' ? parsed : fallback;
  }

  private generateOtp(): string {
    const max = 10 ** this.otpLength;
    const code = Math.floor(Math.random() * max)
      .toString()
      .padStart(this.otpLength, '0');
    return code;
  }

  private async sendVerificationOtp(
    userId: string,
    email: string,
  ): Promise<void> {
    const code = this.generateOtp();
    const expiresAt = new Date(Date.now() + this.otpExpiryMs);

    // Invalidate previous unused tokens so only the latest OTP remains valid.
    await this.prisma.verificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.prisma.verificationToken.create({
      data: {
        userId,
        verificationToken: code,
        expiresAt,
      },
    });

    await this.mailService.sendVerificationEmail(email, code);
  }

  private async issueTokens(user: User, replacedTokenId?: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      provider: user.provider,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: this.accessTokenTtl }),
      this.jwtService.signAsync(payload, { expiresIn: this.refreshTokenTtl }),
    ]);

    const refreshTokenRecord = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + this.refreshTokenExpiryMs),
      },
    });

    if (replacedTokenId) {
      await this.prisma.refreshToken.update({
        where: { id: replacedTokenId },
        data: {
          revokedAt: new Date(),
          replacedById: refreshTokenRecord.id,
        },
      });
    }

    return { accessToken, refreshToken };
  }

  async signup(dto: CreateUserDto): Promise<{ message: string }> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      if (existingUser.provider !== AuthProvider.LOCAL) {
        throw new ConflictException(
          'Email already registered with a social provider. Use social login instead.',
        );
      }
      if (existingUser.emailVerified) {
        throw new ConflictException('Email already exists');
      }

      await this.sendVerificationOtp(existingUser.id, existingUser.email);
      return { message: 'Signup successful, verification code sent.' };
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        provider: AuthProvider.LOCAL,
        emailVerified: false,
      },
    });

    await this.sendVerificationOtp(user.id, user.email);
    return { message: 'Signup successful, verification code sent.' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    if (!dto || !dto.code) {
      throw new BadRequestException('Code is required');
    }

    const verificationToken = await this.prisma.verificationToken.findFirst({
      where: {
        verificationToken: dto.code,
        usedAt: null,
        expiresAt: { gt: new Date() },
        user: { provider: AuthProvider.LOCAL },
      },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid, expired, or already used code');
    }

    await this.prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    });

    await this.prisma.verificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    });

    return { message: 'Email verified successfully' };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.provider !== AuthProvider.LOCAL || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Email not verified');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user);
  }

  async refreshToken(dto: RefreshTokenDto) {
    if (!dto.refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    let decoded: { sub: string; email: string };
    try {
      decoded = await this.jwtService.verifyAsync(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { refreshToken: dto.refreshToken },
    });

    if (!storedToken || storedToken.userId !== decoded.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      throw new UnauthorizedException(
        'Refresh token re-used. Security breach detected.',
      );
    }

    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.issueTokens(user, storedToken.id);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.provider !== AuthProvider.LOCAL || !user.passwordHash) {
      throw new BadRequestException(
        'Password updates are only available for email/password accounts.',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password updated successfully. Please log in again.' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.provider !== AuthProvider.LOCAL) {
      return {
        message:
          'If your email is registered, you will receive a password reset code.',
      };
    }

    const code = this.generateOtp();
    const expiresAt = new Date(Date.now() + this.otpExpiryMs);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        resetToken: code,
        expiresAt,
      },
    });

    await this.mailService.sendPasswordResetEmail(user.email, code);

    return {
      message:
        'If your email is registered, you will receive a password reset code.',
    };
  }

  async verifyResetCode(
    code: string,
  ): Promise<{ valid: boolean; message: string; accessToken?: string }> {
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        resetToken: code,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!resetToken || resetToken.user.provider !== AuthProvider.LOCAL) {
      return { valid: false, message: 'Invalid or expired code' };
    }

    const payload = {
      sub: resetToken.userId,
      email: resetToken.user.email,
      provider: resetToken.user.provider,
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    });

    await this.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    return {
      valid: true,
      message: 'User authenticated. Please reset your password.',
      accessToken,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    if (!dto || !dto.token) {
      throw new BadRequestException('Access Token is required');
    }

    let userPayload: { sub: string; email: string; provider: AuthProvider };
    try {
      userPayload = await this.jwtService.verifyAsync(dto.token);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    if (userPayload.provider !== AuthProvider.LOCAL) {
      throw new BadRequestException(
        'Password reset is only available for email/password accounts.',
      );
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userPayload.sub },
      data: { passwordHash: newPasswordHash },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: userPayload.sub, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password reset successful. Please log in again.' };
  }

  async handleGoogleOAuthLogin(profile: OAuthProfile) {
    if (!profile.email) {
      throw new UnauthorizedException(
        'Google account does not expose an email',
      );
    }

    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (user && user.provider !== AuthProvider.GOOGLE) {
      throw new ConflictException(
        'Email already registered with a different authentication method.',
      );
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          provider: AuthProvider.GOOGLE,
          providerId: profile.id,
          displayName: profile.displayName ?? undefined,
          emailVerified: profile.emailVerified ?? true,
        },
      });
    } else if (!user.providerId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          provider: AuthProvider.GOOGLE,
          providerId: profile.id,
          displayName: profile.displayName ?? user.displayName,
          emailVerified: true,
        },
      });
    }

    if (!user.emailVerified) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    return this.issueTokens(user);
  }

  async loginWithGoogleIdToken(idToken: string) {
    const audience = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!audience) {
      throw new BadRequestException(
        'Google OAuth is not configured on the server',
      );
    }

    let ticket;
    try {
      ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience,
      });
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid Google token payload');
    }

    return this.handleGoogleOAuthLogin({
      id: payload.sub,
      email: payload.email,
      displayName: payload.name,
      emailVerified: payload.email_verified,
    });
  }
}
