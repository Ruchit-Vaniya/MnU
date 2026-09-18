import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import { OtpChallenge, OtpChallengeSchema } from './schemas/otp-challenge.schema';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAuthGuard } from './customer-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: OtpChallenge.name, schema: OtpChallengeSchema },
    ]),
  ],
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService, CustomerAuthGuard],
  exports: [CustomerAuthGuard],
})
export class CustomersModule {}
