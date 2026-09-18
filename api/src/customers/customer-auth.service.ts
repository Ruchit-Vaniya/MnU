import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { OtpChallenge, OtpChallengeDocument, OtpChannel } from './schemas/otp-challenge.schema';
import { signCustomerToken } from '../auth/jwt.util';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Deliberately loose — accepts a plain 10-digit number or one with a
// leading country code/plus sign. Format validation only, same spirit
// as AuthService's EMAIL_PATTERN comment.
const MOBILE_PATTERN = /^\+?[0-9]{7,15}$/;

const OTP_TTL_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;

interface RequestOtpInput {
  channel: 'mobile' | 'email';
  value: string;
}

interface VerifyOtpInput {
  requestId: string;
  otp: string;
}

@Injectable()
export class CustomerAuthService {
  constructor(
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(OtpChallenge.name) private readonly otpModel: Model<OtpChallengeDocument>,
  ) {}

  private normalizeDestination(channel: OtpChannel, value: string): string {
    return channel === OtpChannel.EMAIL ? value.trim().toLowerCase() : value.trim();
  }

  // ---- Request an OTP (mobile or email) ----
  async requestOtp(input: RequestOtpInput) {
    const channel = input.channel === 'email' ? OtpChannel.EMAIL : OtpChannel.MOBILE;
    const rawValue = (input.value ?? '').trim();

    if (channel === OtpChannel.EMAIL) {
      if (!EMAIL_PATTERN.test(rawValue)) {
        throw new BadRequestException('Please enter a valid email address.');
      }
    } else if (!MOBILE_PATTERN.test(rawValue)) {
      throw new BadRequestException('Please enter a valid mobile number.');
    }

    const destination = this.normalizeDestination(channel, rawValue);

    // 6-digit numeric OTP — plain Math.random is fine here: this is a
    // short-lived, rate-limited, single-use verification code, not a
    // cryptographic secret with a long shelf life.
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    const challenge = await this.otpModel.create({
      channel,
      destination,
      otpHash,
      expiresAt,
      attempts: 0,
    });

    // KNOWN LIMITATION (see docs/PROGRESS.md): there is no real SMS/email
    // provider wired up in this project yet. Returning the OTP directly
    // in the response is a dev/testing convenience ONLY so the flow is
    // actually usable end-to-end without a third-party integration —
    // this must be removed (or gated behind a non-production flag)
    // before any real launch, at which point this method would instead
    // call an SMS/email provider and NOT return the code to the client.
    return {
      requestId: challenge._id.toString(),
      channel: input.channel,
      destination,
      expiresInSeconds: OTP_TTL_MINUTES * 60,
      devOtp: otp,
    };
  }

  // ---- Verify an OTP, find-or-create the customer, issue a session ----
  async verifyOtp(input: VerifyOtpInput) {
    if (!Types.ObjectId.isValid(input.requestId)) {
      throw new BadRequestException('This verification code has expired. Please request a new one.');
    }

    const challenge = await this.otpModel.findById(input.requestId);
    if (!challenge) {
      throw new BadRequestException('This verification code has expired. Please request a new one.');
    }
    if (challenge.consumedAt) {
      throw new BadRequestException('This code has already been used. Please request a new one.');
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This code has expired. Please request a new one.');
    }
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      throw new BadRequestException('Too many incorrect attempts. Please request a new code.');
    }

    const otp = (input.otp ?? '').trim();
    const matches = await bcrypt.compare(otp, challenge.otpHash);
    if (!matches) {
      challenge.attempts += 1;
      await challenge.save();
      throw new UnauthorizedException('Incorrect code. Please try again.');
    }

    challenge.consumedAt = new Date();
    await challenge.save();

    const filter = challenge.channel === OtpChannel.EMAIL ? { email: challenge.destination } : { mobileNumber: challenge.destination };

    // Find-or-create: this is the whole point of Part 4 — never create a
    // second Customer for a mobile/email that already exists.
    let customer = await this.customerModel.findOne(filter);
    if (!customer) {
      const _id = new Types.ObjectId();
      const customerCode = `CUST-${_id.toString().slice(-6).toUpperCase()}`;
      customer = await this.customerModel.create({
        _id,
        ...(challenge.channel === OtpChannel.EMAIL ? { email: challenge.destination } : { mobileNumber: challenge.destination }),
        customerCode,
      });
    }

    const token = signCustomerToken(customer._id.toString());

    return {
      token,
      customer: this.serializeCustomer(customer),
    };
  }

  async me(customerId: string) {
    if (!Types.ObjectId.isValid(customerId)) {
      throw new UnauthorizedException('Session expired. Please verify again.');
    }
    const customer = await this.customerModel.findById(customerId);
    if (!customer) {
      throw new UnauthorizedException('Session expired. Please verify again.');
    }
    return this.serializeCustomer(customer);
  }

  private serializeCustomer(customer: CustomerDocument) {
    return {
      id: customer._id.toString(),
      customerCode: customer.customerCode,
      mobileNumber: customer.mobileNumber ?? null,
      email: customer.email ?? null,
      name: customer.name ?? null,
    };
  }
}
