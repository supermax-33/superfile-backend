import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseFilters,
  UseGuards,
  Version,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
import {
  AuthTokensResponseDto,
  VerifyResetCodeResponseDto,
} from './dto/auth-responses.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Version('1')
  @Post('signup')
  @ApiOperation({
    summary:
      'Register a new user with email/password credentials and send an OTP for verification.',
  })
  @ApiResponse({
    status: 201,
    description: 'Signup succeeded and a verification OTP has been emailed.',
  })
  @ApiResponse({ status: 400, description: 'Invalid signup payload.' })
  @ApiResponse({ status: 401, description: 'Unauthorized signup attempt.' })
  @ApiResponse({ status: 403, description: 'Signup forbidden for this email.' })
  @ApiResponse({
    status: 409,
    description: 'Email already registered with this or another provider.',
  })
  async signup(@Body() createUserDto: CreateUserDto) {
    await this.authService.signup(createUserDto);
    return { message: 'Signup successful. Please verify your email.' };
  }

  @Version('1')
  @Post('verify-email')
  @ApiOperation({
    summary: 'Verify the email OTP to activate the newly created account.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully; account is now active.',
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP code.' })
  @ApiResponse({ status: 401, description: 'Unauthorized request.' })
  @ApiResponse({
    status: 403,
    description: 'Verification forbidden for this user.',
  })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Version('1')
  @Post('login')
  @ApiOperation({
    summary:
      'Authenticate with email/password and retrieve access & refresh tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful; JWT tokens returned in the response body.',
    type: AuthTokensResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid login payload.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 403, description: 'Email not yet verified.' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Version('1')
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({
    summary: 'Start the Google OAuth flow. Redirects to Google consent screen.',
  })
  @ApiResponse({
    status: 200,
    description: 'Request accepted; browser will be redirected to Google.',
  })
  @ApiResponse({ status: 400, description: 'Google OAuth misconfiguration.' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized Google OAuth request.',
  })
  @ApiResponse({ status: 403, description: 'Google OAuth access forbidden.' })
  async googleAuth() {
    // Guard redirects the user to Google's consent screen.
    return;
  }

  @Version('1')
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({
    summary:
      'Handle Google OAuth callback and exchange the profile for Superfile JWT tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'Google account linked successfully; JWT tokens issued.',
    type: AuthTokensResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid callback payload.' })
  @ApiResponse({ status: 401, description: 'Google authentication failed.' })
  @ApiResponse({ status: 403, description: 'Google account forbidden.' })
  async googleCallback(@Request() req: { user: Profile }) {
    // req.user is hydrated by the Google strategy and contains the OAuth profile.
    const profile = req.user;
    return this.authService.handleGoogleOAuthLogin({
      id: profile.id,
      email: profile.emails?.[0]?.value,
      displayName: profile.displayName,
      emailVerified: profile.emails?.[0]?.verified,
    });
  }

  @Version('1')
  @Post('google/token')
  @ApiOperation({
    summary:
      'Exchange a Google ID token (from mobile or web SDK) for Superfile JWT tokens.',
  })
  @ApiResponse({
    status: 200,
    description: 'Google ID token verified; JWT tokens issued.',
    type: AuthTokensResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or malformed Google ID token.',
  })
  @ApiResponse({
    status: 401,
    description: 'Google token could not be verified.',
  })
  @ApiResponse({
    status: 403,
    description: 'Account forbidden from Google login.',
  })
  async googleTokenLogin(@Body() dto: GoogleTokenDto) {
    // Mobile clients exchange the Google ID token for our first-party JWTs.
    return this.authService.loginWithGoogleIdToken(dto.idToken);
  }

  @Version('1')
  @Post('refresh-token')
  @ApiOperation({
    summary: 'Refresh the session using a valid refresh token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Refresh token accepted; new JWT tokens returned.',
    type: AuthTokensResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Missing refresh token.' })
  @ApiResponse({
    status: 401,
    description: 'Refresh token invalid or expired.',
  })
  @ApiResponse({ status: 403, description: 'Refresh request forbidden.' })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Version('1')
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @UseFilters(JwtExceptionFilter)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update the password for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password updated and existing refresh tokens revoked.',
  })
  @ApiResponse({ status: 400, description: 'Invalid change password payload.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 403, description: 'Password change forbidden.' })
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.userId, changePasswordDto);
  }

  @Version('1')
  @Post('forgot-password')
  @ApiOperation({
    summary: 'Send a password reset OTP to the registered email address.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset OTP dispatched if the email exists.',
  })
  @ApiResponse({ status: 400, description: 'Invalid email supplied.' })
  @ApiResponse({ status: 401, description: 'Unauthorized request.' })
  @ApiResponse({ status: 403, description: 'Password reset not permitted.' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Version('1')
  @Post('verify-reset-code')
  @ApiOperation({
    summary:
      'Verify the password reset OTP and receive a temporary access token when valid.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP validated and temporary access token issued when valid.',
    type: VerifyResetCodeResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid verification payload.' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized verification attempt.',
  })
  @ApiResponse({ status: 403, description: 'Verification forbidden.' })
  async verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto.code);
  }

  @Version('1')
  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset the account password using the temporary access token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully; all refresh tokens revoked.',
  })
  @ApiResponse({ status: 400, description: 'Invalid reset password payload.' })
  @ApiResponse({
    status: 401,
    description: 'Temporary access token invalid or expired.',
  })
  @ApiResponse({ status: 403, description: 'Password reset forbidden.' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
