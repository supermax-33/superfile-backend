import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

@Catch(JsonWebTokenError, TokenExpiredError, UnauthorizedException)
export class JwtExceptionFilter implements ExceptionFilter {
  catch(
    exception: JsonWebTokenError | TokenExpiredError | UnauthorizedException,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = HttpStatus.UNAUTHORIZED;
    let message = 'Unauthorized';

    if (exception instanceof TokenExpiredError) {
      message = 'Access token has expired';
    } else if (exception instanceof JsonWebTokenError) {
      message = 'Invalid JWT token';
    } else if (exception instanceof UnauthorizedException) {
      message = exception.message || 'Unauthorized';
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
