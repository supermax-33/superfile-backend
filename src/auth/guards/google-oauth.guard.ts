import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that delegates the heavy lifting to the Passport Google strategy.
 * Using a guard keeps the controller code declarative and aligns with
 * Nest's expectation for per-route auth configuration.
 */
@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {}
