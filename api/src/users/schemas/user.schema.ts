import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// A person who can sign in. Not tied to any single restaurant directly —
// that relationship (and the role within it) lives on RestaurantMember,
// since one user may belong to multiple restaurants.
//
// `{ timestamps: true }` gives us `createdAt`/`updatedAt` automatically,
// matching the Prisma model's `@default(now())` / `@updatedAt` fields.
// Mongo/Mongoose provide `_id` (ObjectId) by default, so there's no need
// to declare an `id` field the way schema.prisma did.
// collection: 'User' pins this to the exact collection Prisma used
// (model name, no pluralization/lowercasing) — Mongoose's default would
// have been 'users', a different, disconnected collection from the real
// data. See docs/PROGRESS.md, "Fixed: Mongoose was writing to the wrong
// collections".
@Schema({ timestamps: true, collection: 'User' })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  // Placeholder column — real hashing already applied by AuthService via
  // bcrypt; this schema just stores the resulting hash.
  @Prop({ required: true })
  passwordHash: string;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
