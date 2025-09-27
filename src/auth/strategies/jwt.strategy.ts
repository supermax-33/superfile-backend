import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { SessionService } from 'src/sessions/session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // This ensures expired tokens are rejected
      secretOrKey: configService.get<string>('JWT_SECRET', 'super-secret-key'),
    });
  }

  async validate(payload: any) {
    // Check if token is expired
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < currentTimestamp) {
      throw new UnauthorizedException('Access token has expired');
    }

    if (!payload.sid) {
      throw new UnauthorizedException('Session identifier missing from token');
    }

    await this.sessionService.assertSessionIsActive({
      sessionId: payload.sid,
      userId: payload.sub,
    });

    return {
      userId: payload.sub,
      email: payload.email,
      provider: payload.provider,
      sessionId: payload.sid,
    };
  }
}
