'use client';

import { createContext, useContext } from 'react';
import type { AuthUser, Membership } from '@/lib/api';

export interface RestaurantContextValue {
  user: AuthUser;
  membership: Membership;
  memberships: Membership[];
}

export const RestaurantContext = createContext<RestaurantContextValue | null>(null);

// Thrown-away default keeps this a plain, obvious hook — every page under
// /restaurants/[restaurantId]/ renders inside RestaurantLayout, which
// always provides this context before rendering children, so a null read
// here means a page was somehow rendered outside that layout (a coding
// mistake, not a runtime state to design around).
export function useRestaurantContext(): RestaurantContextValue {
  const ctx = useContext(RestaurantContext);
  if (!ctx) {
    throw new Error('useRestaurantContext must be used within RestaurantLayout.');
  }
  return ctx;
}
