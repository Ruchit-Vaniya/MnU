const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface ApiError {
  message: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mnu_token') : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as ApiError).message ?? 'Something went wrong.');
  }

  return data as T;
}

// Separate from request(): a file upload's body is FormData, not JSON —
// setting 'Content-Type': 'application/json' (request()'s default)
// would break the multipart boundary the browser needs to set itself.
// Everything else (auth header, error shape) matches request() exactly.
async function requestFormData<T>(path: string, formData: FormData, method: string): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mnu_token') : null;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    body: formData,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as ApiError).message ?? 'Something went wrong.');
  }

  return data as T;
}

// Menu item `imageUrl` fields store a full Cloudinary HTTPS URL as of
// this task (see menu-item.schema.ts). Older values from before this
// migration (Day 16 and earlier, local-disk `/uploads/...` paths) are
// handled defensively: anything that isn't already absolute still gets
// the API origin prefixed, so a pre-existing value wouldn't render as
// broken — though nothing in this sandbox's unreachable database is
// assumed to actually contain one.
export function resolveImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (/^https?:\/\//.test(imageUrl)) return imageUrl;
  return `${API_URL}${imageUrl}`;
}

// Same shape as request(), but authenticates with the *customer*
// session token (a different key, a different token type server-side —
// see CustomerAuthGuard) instead of the restaurant-staff `mnu_token`.
// Used only by endpoints a diner's own browser calls that now require a
// verified customer identity (currently just placing an order).
async function customerRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mnu_customer_token') : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as ApiError).message ?? 'Something went wrong.');
  }

  return data as T;
}

export interface RegisterPayload {
  restaurant_name: string;
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface Membership {
  restaurant_id: string;
  restaurant_name: string;
  role: 'SUPER_ADMIN' | 'RESTAURANT_ADMIN' | 'RESTAURANT_STAFF';
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    request<{ token: string; user: AuthUser; membership: Membership }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: LoginPayload) =>
    request<{ token: string; user: AuthUser; memberships: Membership[] }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: () => request<{ user: AuthUser; memberships: Membership[] }>('/auth/me'),

  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
};

// ---- Menu (categories + items) ----

export interface MenuItemRecord {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  isAvailable: boolean;
  sortOrder: number;
  // Day 22 — admin-controlled Featured flag.
  isFeatured: boolean;
  imageUrl: string | null;
}

export interface CategoryRecord {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItemRecord[];
}

// Subset returned by the create/update category endpoints — they return
// the raw category row, not the nested { items } shape getMenu() builds.
export interface CategorySummary {
  id: string;
  name: string;
  sortOrder: number;
}

export interface MenuItemInput {
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  isAvailable?: boolean;
  sortOrder?: number;
}

// Shape returned by GET /public/restaurants/:id/menu — a stripped-down,
// customer-facing view (no ids beyond what's needed for React keys, no
// isAvailable/sortOrder/categoryId, unavailable items and empty
// categories already excluded server-side).
export interface PublicMenu {
  restaurantName: string;
  // Day 22 — restaurant branding. Every field nullable; the customer UI
  // falls back to an initial-letter avatar + the MnU default palette, so
  // an unbranded restaurant still renders completely. No admin UI writes
  // these yet (see restaurant.schema.ts).
  branding: {
    logoUrl: string | null;
    primaryColor: string | null;
    accentColor: string | null;
  };
  categories: {
    id: string;
    name: string;
    items: {
      id: string;
      name: string;
      description: string | null;
      price: number;
      // Day 14: real, already-stored data (MenuItem has always had
      // timestamps) — newly exposed here for the customer Home page's
      // "New Arrivals" section. Not present in responses from before
      // this change.
      createdAt: string;
      // Day 22 — same record, same category; drives both the Home
      // Featured section and the in-category highlight.
      isFeatured: boolean;
      imageUrl: string | null;
    }[];
  }[];
}

