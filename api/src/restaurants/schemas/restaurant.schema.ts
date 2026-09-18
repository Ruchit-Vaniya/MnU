import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// A restaurant tenant. Deliberately minimal — menu, QR, and analytics
// fields belong to later tasks, not this foundation.
// collection: 'Restaurant' — see user.schema.ts for why this is pinned.
@Schema({ timestamps: true, collection: 'Restaurant' })
export class Restaurant {
  @Prop({ required: true })
  name: string;

  // ---- Branding (Day 22) ----
  //
  // Day 22 inspected this schema first and found NO branding fields at
  // all — so these are the minimum needed to brand the customer QR
  // header and loading screen, and nothing more (no secondary/background
  // colour, no font, no tagline: the customer header uses exactly a
  // logo, a name, and one accent colour, so anything else would be
  // schema surface with no consumer).
  //
  // All three are nullable by design. Every one of them has a defined
  // fallback in the customer UI (MnU's existing default palette and an
  // initial-letter avatar — see MenuHeader/HomeHeader), so a restaurant
  // that has set none of this still gets a complete, intentional-looking
  // menu rather than a half-branded one.
  //
  // NOTE: there is currently **no admin UI and no write API** for these
  // — no RestaurantsService/Controller exists in this project at all.
  // They are read-only from the customer side today and must be set
  // directly in MongoDB. Wiring up restaurant settings is called out as
  // remaining work in docs/PROGRESS.md rather than half-built here,
  // since Day 22's admin scope is explicitly only the Featured toggle.
  //
  // `@Prop({ type: String, ... })` is required rather than stylistic on
  // a `string | null` union — see menu-item.schema.ts's `description`
  // for the CannotDetermineTypeError this avoids at boot.

  // Cloudinary (or any absolute) URL, same convention as
  // MenuItem.imageUrl — resolved through the frontend's
  // `resolveImageUrl()` so a legacy relative path still renders.
  @Prop({ type: String, default: null })
  logoUrl: string | null;

  // Hex string like '#E07A5F'. Used for accents only (chips, active
  // states, the loading shimmer) — never for body text or large
  // backgrounds, because an arbitrary restaurant-chosen colour can't be
  // contrast-checked ahead of time. Validated/sanitized on read by the
  // customer UI; a malformed value falls back to the MnU default rather
  // than injecting an invalid CSS value.
  @Prop({ type: String, default: null })
  primaryColor: string | null;

  @Prop({ type: String, default: null })
  accentColor: string | null;
}

export type RestaurantDocument = HydratedDocument<Restaurant>;
export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);
