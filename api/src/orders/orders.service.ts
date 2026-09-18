import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RestaurantMember, RestaurantMemberDocument } from '../restaurant-members/schemas/restaurant-member.schema';
import { Restaurant, RestaurantDocument } from '../restaurants/schemas/restaurant.schema';
import { Table, TableDocument } from '../tables/schemas/table.schema';
import { TableSession, TableSessionDocument, TableSessionStatus } from '../table-sessions/schemas/table-session.schema';
import { MenuItem, MenuItemDocument } from '../menu/schemas/menu-item.schema';
import { Customer, CustomerDocument } from '../customers/schemas/customer.schema';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';

// Day 22 (Part 5/6/15) — minimum total quantity ordered before an item
// is allowed to appear in the customer-facing "Most ordered" section.
// Set to 3 deliberately: 1–2 is noise (one party ordering one dish), and
// this is the difference between a real signal and inventing popularity.
// If nothing clears the bar, the section is hidden entirely rather than
// filled with weak data.
const MIN_ORDERS_TO_BE_POPULAR = 3;

// Forward-only lifecycle, plus CANCELLED reachable from anywhere that
// isn't already terminal. COMPLETED/CANCELLED are terminal — no further
// status change is accepted once an order lands there (see
// updateStatus() below).
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.NEW]: [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

interface OrderItemInput {
  itemId: string;
  quantity: number;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Table.name) private readonly tableModel: Model<TableDocument>,
    @InjectModel(Restaurant.name) private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(TableSession.name) private readonly sessionModel: Model<TableSessionDocument>,
    @InjectModel(MenuItem.name) private readonly menuItemModel: Model<MenuItemDocument>,
    @InjectModel(RestaurantMember.name)
    private readonly restaurantMemberModel: Model<RestaurantMemberDocument>,
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
  ) {}

  // ---- Shared validation ----

  private assertValidId(id: string, label: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`${label} not found.`);
    }
  }

  // ---- Public: place an order (no auth — see PublicOrdersController) ----

  // SECURITY: the only things trusted from the client are itemId and
  // quantity. Every price comes from MongoDB, read fresh, right here —
  // never from the request body. See the pricing loop below.
  // `customerId` comes from CustomerAuthGuard (a verified customer
  // session), never from the request body either — see
  // PublicOrdersController.
  async createOrder(restaurantId: string, tableId: string, rawItems: OrderItemInput[], customerId: string) {
    this.assertValidId(restaurantId, 'Restaurant');
    this.assertValidId(tableId, 'Table');
    this.assertValidId(customerId, 'Customer');

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new BadRequestException('Your cart is empty.');
    }

    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }

    // Table must exist AND belong to this restaurant — same combined
    // lookup every other restaurant-scoped read in this project uses.
    const table = await this.tableModel.findOne({ _id: tableId, restaurantId });
    if (!table) {
      throw new NotFoundException('Table not found.');
    }

    // Never trust a client-submitted session token for this — derive
    // the currently-active session for this exact table server-side.
    // This is also what makes "table session is valid/active" a real
    // check rather than a client-asserted claim: no active session, no
    // order, full stop.
    const session = await this.sessionModel.findOne({
      tableId,
      restaurantId,
      status: TableSessionStatus.ACTIVE,
    });
    if (!session) {
      throw new BadRequestException('No active session for this table. Please scan the table QR code again.');
    }

    for (const raw of rawItems) {
      if (typeof raw.itemId !== 'string') {
        throw new BadRequestException('Invalid item in cart.');
      }
      this.assertValidId(raw.itemId, 'Menu item');
      if (!Number.isInteger(raw.quantity) || raw.quantity < 1) {
        throw new BadRequestException('Invalid quantity.');
      }
    }

    // One query for every distinct item, scoped to this restaurant —
    // this single `restaurantId` filter is what prevents a customer
    // from ordering an item that belongs to a different restaurant: an
    // id that's real but scoped elsewhere simply won't come back here,
    // and the count check below catches that.
    const distinctIds = [...new Set(rawItems.map((i) => i.itemId))];
    const menuItems = await this.menuItemModel.find({ _id: { $in: distinctIds }, restaurantId });
    if (menuItems.length !== distinctIds.length) {
      throw new BadRequestException('One or more items are not available from this restaurant.');
    }

    const menuItemsById = new Map(menuItems.map((m) => [m._id.toString(), m]));

    const items = rawItems.map((raw) => {
      const menuItem = menuItemsById.get(raw.itemId)!;
      if (!menuItem.isAvailable) {
        throw new BadRequestException(`"${menuItem.name}" is currently unavailable.`);
      }
      // Price is read from `menuItem` (MongoDB), never from `raw` — the
      // request body has no price field at all, so there's nothing to
      // even accidentally trust here.
      const lineTotal = menuItem.price * raw.quantity;
      return {
        menuItemId: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: raw.quantity,
        lineTotal,
      };
    });

    const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
    // No tax/fees/discounts exist yet (Day 12 scope) — total mirrors
    // subtotal today, but stays a separate stored field (see schema
    // comment) for when that stops being true.
    const total = subtotal;

    // Pre-generating the _id lets orderNumber be derived from it and
    // stored in the same insert, rather than a create-then-update.
    const _id = new Types.ObjectId();
    const orderNumber = `ORD-${_id.toString().slice(-6).toUpperCase()}`;

    const order = await this.orderModel.create({
      _id,
      restaurantId,
      tableId,
      tableNumber: table.tableNumber,
      tableSessionId: session._id,
      orderNumber,
      items,
      subtotal,
      total,
      status: OrderStatus.NEW,
      customerId,
    });

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      subtotal: order.subtotal,
      total: order.total,
      items: order.items.map((i) => ({
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
      })),
      table: { tableNumber: table.tableNumber },
      restaurant: { name: restaurant.name },
      createdAt: order.createdAt,
    };
  }

  // ---- Public: popular items (Day 14 — Customer Home page) ----

  // Real popularity, derived from actual placed orders — never
  // fabricated. This is exactly what the Day 14 task calls for: "use an
  // existing popularity field if available" — none exists as a stored
  // field, but real order history now does (Day 12), which is a better
  // signal than a hand-set field would be anyway. If a restaurant has no
  // orders yet, this returns an empty array and the Home page simply
  // hides the Popular section rather than showing anything invented.
  //
  // Only currently-available items from *this* restaurant are returned
  // — an item that racked up orders in the past but has since been
  // deleted or 86'd is skipped, not shown as "popular" for something a
  // customer can no longer actually order. `orderCount` sums quantity
  // across all of that restaurant's orders, not just number of orders
  // that included it.
  //
  // Day 22 security fix (Part 17): `orderCount` is used for *ranking*
  // here but is deliberately NOT returned. This endpoint is public and
  // unauthenticated — returning it published a restaurant's real sales
  // volume per dish to anyone who scanned (or guessed) a menu URL,
  // which is internal performance data. Customers see the ordering
  // ("Popular", "Most ordered"), never the numbers behind it. The
  // minimum threshold below is applied server-side for the same reason:
  // the client can't be trusted to decide what counts as popular, and
  // shouldn't need the raw counts to do so.
  async getPopularItems(restaurantId: string, limit = 6) {
    this.assertValidId(restaurantId, 'Restaurant');
    const restaurantObjectId = new Types.ObjectId(restaurantId);

    const ranked: { _id: Types.ObjectId; orderCount: number }[] = await this.orderModel.aggregate([
      { $match: { restaurantId: restaurantObjectId } },
      { $unwind: '$items' },
      { $group: { _id: '$items.menuItemId', orderCount: { $sum: '$items.quantity' } } },
      { $sort: { orderCount: -1 } },
      // A generous buffer over `limit` — some ranked items may turn out
      // to be unavailable/deleted by the time we join against the live
      // MenuItem collection below, and get filtered out.
      { $limit: limit * 4 },
    ]);

    if (ranked.length === 0) return [];

    const ids = ranked.map((r) => r._id);
    const menuItems = await this.menuItemModel.find({ _id: { $in: ids }, restaurantId, isAvailable: true });
    const byId = new Map(menuItems.map((m) => [m._id.toString(), m]));

    const result: {
      id: string;
      name: string;
      description: string | null;
      price: number;
      imageUrl: string | null;
    }[] = [];
    for (const r of ranked) {
      // Day 22 (Part 6/15): a dish ordered once or twice isn't
      // "popular", it's just a dish that happens to have been ordered.
      // Showing a Popular section built on a single order would be
      // inventing a signal the data doesn't support, so items below
      // this threshold are dropped — which can legitimately leave the
      // whole section empty for a quiet/new restaurant. That's the
      // intended outcome: the Home page hides the section entirely
      // rather than padding it.
      if (r.orderCount < MIN_ORDERS_TO_BE_POPULAR) continue;
      const item = byId.get(r._id.toString());
      if (!item) continue; // deleted or no longer available — never shown
      result.push({
        id: item._id.toString(),
        name: item.name,
        description: item.description ?? null,
        price: item.price,
        // NOTE: orderCount intentionally omitted — see the security
        // note on this method. It ranks, it isn't published.
        imageUrl: item.imageUrl ?? null,
      });
      if (result.length >= limit) break;
    }
    return result;
  }

  // ---- Admin: list + detail (JwtAuthGuard — see OrdersController) ----

  private async requireMembership(restaurantId: string, userId: string) {
    this.assertValidId(restaurantId, 'Restaurant');
    const membership = await this.restaurantMemberModel.findOne({ restaurantId, userId });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this restaurant.');
    }
    return membership;
  }

  private serializeOrderSummary(order: OrderDocument, customer?: CustomerDocument | null) {
    return {
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      items: order.items.map((i) => ({
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
        // Null on a solo order; on a group order this is who at the
        // table asked for this line, so the kitchen ticket stays
        // actionable even though it's one combined order.
        addedByName: i.addedByName ?? null,
      })),
      // Present only on a group order — the admin UI uses this to badge
      // the row and to group the item list by member.
      groupCode: order.groupCode ?? null,
      subtotal: order.subtotal,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
      // Surfacing the real, already-associated customer (Part 7) — not a
      // new "Customer Memory" feature, just showing the field that now
      // exists on the order itself. `null` when the order predates
      // customer auth or the customer record is somehow missing.
      customer: customer
        ? {
            id: customer._id.toString(),
            customerCode: customer.customerCode,
            mobileNumber: customer.mobileNumber ?? null,
            email: customer.email ?? null,
            name: customer.name ?? null,
          }
        : null,
    };
  }

  // No RBAC role split beyond membership — every restaurant member
  // (admin or staff) can view orders today. Same reasoning now extends
  // to changing status: any member of the restaurant (front-of-house or
  // kitchen) can move an order forward, not just an "admin" role — there
  // is no finer-grained staff role in this project yet to split on.
  async listOrders(restaurantId: string, userId: string) {
    await this.requireMembership(restaurantId, userId);
    const orders = await this.orderModel.find({ restaurantId }).sort({ createdAt: -1 });
    const customerIds = [...new Set(orders.map((o) => o.customerId?.toString()).filter(Boolean))] as string[];
    const customers = customerIds.length ? await this.customerModel.find({ _id: { $in: customerIds } }) : [];
    const customerById = new Map(customers.map((c) => [c._id.toString(), c]));
    return orders.map((o) => this.serializeOrderSummary(o, o.customerId ? customerById.get(o.customerId.toString()) : null));
  }

  async getOrder(restaurantId: string, orderId: string, userId: string) {
    await this.requireMembership(restaurantId, userId);
    this.assertValidId(orderId, 'Order');
    // Scoped by {_id, restaurantId} together — a real order id
    // belonging to a different restaurant 404s exactly like a
    // nonexistent one, same isolation mechanism as every other
    // restaurant-scoped lookup in this project.
    const order = await this.orderModel.findOne({ _id: orderId, restaurantId });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    const customer = order.customerId ? await this.customerModel.findById(order.customerId) : null;
    return this.serializeOrderSummary(order, customer);
  }

  // Part 2: dynamic order status, persisted to MongoDB. `status` is
  // validated against STATUS_TRANSITIONS above — a COMPLETED/CANCELLED
  // order can't be changed further, and a status can't jump somewhere
  // the lifecycle doesn't allow (e.g. NEW straight to COMPLETED).
  async updateStatus(restaurantId: string, orderId: string, userId: string, nextStatus: OrderStatus) {
    await this.requireMembership(restaurantId, userId);
    this.assertValidId(orderId, 'Order');

    if (!Object.values(OrderStatus).includes(nextStatus)) {
      throw new BadRequestException('Invalid order status.');
    }

    const order = await this.orderModel.findOne({ _id: orderId, restaurantId });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (order.status === nextStatus) {
      // No-op update (e.g. double-click) — return as-is rather than
      // erroring, since the end state the caller wanted is already true.
      const customer = order.customerId ? await this.customerModel.findById(order.customerId) : null;
      return this.serializeOrderSummary(order, customer);
    }

    const allowed = STATUS_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`Cannot move an order from ${order.status} to ${nextStatus}.`);
    }

    order.status = nextStatus;
    await order.save();

    const customer = order.customerId ? await this.customerModel.findById(order.customerId) : null;
    return this.serializeOrderSummary(order, customer);
  }

  // ---- Admin: dashboard analytics (this task) ----
  //
  // Every number here comes straight from MongoDB aggregation over real
  // `Order` documents for this exact restaurant — nothing hard-coded,
  // nothing estimated. Where a metric has more than one reasonable
  // definition, the choice is documented inline rather than left
  // ambiguous:
  //
  // - "Today" is a UTC calendar day (00:00–23:59:59 UTC). This project
  //   has no restaurant-timezone field anywhere (checked
  //   restaurant.schema.ts) to do it any other way; documented here so
  //   it's not mistaken for a bug if a restaurant's local "today" spans
  //   two UTC days near midnight.
  // - CANCELLED orders are excluded from every revenue/AOV number (a
  //   cancelled order was never fulfilled — counting its `total` would
  //   overstate real sales) but Active/Completed counts are obviously
  //   status-based already, so that exclusion is implicit there.
  // - "Average Order Value" is all-time (all non-cancelled orders),
  //   not just today's — only Sales/Orders are explicitly scoped to
  //   "today" in this task's own metric list; an average over a single
  //   day would swing wildly on a low-traffic day, whereas all-time is
  //   the standard definition of AOV.
  // - "Active" = NEW/CONFIRMED/PREPARING/READY (anything not yet
  //   terminal); "Completed" = COMPLETED specifically. Both are current
  //   totals (not day-scoped) — they describe the current state of the
  //   restaurant's order queue/history, not "today's" queue.
  // - Top-selling items are read directly off `Order.items` (the
  //   name/quantity/lineTotal snapshot taken at order time — see
  //   order.schema.ts), not joined back to the live MenuItem collection.
  //   That means a dish that was later renamed, 86'd, or deleted still
  //   correctly shows its historical sales — this is a "what actually
  //   sold" report, not "what's biting right now" (that's
  //   getPopularItems() above, used by the customer Home page, which
  //   deliberately does filter to currently-available items).
  // - The 7-day trend fills in every day in the window with 0 sales/0
  //   orders when there's no data for it, rather than only plotting
  //   days that had activity — a day with zero orders is real
  //   information for a trend chart, not something to silently skip.
  async getDashboardAnalytics(restaurantId: string, userId: string) {
    await this.requireMembership(restaurantId, userId);
    const restaurantObjectId = new Types.ObjectId(restaurantId);
    const notCancelled = { restaurantId: restaurantObjectId, status: { $ne: OrderStatus.CANCELLED } };

    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const trendStart = new Date(startOfToday);
    trendStart.setUTCDate(trendStart.getUTCDate() - 6); // today + 6 prior days = 7 days total

    const [
      [todayAgg],
      [allTimeAgg],
      activeOrders,
      completedOrders,
      topItemsRaw,
      recentOrdersDocs,
      trendRaw,
    ] = await Promise.all([
      this.orderModel.aggregate([
        { $match: { ...notCancelled, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, sales: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      this.orderModel.aggregate([
        { $match: notCancelled },
        { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      this.orderModel.countDocuments({
        restaurantId: restaurantObjectId,
        status: { $in: [OrderStatus.NEW, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY] },
      }),
      this.orderModel.countDocuments({ restaurantId: restaurantObjectId, status: OrderStatus.COMPLETED }),
      this.orderModel.aggregate([
        { $match: notCancelled },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.name',
            quantity: { $sum: '$items.quantity' },
            revenue: { $sum: '$items.lineTotal' },
          },
        },
        { $sort: { quantity: -1 } },
        { $limit: 5 },
      ]),
      this.orderModel.find({ restaurantId: restaurantObjectId }).sort({ createdAt: -1 }).limit(5),
      this.orderModel.aggregate([
        { $match: { ...notCancelled, createdAt: { $gte: trendStart } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            sales: { $sum: '$total' },
            orders: { $sum: 1 },
          },
        },
      ]),
    ]);

    const trendByDay = new Map(trendRaw.map((d: { _id: string; sales: number; orders: number }) => [d._id, d]));
    const trend: { date: string; sales: number; orders: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(trendStart);
      day.setUTCDate(day.getUTCDate() + i);
      const key = day.toISOString().slice(0, 10);
      const found = trendByDay.get(key);
      trend.push({ date: key, sales: found?.sales ?? 0, orders: found?.orders ?? 0 });
    }

    const allTimeRevenue = allTimeAgg?.revenue ?? 0;
    const allTimeCount = allTimeAgg?.count ?? 0;

    return {
      todaySales: todayAgg?.sales ?? 0,
      todayOrders: todayAgg?.count ?? 0,
      averageOrderValue: allTimeCount > 0 ? Math.round((allTimeRevenue / allTimeCount) * 100) / 100 : 0,
      activeOrders,
      completedOrders,
      topItems: topItemsRaw.map((r: { _id: string; quantity: number; revenue: number }) => ({
        name: r._id,
        quantity: r.quantity,
        revenue: r.revenue,
      })),
      recentOrders: recentOrdersDocs.map((o) => this.serializeOrderSummary(o)),
      trend,
      // Surfaced so the frontend can label the window truthfully rather
      // than hard-coding "last 7 days" text that could drift from what
      // was actually queried.
      trendRangeStart: trendStart.toISOString().slice(0, 10),
      trendRangeEnd: startOfToday.toISOString().slice(0, 10),
    };
  }

  // ---- Part 7/8 foundation: one customer's order history, scoped to
  // exactly this restaurant. Originally added with no UI consumer
  // ("do not build the full Customer Memory UI yet") — this task is
  // that consumer, so the method is extended (not duplicated) to also
  // return the customer's own profile fields alongside their orders,
  // since the Customer History screen needs both in one request. The
  // orders array shape (`serializeOrderSummary`) is unchanged.
  // Restaurant isolation comes from the same {restaurantId, customerId}
  // filter every other restaurant-scoped query in this service already
  // uses — a customer's orders at a different restaurant are never part
  // of this result set.
  async listCustomerOrdersForRestaurant(restaurantId: string, customerId: string, userId: string) {
    await this.requireMembership(restaurantId, userId);
    this.assertValidId(customerId, 'Customer');
    const orders = await this.orderModel.find({ restaurantId, customerId }).sort({ createdAt: -1 });
    // SECURITY: the customer profile (name/mobile/email) is only looked
    // up — and only ever returned — once we already know this customer
    // has at least one order *at this restaurant*. Looking them up by
    // customerId alone first (Customer is a global collection, not
    // restaurant-scoped — see customer.schema.ts) would let this
    // restaurant's admin read another restaurant's customer's PII simply
    // by guessing/enumerating a valid customerId, even with zero shared
    // order history to show for it. Same "same-shape-as-404" isolation
    // principle used everywhere else in this project: a customer who
    // has never ordered here looks identical to one that doesn't exist.
    const customer = orders.length > 0 ? await this.customerModel.findById(customerId) : null;
    return {
      customer: customer
        ? {
            id: customer._id.toString(),
            customerCode: customer.customerCode,
            name: customer.name ?? null,
            mobileNumber: customer.mobileNumber ?? null,
            email: customer.email ?? null,
          }
        : null,
      orders: orders.map((o) => this.serializeOrderSummary(o)),
    };
  }

  // ---- Admin: restaurant-scoped customer list (this task) ----
  //
  // "Customers" isn't its own collection scoped per restaurant (see
  // customer.schema.ts — a Customer is global, the same person can order
  // from many restaurants). So "this restaurant's customers" is derived
  // from Orders, the same way listCustomerOrdersForRestaurant already
  // derives "this customer's orders at this restaurant" — aggregate the
  // distinct customerIds that actually have an Order row for this
  // restaurant, then join Customer for display fields. This is why it's
  // a method on OrdersService rather than a new CustomersService: it's
  // fundamentally an Orders query, not a Customers query, and putting it
  // here reuses requireMembership/customerModel that already live in
  // this class instead of adding a cross-module dependency for one
  // method.
  //
  // Deliberately does NOT fetch every Customer document and filter
  // client-side — the $group below only ever sees this restaurant's own
  // Order rows (matched first), so a customer who has never ordered here
  // is never loaded, never transferred, and never visible to this
  // restaurant's admin at all.
  async listCustomersForRestaurant(restaurantId: string, userId: string) {
    await this.requireMembership(restaurantId, userId);
    const restaurantObjectId = new Types.ObjectId(restaurantId);

    const agg = await this.orderModel.aggregate([
      { $match: { restaurantId: restaurantObjectId, customerId: { $ne: null } } },
      {
        $group: {
          _id: '$customerId',
          orderCount: { $sum: 1 },
          totalSpent: { $sum: '$total' },
          lastOrderAt: { $max: '$createdAt' },
        },
      },
      { $sort: { lastOrderAt: -1 } },
    ]);

    const customerIds = agg.map((a: { _id: Types.ObjectId }) => a._id);
    const customers = customerIds.length ? await this.customerModel.find({ _id: { $in: customerIds } }) : [];
    const customerById = new Map(customers.map((c) => [c._id.toString(), c]));

    return agg.map((a: { _id: Types.ObjectId; orderCount: number; totalSpent: number; lastOrderAt: Date }) => {
      const customer = customerById.get(a._id.toString());
      return {
        id: a._id.toString(),
        // A customer row can, in principle, be missing (deleted account,
        // data inconsistency) even though an Order still references it —
        // rather than silently dropping that customer from the list (an
        // admin's order history would then have no way to look it up at
        // all), it's included with null display fields so the row is
        // still reachable, same "don't hide, degrade gracefully"
        // reasoning used for a missing image or missing description
        // elsewhere in this project.
        customerCode: customer?.customerCode ?? null,
        name: customer?.name ?? null,
        mobileNumber: customer?.mobileNumber ?? null,
        email: customer?.email ?? null,
        orderCount: a.orderCount,
        totalSpent: a.totalSpent,
        lastOrderAt: a.lastOrderAt,
      };
    });
  }
}
