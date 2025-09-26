import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

/**
 * Passport strategy responsible for orchestrating the Google OAuth web flow.
 * The heavy lifting of creating or finding the local user lives in AuthService,
 * keeping this class focused purely on Google specific plumbing.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:3000/auth/google/callback',
    );

    if (!clientID || !clientSecret) {
      // Logging helps operators spot misconfiguration early in non-local envs.
      this.logger.warn(
        'Google OAuth is not fully configured; set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable it.',
      );
    }

    super({
      clientID: clientID ?? '',
      clientSecret: clientSecret ?? '',
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    // We simply bubble the profile up to the request context so the controller
    // can pass it to AuthService where the user provisioning logic lives.
    done(null, profile);
  }
}
