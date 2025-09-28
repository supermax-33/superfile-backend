import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, Session, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { LoginTicket, OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'crypto';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SessionService } from 'src/sessions/session.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { OAuthProfile, SessionMetadata } from 'types';
import { generateOtp } from 'utils/helpers';
import {
  AUTH_EMAIL_OTP_LENGTH,
  JWT_ACCESS_TOKEN_TTL,
  JWT_REFRESH_TOKEN_TTL,
  OTP_EXPIRY_MS,
  REFRESH_TOKEN_EXPIRY_MS,
} from 'config';

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
  ) {
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(googleClientId);
  }

  private async sendVerificationOtp(
    userId: string,
    email: string,
  ): Promise<void> {
    const code = generateOtp(AUTH_EMAIL_OTP_LENGTH);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    try {
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
    } catch (err) {
      console.error('Error sending verification OTP:', err);
      throw new InternalServerErrorException(
        'Failed to send verification email',
      );
    }
  }

  private async issueTokens(
    user: User,
    options: {
      session?: Session;
      sessionId?: string;
      metadata?: SessionMetadata;
    } = {},
  ) {
    // Each token carries the session id (`sid`) claim so we can validate the
    // refresh flow against a single persisted session entry in the database.
    const sessionId = options.session?.id ?? options.sessionId ?? randomUUID();
    const payload = {
      sub: user.id,
      email: user.email,
      provider: user.provider,
      sid: sessionId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: JWT_ACCESS_TOKEN_TTL }),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        {
          expiresIn: JWT_REFRESH_TOKEN_TTL,
        },
      ),
    ]);

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

    if (options.session) {
      await this.sessionService.rotateSessionToken({
        sessionId: options.session.id,
        refreshToken,
        ipAddress: options.metadata?.ipAddress,
        userAgent: options.metadata?.userAgent,
        expiresAt,
      });
    } else {
      await this.sessionService.createSession({
        id: sessionId,
        userId: user.id,
        refreshToken,
        ipAddress: options.metadata?.ipAddress,
        userAgent: options.metadata?.userAgent,
        expiresAt,
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
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
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
    } catch (err) {
      if (err.code === 'P2002' && err.meta?.target?.includes('email')) {
        throw new ConflictException('Email already exists');
      }
      throw err;
    }
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const verificationToken = await this.prisma.verificationToken.findFirst({
      where: {
        verificationToken: dto.code,
        usedAt: null,
        expiresAt: { gt: new Date() },
        user: { provider: AuthProvider.LOCAL },
      },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid code! Please try again.');
    }

    await this.prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    });

    // Mark the token as used
    await this.prisma.verificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    });

    return { message: 'Email verified successfully' };
  }

  async login(dto: LoginDto, metadata: SessionMetadata = {}) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.provider !== AuthProvider.LOCAL || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Email not verified. Please verify your email.',
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user, { metadata });
  }

  async refreshToken(dto: RefreshTokenDto, metadata: SessionMetadata = {}) {
    let decoded: { sub: string; email: string; sid?: string; type?: string };
    try {
      decoded = await this.jwtService.verifyAsync(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (decoded.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token type');
    }

    if (!decoded.sid) {
      throw new UnauthorizedException(
        'Refresh token missing session identifier',
      );
    }

    const session = await this.sessionService.validateSessionToken({
      sessionId: decoded.sid,
      userId: decoded.sub,
      refreshToken: dto.refreshToken,
    });

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.issueTokens(user, { session, metadata });
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
      throw new UnauthorizedException('Incorrect current password');
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

    await this.sessionService.revokeAllSessionsForUser(user.id);

    return { message: 'Password updated successfully. Please log in again.' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.provider !== AuthProvider.LOCAL) {
      return {
        message:
          'You will receive a password reset code if your email is registered.',
      };
    }

    const code = generateOtp(AUTH_EMAIL_OTP_LENGTH);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

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
        'You will receive a password reset code if your email is registered.',
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

    await this.sessionService.revokeAllSessionsForUser(userPayload.sub);

    return { message: 'Password reset successful. Please log in again.' };
  }

  async handleGoogleOAuthLogin(
    profile: OAuthProfile,
    metadata: SessionMetadata = {},
  ) {
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

    return this.issueTokens(user, { metadata });
  }

  async loginWithGoogleIdToken(
    idToken: string,
    metadata: SessionMetadata = {},
  ) {
    const audience = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!audience) {
      throw new BadRequestException(
        'Google OAuth is not configured on the server',
      );
    }

    let ticket: LoginTicket;
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

    return this.handleGoogleOAuthLogin(
      {
        id: payload.sub,
        email: payload.email,
        displayName: payload.name,
        emailVerified: payload.email_verified,
      },
      metadata,
    );
  }
}
