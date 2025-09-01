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
    const hashedToken = await bcrypt.hash(token, 10);
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
        hashedToken,
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
      if (await bcrypt.compare(dto.token, tokenObj.hashedToken)) {
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
        hashedToken: await bcrypt.hash(refreshToken, 10),
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
      },
    });

    return { accessToken, refreshToken };
  }
}
