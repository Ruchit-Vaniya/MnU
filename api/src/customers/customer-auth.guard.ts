import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { verifyCustomerToken } from '../auth/jwt.util';

// Deliberately separate from JwtAuthGuard (staff) even though the
// mechanics are identical — verifyCustomerToken already rejects a staff
// token by shape (no `type: 'customer'`), so this guard can never be
// satisfied by an admin/staff Bearer token, and JwtAuthGuard can never
// be satisfied by a customer one.
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { customerId?: string }>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Please verify your mobile number or email to continue.');
    }

    try {
      const { customer_id } = verifyCustomerToken(authorization.slice(7));
      request.customerId = customer_id;
      return true;
    } catch {
      throw new UnauthorizedException('Please verify your mobile number or email to continue.');
    }
  }
}
