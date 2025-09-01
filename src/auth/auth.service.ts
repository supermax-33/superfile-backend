import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { MailService } from 'src/mail/mail.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private readonly mailService: MailService,
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
}
