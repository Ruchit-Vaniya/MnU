import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RestaurantMember, RestaurantMemberSchema } from '../restaurant-members/schemas/restaurant-member.schema';
import { Restaurant, RestaurantSchema } from '../restaurants/schemas/restaurant.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Category, CategorySchema } from '../menu/schemas/category.schema';
import { MenuItem, MenuItemSchema } from '../menu/schemas/menu-item.schema';
import { Table, TableSchema } from '../tables/schemas/table.schema';
import { TableSession, TableSessionSchema } from '../table-sessions/schemas/table-session.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Customer, CustomerSchema } from '../customers/schemas/customer.schema';
import { OtpChallenge, OtpChallengeSchema } from '../customers/schemas/otp-challenge.schema';
import { GroupOrder, GroupOrderSchema } from '../group-orders/schemas/group-order.schema';

// Global so any future feature module can inject the User/Restaurant/
// RestaurantMember/Category/MenuItem/Table/TableSession/Order/Customer/
// OtpChallenge models without re-importing this module everywhere — the
// same role PrismaModule played, just for Mongoose instead of Prisma.
@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('DATABASE_URL'),
      }),
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: RestaurantMember.name, schema: RestaurantMemberSchema },
      { name: Category.name, schema: CategorySchema },
      { name: MenuItem.name, schema: MenuItemSchema },
      { name: Table.name, schema: TableSchema },
      { name: TableSession.name, schema: TableSessionSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: OtpChallenge.name, schema: OtpChallengeSchema },
      { name: GroupOrder.name, schema: GroupOrderSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
