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
import { v4 as uuidv4 } from 'uuid';
import { CreateUserDto } from './dto/create-user.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

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
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour expiry

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
        verificationToken: token,
        expiresAt,
      },
    });
    await this.mailService.sendVerificationEmail(dto.email, token);
    return { message: 'Signup successful, verification email sent.' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    if (!dto || !dto.token) {
      throw new BadRequestException('Token is required');
    }

    // Find all tokens for this user that are not used
    const tokens = await this.prisma.verificationToken.findMany({
      where: { usedAt: null },
      include: { user: true },
    });

    // Find the token that matches using bcrypt.compare
    let verificationToken = null;
    for (const tokenObj of tokens) {
      if (dto.token === tokenObj.verificationToken) {
        verificationToken = tokenObj;
        break;
      }
    }

    if (!verificationToken) {
      throw new BadRequestException('Invalid or already used token');
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Token expired');
    }

    // Mark user's email as verified
    await this.prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    });

    // Mark token as used
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
}
