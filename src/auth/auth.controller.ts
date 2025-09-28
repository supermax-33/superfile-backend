import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseFilters,
  UseGuards,
  Version,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { Profile } from 'passport-google-oauth20';
import { AuthService } from './auth.service';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtExceptionFilter } from './filters/jwt-exception.filter';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { GoogleTokenDto } from './dto/google-token.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private extractSessionMetadata(req: ExpressRequest) {
    const userAgentHeader = req.headers['user-agent'];
    return {
      ipAddress: req.ip,
      userAgent: Array.isArray(userAgentHeader)
        ? userAgentHeader.join(' ')
        : userAgentHeader,
    };
  }

  @Version('1')
  @Post('signup')
  async signup(@Body() createUserDto: CreateUserDto) {
    await this.authService.signup(createUserDto);
    return { message: 'Signup successful. Please verify your email.' };
  }

  @Version('1')
  @Post('verify-email')
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Version('1')
  @Post('login')
  async login(@Req() req: ExpressRequest, @Body() loginDto: LoginDto) {
    return this.authService.login(loginDto, this.extractSessionMetadata(req));
  }

  @Version('1')
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async googleAuth() {
    // Guard redirects the user to Google's consent screen.
    return;
  }

  @Version('1')
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleCallback(@Req() req: ExpressRequest & { user: Profile }) {
    // req.user is hydrated by the Google strategy and contains the OAuth profile.
    const profile = req.user;
    return this.authService.handleGoogleOAuthLogin(
      {
        id: profile.id,
        email: profile.emails?.[0]?.value,
        displayName: profile.displayName,
        emailVerified: profile.emails?.[0]?.verified,
      },
      this.extractSessionMetadata(req),
    );
  }

  @Version('1')
  @Post('google/token')
  async googleTokenLogin(
    @Req() req: ExpressRequest,
    @Body() dto: GoogleTokenDto,
  ) {
    // Mobile clients exchange the Google ID token for first-party JWTs.
    return this.authService.loginWithGoogleIdToken(
      dto.idToken,
      this.extractSessionMetadata(req),
    );
  }

  @Version('1')
  @Post('refresh-token')
  async refreshToken(@Req() req: ExpressRequest, @Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto, this.extractSessionMetadata(req));
  }

  @Version('1')
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @UseFilters(JwtExceptionFilter)
  async changePassword(
    @Req() req: ExpressRequest & { user: { userId: string } },
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.userId, changePasswordDto);
  }

  @Version('1')
  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Version('1')
  @Post('verify-reset-code')
  async verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto.code);
  }

  @Version('1')
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
