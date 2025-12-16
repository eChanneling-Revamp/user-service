import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    const header = req.headers['x-csrf-token'] || req.headers['x-csrf-token'.toLowerCase()];
    const cookieToken = req.cookies?.csrf_token;

    if (!cookieToken) {
      throw new ForbiddenException('CSRF token cookie missing');
    }

    if (!header) {
      throw new ForbiddenException('CSRF token header missing');
    }

    if (Array.isArray(header)) {
      if (header[0] !== cookieToken) throw new ForbiddenException('Invalid CSRF token');
    } else {
      if (header !== cookieToken) throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }
}
