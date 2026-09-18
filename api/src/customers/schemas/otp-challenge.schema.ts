import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum OtpChannel {
  MOBILE = 'MOBILE',
  EMAIL = 'EMAIL',
}

// One document per "request OTP" call. Deliberately its own collection
// rather than a field on Customer — a challenge exists before a Customer
// necessarily does (first-time verification), and old/expired challenges
// are just clutter once consumed, not something Customer should carry.
@Schema({ timestamps: true })
export class OtpChallenge {
  @Prop({ type: String, enum: OtpChannel, required: true })
  channel: OtpChannel;

  // The raw mobile number or email being verified — kept as submitted
  // (normalized minimally in the service), so verifyOtp can match it
  // back up without a separate lookup.
  @Prop({ type: String, required: true })
  destination: string;

  // Only the hash is stored, same reasoning as User.passwordHash — even
  // though this is a short-lived 6-digit code, there's no reason to keep
  // it recoverable in plaintext in the database.
  @Prop({ type: String, required: true })
  otpHash: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date, required: false, default: null })
  consumedAt: Date | null;

  // Basic brute-force guard — a challenge is invalidated after too many
  // wrong guesses, not just after expiry.
  @Prop({ type: Number, required: true, default: 0 })
  attempts: number;

  createdAt: Date;
}

export type OtpChallengeDocument = HydratedDocument<OtpChallenge>;
export const OtpChallengeSchema = SchemaFactory.createForClass(OtpChallenge);

// Auto-delete expired/old challenges ~1 day after expiry so this
// collection doesn't grow unbounded — purely housekeeping, not a
// security control (expiry itself is checked in the service).
OtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });
