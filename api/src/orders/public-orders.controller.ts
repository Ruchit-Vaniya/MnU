import { Body, Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CustomerAuthGuard } from '../customers/customer-auth.guard';
import { CurrentCustomerId } from '../customers/current-customer.decorator';

// Deliberately NOT behind JwtAuthGuard (that's the *restaurant staff*
// guard) — placing an order is something a diner's own browser does,
// with no restaurant-staff account. Browsing the menu (see
// PublicMenuController) stays fully anonymous, per the task's explicit
// "don't force login right after the QR scan." Only `create` below is
// behind CustomerAuthGuard — a *customer* session, distinct from staff
// auth — because this task requires authentication between Cart and
// Order so the order can be associated with a customerId (Part 7).
@Controller('public/restaurants/:restaurantId/orders')
export class PublicOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(CustomerAuthGuard)
  @Post()
  create(
    @Param('restaurantId') restaurantId: string,
    @Body() body: { tableId: string; items: { itemId: string; quantity: number }[] },
    @CurrentCustomerId() customerId: string,
  ) {
    return this.ordersService.createOrder(restaurantId, body?.tableId, body?.items, customerId);
  }

  // Day 14 — backs the customer Home page's "Popular" section with real
  // order history instead of a fabricated field. See
  // OrdersService.getPopularItems() for exactly what "popular" means
  // here and why it can legitimately return an empty array.
  @Get('popular')
  getPopular(@Param('restaurantId') restaurantId: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    return this.ordersService.getPopularItems(
      restaurantId,
      parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined,
    );
  }
}
