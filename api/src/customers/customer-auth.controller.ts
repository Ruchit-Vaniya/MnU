import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAuthGuard } from './customer-auth.guard';
import { CurrentCustomerId } from './current-customer.decorator';

// No JwtAuthGuard/CustomerAuthGuard on request/verify — a customer has
// no session yet at that point, by definition. Only `me` (used to
// silently recognize a returning customer, Part 5) requires one.
@Controller('public/customer-auth')
export class CustomerAuthController {
  constructor(private readonly customerAuthService: CustomerAuthService) {}

  @Post('otp/request')
  requestOtp(@Body() body: { channel: 'mobile' | 'email'; value: string }) {
    return this.customerAuthService.requestOtp(body);
  }

  @Post('otp/verify')
  verifyOtp(@Body() body: { requestId: string; otp: string }) {
    return this.customerAuthService.verifyOtp(body);
  }

  @UseGuards(CustomerAuthGuard)
  @Get('me')
  me(@CurrentCustomerId() customerId: string) {
    return this.customerAuthService.me(customerId);
  }
}
