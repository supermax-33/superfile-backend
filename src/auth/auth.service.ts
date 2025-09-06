import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: CreateUserDto): Promise<{ message: string }> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) throw new ConflictException('Email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    // Generate a 6-digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10); // 10 min expiry

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        emailVerified: false,
      },
    });

    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        verificationToken: code,
        expiresAt,
      },
    });
    await this.mailService.sendVerificationEmail(dto.email, code);
    return { message: 'Signup successful, verification code sent.' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    if (!dto || !dto.code) {
      throw new BadRequestException('Code is required');
    }

    // Find the code that matches and is not used
    const verificationToken = await this.prisma.verificationToken.findFirst({
      where: {
        verificationToken: dto.code,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid, expired, or already used code');
    }

    // Mark user's email as verified
    await this.prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    });

    // Mark code as used
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

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Email not verified');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '1d',
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '10d',
    });

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
      },
    });

    return { accessToken, refreshToken };
  }

  async refreshToken(dto: RefreshTokenDto) {
    if (!dto.refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    // decode the refresh token and extract the user info
    const decoded = (await this.jwtService.verifyAsync(dto.refreshToken)) as {
      sub: string;
      email: string;
    };

    if (!decoded) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // check the validity of the token
    let refreshToken = null;

    // find all refresh tokens for this user
    const allRefreshTokens = await this.prisma.refreshToken.findMany({
      where: { userId: decoded.sub },
    });

    // loop to find valid token
    for (const token of allRefreshTokens) {
      const isValid = dto.refreshToken === token.refreshToken;
      if (isValid) {
        refreshToken = token;
        break;
      }
    }

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // check if revoked
    if (refreshToken.revokedAt !== null) {
      throw new UnauthorizedException(
        'Refresh token re-used. Security breach detected.',
      );
    }

    // check if expired
    if (refreshToken.expiresAt < new Date()) {
      // revoke expired token
      await this.prisma.refreshToken.update({
        where: { id: refreshToken.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: refreshToken.id },
      data: { revokedAt: new Date() },
    });

    // If we reach here, the refresh token is valid
    const payload = {
      sub: decoded.sub,
      email: decoded.email,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '1d',
    });

    // Generate new refresh token with 10 days expiry (token rotation)
    const newRefreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '10d',
    });

    // Create a new refresh token in the database
    const newRefreshTokenRecord = await this.prisma.refreshToken.create({
      data: {
        userId: decoded.sub,
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
      },
    });

    // Mark the old token as revoked and replaced
    await this.prisma.refreshToken.update({
      where: { id: refreshToken.id },
      data: {
        revokedAt: new Date(),
        replacedById: newRefreshTokenRecord.id,
      },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    try {
      // Find the user
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(
        dto.currentPassword,
        user.passwordHash,
      );
      if (!isPasswordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      // Check if new password is same as current
      if (dto.currentPassword === dto.newPassword) {
        throw new BadRequestException(
          'New password must be different from current password',
        );
      }

      // Hash the new password
      const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

      // Update the user's password
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

      // Invalidate all refresh tokens for this user
      await this.prisma.refreshToken.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      return { message: 'Password updated successfully. Please log in again.' };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to update password');
    }
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    // Look up user by email (don't reveal if the user exists)
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // If no user found, still return success (to not reveal existence)
    if (!user) {
      return {
        message:
          'If your email is registered, you will receive a password reset code.',
      };
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10); // 10 min expiry

    // Store the code in the database
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        resetToken: code,
        expiresAt,
      },
    });

    // Send the email with the code
    await this.mailService.sendPasswordResetEmail(user.email, code);

    return {
      message:
        'If your email is registered, you will receive a password reset code.',
    };
  }

  async verifyResetCode(
    code: string,
  ): Promise<{ valid: boolean; message: string; accessToken?: string }> {
    // Find all valid (not used, not expired) codes
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        resetToken: code,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!resetToken) {
      return { valid: false, message: 'Invalid or expired code' };
    }

    // create new access token valid for 15 minutes
    const payload = { sub: resetToken.userId, email: resetToken.user.email };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    });

    // update the code as used
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
    try {
      if (!dto || !dto.token) {
        throw new BadRequestException('Access Token is required');
      }

      // decode the access token and extract user info
      const user = (await this.jwtService.verifyAsync(dto.token)) as {
        sub: string;
        email: string;
      };

      if (!user) {
        throw new UnauthorizedException('Invalid access token');
      }

      const userId = user.sub;

      // Hash the new password
      const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

      // Update user's password
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

      // Invalidate all refresh tokens for this user (force re-login)
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      return { message: 'Password reset successful. Please log in again.' };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to reset password');
    }
  }
}
