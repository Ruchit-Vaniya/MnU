import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// A customer is deliberately NOT scoped to one restaurant — the same
// person can order from many restaurants on the platform, and Part 4
// requires "if the mobile/email already exists, identify the existing
// customer instead of creating a duplicate." Restaurant-level data
// isolation (Part 8) is enforced where *orders* are queried (always
// filtered by both customerId AND restaurantId), not by duplicating a
// customer record per restaurant.
@Schema({ timestamps: true })
export class Customer {
  // Both optional at the schema level (a customer might verify with
  // only a phone, or only an email) but at least one is always present
  // in practice — CustomerAuthService enforces that on write.
  @Prop({ type: String, required: false, unique: true, sparse: true })
  mobileNumber?: string;

  @Prop({ type: String, required: false, unique: true, sparse: true })
  email?: string;

  @Prop({ type: String, required: false })
  name?: string;

  // Short, human-facing identifier — same convention as Order.orderNumber
  // and TableSession.sessionId: nobody should ever have to read out a
  // raw ObjectId. Matches the "CUST_10284" style example in the task.
  @Prop({ type: String, required: true, unique: true })
  customerCode: string;

  createdAt: Date;
  updatedAt: Date;
}

export type CustomerDocument = HydratedDocument<Customer>;
export const CustomerSchema = SchemaFactory.createForClass(Customer);