export const menuApi = {
  getMenu: (restaurantId: string) => request<CategoryRecord[]>(`/restaurants/${restaurantId}/menu`),

  createCategory: (restaurantId: string, data: { name: string; sortOrder?: number }) =>
    request<CategorySummary>(`/restaurants/${restaurantId}/categories`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCategory: (restaurantId: string, categoryId: string, data: { name?: string; sortOrder?: number }) =>
    request<CategorySummary>(`/restaurants/${restaurantId}/categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCategory: (restaurantId: string, categoryId: string) =>
    request<{ success: true }>(`/restaurants/${restaurantId}/categories/${categoryId}`, {
      method: 'DELETE',
    }),

  createMenuItem: (restaurantId: string, data: MenuItemInput) =>
    request<MenuItemRecord>(`/restaurants/${restaurantId}/menu-items`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMenuItem: (restaurantId: string, itemId: string, data: Partial<MenuItemInput>) =>
    request<MenuItemRecord>(`/restaurants/${restaurantId}/menu-items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  setAvailability: (restaurantId: string, itemId: string, isAvailable: boolean) =>
    request<MenuItemRecord>(`/restaurants/${restaurantId}/menu-items/${itemId}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable }),
    }),

  // Day 22 — manager-only (see MenuService.setFeatured).
  setFeatured: (restaurantId: string, itemId: string, isFeatured: boolean) =>
    request<MenuItemRecord>(`/restaurants/${restaurantId}/menu-items/${itemId}/featured`, {
      method: 'PATCH',
      body: JSON.stringify({ isFeatured }),
    }),

  deleteMenuItem: (restaurantId: string, itemId: string) =>
    request<{ success: true }>(`/restaurants/${restaurantId}/menu-items/${itemId}`, {
      method: 'DELETE',
    }),

  // Single image per item (this task's whole scope) — a new upload
  // always replaces whatever was there before (see
  // MenuService.uploadItemImage, which deletes the old file first).
  uploadItemImage: (restaurantId: string, itemId: string, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return requestFormData<MenuItemRecord>(
      `/restaurants/${restaurantId}/menu-items/${itemId}/image`,
      formData,
      'POST',
    );
  },

  removeItemImage: (restaurantId: string, itemId: string) =>
    request<MenuItemRecord>(`/restaurants/${restaurantId}/menu-items/${itemId}/image`, {
      method: 'DELETE',
    }),

  // Public/unauthenticated — what a diner sees after scanning a QR code
  // or opening a restaurant's menu link directly. Day 9.
  getPublicMenu: (restaurantId: string) =>
    request<PublicMenu>(`/public/restaurants/${restaurantId}/menu`),
};

// ---- Tables ----

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'INACTIVE';

export interface TableRecord {
  id: string;
  restaurantId: string;
  tableNumber: string;
  capacity: number;
  status: TableStatus;
}

export interface TableInput {
  tableNumber: string;
  capacity: number;
  status?: TableStatus;
}

export const tablesApi = {
  list: (restaurantId: string) => request<TableRecord[]>(`/restaurants/${restaurantId}/tables`),

  get: (restaurantId: string, tableId: string) =>
    request<TableRecord>(`/restaurants/${restaurantId}/tables/${tableId}`),

  create: (restaurantId: string, data: TableInput) =>
    request<TableRecord>(`/restaurants/${restaurantId}/tables`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (restaurantId: string, tableId: string, data: Partial<TableInput>) =>
    request<TableRecord>(`/restaurants/${restaurantId}/tables/${tableId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (restaurantId: string, tableId: string) =>
    request<{ success: true }>(`/restaurants/${restaurantId}/tables/${tableId}`, {
      method: 'DELETE',
    }),
};

// ---- Table sessions (public, customer-facing — no auth) ----

export type TableSessionStatus = 'ACTIVE' | 'ENDED';

export interface TableSessionRecord {
  sessionId: string;
  restaurantId: string;
  tableId: string;
  status: TableSessionStatus;
  startedAt: string;
  endedAt: string | null;
}

export interface TableSessionResponse {
  session: TableSessionRecord;
  table: {
    id: string;
    tableNumber: string;
    capacity: number;
  };
  restaurant: {
    id: string;
    name: string;
  };
}

export const tableSessionApi = {
  // Idempotent — safe to call on every page load, including refreshes.
  start: (restaurantId: string, tableId: string) =>
    request<TableSessionResponse>(`/public/restaurants/${restaurantId}/tables/${tableId}/session`, {
      method: 'POST',
    }),

  getActive: (restaurantId: string, tableId: string) =>
    request<TableSessionResponse>(`/public/restaurants/${restaurantId}/tables/${tableId}/session`),

  end: (restaurantId: string, tableId: string) =>
    request<TableSessionRecord>(`/public/restaurants/${restaurantId}/tables/${tableId}/session/end`, {
      method: 'PATCH',
    }),
};

// ---- Orders ----

// Full lifecycle now backed by MongoDB (this task) — never hard-coded on
// the frontend. See order.schema.ts's OrderStatus enum, which this
// mirrors exactly.
export type OrderStatus = 'NEW' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['NEW', 'CONFIRMED', 'PREPARING', 'READY'];

// Mirrors OrdersService's STATUS_TRANSITIONS exactly — used only to
// decide which "next status" buttons to show; the backend re-validates
// every transition regardless, so this is a UX nicety, not the actual
// rule enforcement.
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['CONFIRMED', 'PREPARING', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export interface OrderLineRecord {
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
  // Who at the table added this line — null on solo orders.
  addedByName?: string | null;
}

// Request body for placing an order — deliberately just itemId +
// quantity. There is no price field at all: the backend prices every
// line from MongoDB itself, so there's nothing here for it to
// (accidentally or otherwise) trust from the client.
export interface OrderItemInput {
  itemId: string;
  quantity: number;
}

// Response from the public create-order endpoint.
export interface OrderConfirmation {
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  total: number;
  items: OrderLineRecord[];
  table: { tableNumber: string };
  restaurant: { name: string };
  createdAt: string;
}

// Shape used by both the admin list and detail views.
export interface AdminOrderRecord {
  id: string;
  orderNumber: string;
  tableNumber: string;
  items: OrderLineRecord[];
  subtotal: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  // Part 7/8 foundation: the customer this order is associated with, if
  // any (orders placed before customer auth existed have none). No
  // dedicated history UI consumes this yet — see docs/PROGRESS.md — this
  // is just the real field the order now carries.
  customer: { id: string; customerCode: string; mobileNumber: string | null; email: string | null; name: string | null } | null;
  // Present only when this order came from a group lobby. A group
  // produces exactly ONE order, so this badges the row rather than
  // implying there are sibling orders to find.
  groupCode: string | null;
}

// Day 14 — Customer Home page's "Popular" section. Real order history
// (Day 12), never a fabricated field — see OrdersService.getPopularItems().
export interface PopularItemRecord {
  id: string;
  name: string;
  description: string | null;
  price: number;
  // Day 22: `orderCount` was REMOVED from this public payload — it
  // published real per-dish sales volume to an unauthenticated
  // endpoint. Ranking still happens server-side; the number itself is
  // internal. See OrdersService.getPopularItems().
  imageUrl: string | null;
}

export const ordersApi = {
  // Requires a verified customer session (Part 3) — uses customerRequest,
  // not request(), so this sends the customer's Bearer token, not any
  // restaurant-staff token that might also be present in this browser.
  create: (restaurantId: string, tableId: string, items: OrderItemInput[]) =>
    customerRequest<OrderConfirmation>(`/public/restaurants/${restaurantId}/orders`, {
      method: 'POST',
      body: JSON.stringify({ tableId, items }),
    }),

  // Public — no auth. Returns [] for a restaurant with no order history
  // yet; the Home page hides the section entirely in that case rather
  // than showing an empty box.
  getPopular: (restaurantId: string, limit?: number) =>
    request<PopularItemRecord[]>(
      `/public/restaurants/${restaurantId}/orders/popular${limit ? `?limit=${limit}` : ''}`,
    ),

  // Authenticated — restaurant admin/staff only, restaurant-scoped.
  list: (restaurantId: string) => request<AdminOrderRecord[]>(`/restaurants/${restaurantId}/orders`),

  get: (restaurantId: string, orderId: string) =>
    request<AdminOrderRecord>(`/restaurants/${restaurantId}/orders/${orderId}`),

  // Part 2 — persists to MongoDB; the returned record reflects the new
  // status immediately, and it survives refresh/logout-login because
  // list()/get() always read it back from the database, never a
  // client-side default.
  updateStatus: (restaurantId: string, orderId: string, status: OrderStatus) =>
    request<AdminOrderRecord>(`/restaurants/${restaurantId}/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

// This task — restaurant admin dashboard analytics, all computed from
// real Order documents server-side (see OrdersService.getDashboardAnalytics
// for exactly what each field means and why, especially the "today is
// UTC" and "AOV is all-time" notes).
export interface DashboardTopItem {
  name: string;
  quantity: number;
  revenue: number;
}

export interface DashboardTrendPoint {
  date: string; // YYYY-MM-DD (UTC)
  sales: number;
  orders: number;
}

export interface DashboardAnalytics {
  todaySales: number;
  todayOrders: number;
  averageOrderValue: number;
  activeOrders: number;
  completedOrders: number;
  topItems: DashboardTopItem[];
  recentOrders: AdminOrderRecord[];
  trend: DashboardTrendPoint[];
  trendRangeStart: string;
  trendRangeEnd: string;
}

export const analyticsApi = {
  getDashboard: (restaurantId: string) =>
    request<DashboardAnalytics>(`/restaurants/${restaurantId}/analytics/dashboard`),
};

// ---- Admin: restaurant-scoped customer list + history (this task) ----
//
// Deliberately separate from `customerAuthApi` below — that's the
// *customer's own* passwordless session (Part 3/4/5), this is the
// *restaurant staff's* read-only view of customers who have ordered at
// their restaurant. Different token (`request()`, the staff Bearer
// token — same as every other `restaurants/:id/...` call in this file),
// different backend module (OrdersService, not CustomerAuthService).
export interface RestaurantCustomerRecord {
  id: string;
  customerCode: string | null;
  name: string | null;
  mobileNumber: string | null;
  email: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
}

export interface CustomerHistoryResponse {
  customer: CustomerProfile | null;
  orders: AdminOrderRecord[];
}

export const customersApi = {
  // Restaurant-scoped: only customers with at least one order at this
  // restaurant, computed server-side (never "fetch everyone, filter
  // here") — see OrdersService.listCustomersForRestaurant.
  list: (restaurantId: string) => request<RestaurantCustomerRecord[]>(`/restaurants/${restaurantId}/customers`),

  // Reuses the same order-summary shape the Orders screens already use
  // (`AdminOrderRecord`), plus the customer's own profile fields for the
  // page header — see OrdersService.listCustomerOrdersForRestaurant.
  getHistory: (restaurantId: string, customerId: string) =>
    request<CustomerHistoryResponse>(`/restaurants/${restaurantId}/customers/${customerId}/orders`),
};

// ---- Customer authentication (Part 3/4/5) ----
//
// Deliberately a separate token/key (`mnu_customer_token`) from the
// restaurant-staff session (`mnu_token`) — see auth/jwt.util.ts's
// CustomerTokenPayload comment for why these are structurally distinct,
// not just stored under different keys. A customer's identity is global
// (not scoped per-restaurant): the same phone/email is recognized across
// any restaurant's QR menu, which is what lets Part 5's "don't ask them
// to register again" actually work when they scan a different table.

export interface CustomerProfile {
  id: string;
  customerCode: string;
  mobileNumber: string | null;
  email: string | null;
  name: string | null;
}

export interface OtpRequestResponse {
  requestId: string;
  channel: 'mobile' | 'email';
  destination: string;
  expiresInSeconds: number;
  // KNOWN LIMITATION — see docs/PROGRESS.md: no real SMS/email provider
  // is wired up in this project, so the backend returns the code here
  // purely so this flow is testable end-to-end. The UI surfaces this
  // clearly as a "dev mode" note rather than pretending it was texted.
  devOtp: string;
}

export const customerAuthApi = {
  requestOtp: (channel: 'mobile' | 'email', value: string) =>
    request<OtpRequestResponse>('/public/customer-auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ channel, value }),
    }),

  verifyOtp: (requestId: string, otp: string) =>
    request<{ token: string; customer: CustomerProfile }>('/public/customer-auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ requestId, otp }),
    }),

  me: () => customerRequest<CustomerProfile>('/public/customer-auth/me'),
};

// ---- Group ordering (Day 20 foundation) ----
//
// All of these use customerRequest (the *customer* session token), not
// request() — every group route is behind CustomerAuthGuard server-side.
export interface GroupMemberItemRecord {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface GroupMemberRecord {
  customerId: string;
  displayName: string | null;
  joinedAt: string;
  // Server-computed (compares against the verified token's customer id)
  // rather than the client comparing ids itself — the lobby's "this is
  // you" marker should come from the same source of truth as the auth.
  isYou: boolean;
  items: GroupMemberItemRecord[];
  memberTotal: number;
}

export interface GroupPlacedOrder {
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  total: number;
  items: { name: string; price: number; quantity: number; lineTotal: number; addedByName: string | null }[];
  table: { tableNumber: string };
  groupCode: string;
  memberCount: number;
  createdAt: string;
}

export interface GroupOrderRecord {
  groupCode: string;
  status: 'OPEN' | 'ORDERED' | 'CLOSED';
  // Set once the group's single combined order has been placed.
  placedOrderNumber: string | null;
  restaurantId: string;
  tableId: string;
  tableNumber: string;
  createdByCustomerId: string;
  isCreator: boolean;
  members: GroupMemberRecord[];
  groupTotal: number;
  createdAt: string;
}

export const groupOrdersApi = {
  create: (restaurantId: string, tableId: string) =>
    customerRequest<GroupOrderRecord>(`/public/restaurants/${restaurantId}/group-orders`, {
      method: 'POST',
      body: JSON.stringify({ tableId }),
    }),

  join: (restaurantId: string, groupCode: string) =>
    customerRequest<GroupOrderRecord>(`/public/restaurants/${restaurantId}/group-orders/join`, {
      method: 'POST',
      body: JSON.stringify({ groupCode }),
    }),

  get: (restaurantId: string, groupCode: string) =>
    customerRequest<GroupOrderRecord>(
      `/public/restaurants/${restaurantId}/group-orders/${encodeURIComponent(groupCode)}`,
    ),

  // Places the group's ONE combined order. Safe to call from any member;
  // repeat calls return the same order rather than creating a duplicate.
  placeOrder: (restaurantId: string, groupCode: string) =>
    customerRequest<GroupPlacedOrder>(
      `/public/restaurants/${restaurantId}/group-orders/${encodeURIComponent(groupCode)}/place-order`,
      { method: 'POST' },
    ),

  // Pushes the caller's own localStorage cart into their slot in the
  // group. Replaces, never merges — see GroupOrdersService.syncMyItems.
  syncMyItems: (restaurantId: string, groupCode: string, items: OrderItemInput[]) =>
    customerRequest<GroupOrderRecord>(
      `/public/restaurants/${restaurantId}/group-orders/${encodeURIComponent(groupCode)}/my-items`,
      { method: 'PUT', body: JSON.stringify({ items }) },
    ),
};
