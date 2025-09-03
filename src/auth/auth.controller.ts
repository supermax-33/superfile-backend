import {
  Controller,
  Post,
  Body,
  Query,
  Version,
  UseGuards,
  Request,
  UseFilters,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtExceptionFilter } from './filters/jwt-exception.filter';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Version('1')
  @Post('signup')
  async signup(@Body() createUserDto: CreateUserDto) {
    await this.authService.signup(createUserDto);
    return { message: 'Signup successful. Please verify your email.' };
  }

  @Version('1')
  @Post('verify-email')
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail({ token });
  }

  @Version('1')
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Version('1')
  @Post('refresh-token')
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Version('1')
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @UseFilters(JwtExceptionFilter)
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    // The JWT guard will verify the token is valid and not expired
    // If the token is expired, JwtExceptionFilter will handle the error
    return this.authService.changePassword(req.user.userId, changePasswordDto);
  }
}
