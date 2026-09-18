import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { MenuModule } from './menu/menu.module';
import { TablesModule } from './tables/tables.module';
import { TableSessionsModule } from './table-sessions/table-sessions.module';
import { OrdersModule } from './orders/orders.module';
import { CustomersModule } from './customers/customers.module';
import { GroupOrdersModule } from './group-orders/group-orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    MenuModule,
    TablesModule,
    TableSessionsModule,
    OrdersModule,
    CustomersModule,
    GroupOrdersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
