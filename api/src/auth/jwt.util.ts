import * as jwt from 'jsonwebtoken';

// Payload is deliberately just the user id — role and restaurant are
// contextual per request (a user can belong to multiple restaurants with
// different roles), so baking one into the token would misrepresent that.
export interface TokenPayload {
  user_id: string;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set in .env');
  }
  return secret;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getSecret()) as TokenPayload;
}

// ---- Customer sessions (Part 5) ----
//
// Same JWT mechanism/secret as staff tokens above — reusing the existing
// authentication architecture rather than building a second one, per the
// task's own instruction. The payload shape is deliberately different
// (`customer_id` + a `type: 'customer'` discriminator) so a customer
// token is structurally distinguishable from a staff token: verifying a
// staff token as a customer token (or vice versa) fails the shape check
// in CustomerAuthGuard/JwtAuthGuard, not just a coincidental id mixup.
export interface CustomerTokenPayload {
  customer_id: string;
  type: 'customer';
}

export function signCustomerToken(customerId: string): string {
  const payload: CustomerTokenPayload = { customer_id: customerId, type: 'customer' };
  // Longer-lived than a staff session (30d) — a customer shouldn't have
  // to re-verify by OTP every week just to keep ordering from the same
  // phone, and there's no admin-level access at stake here.
  return jwt.sign(payload, getSecret(), { expiresIn: '30d' });
}

export function verifyCustomerToken(token: string): CustomerTokenPayload {
  const decoded = jwt.verify(token, getSecret()) as Partial<CustomerTokenPayload>;
  if (decoded.type !== 'customer' || typeof decoded.customer_id !== 'string') {
    throw new Error('Not a customer token.');
  }
  return decoded as CustomerTokenPayload;
}
