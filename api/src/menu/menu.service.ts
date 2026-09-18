import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UploadApiResponse } from 'cloudinary';
import { cloudinary } from '../common/cloudinary';
import { RestaurantRole } from '../common/enums/restaurant-role.enum';
import { RestaurantMember, RestaurantMemberDocument } from '../restaurant-members/schemas/restaurant-member.schema';
import { Restaurant, RestaurantDocument } from '../restaurants/schemas/restaurant.schema';
import { Category, CategoryDocument } from './schemas/category.schema';
import { MenuItem, MenuItemDocument } from './schemas/menu-item.schema';

// Only these roles can create/edit/delete categories and items.
// RESTAURANT_STAFF can still view the menu and toggle availability
// (e.g. 86'ing a dish that's run out) without full edit rights.
// Same rule as the pre-migration Prisma version — this ported over
// unchanged, only the storage layer moved.
const MANAGE_ROLES = [RestaurantRole.SUPER_ADMIN, RestaurantRole.RESTAURANT_ADMIN];

// ---- Menu item images ----
//
// This task: moved off local disk (see menu-item.schema.ts's comment on
// `imageUrl` for what this replaced) onto Cloudinary — see
// common/cloudinary.ts for why that provider specifically. Validation
// rules (allowed types, size cap) are unchanged from the local-disk
// version; only where the bytes end up changed.
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — a phone photo, not a raw file
// Every menu item image lives under this one Cloudinary folder,
// namespaced by restaurant — keeps one restaurant's photos visibly
// separate from another's in the Cloudinary media library itself, not
// just in MongoDB.
const CLOUDINARY_FOLDER = 'mnu/menu-items';

interface CategoryInput {
  name: string;
  sortOrder?: number;
}

interface MenuItemInput {
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  isAvailable?: boolean;
  sortOrder?: number;
}

@Injectable()
export class MenuService {
  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(MenuItem.name) private readonly menuItemModel: Model<MenuItemDocument>,
    @InjectModel(RestaurantMember.name)
    private readonly restaurantMemberModel: Model<RestaurantMemberDocument>,
    @InjectModel(Restaurant.name) private readonly restaurantModel: Model<RestaurantDocument>,
  ) {}

  // ---- Access checks ----

  // A malformed id (bad ObjectId string) would otherwise reach Mongoose
  // and throw a raw CastError instead of a clean 404/403 — same guard
  // AuthService.me() already uses for userId.
  private assertValidId(id: string, label: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`${label} not found.`);
    }
  }

  private async requireMembership(restaurantId: string, userId: string) {
    this.assertValidId(restaurantId, 'Restaurant');
    const membership = await this.restaurantMemberModel.findOne({ restaurantId, userId });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this restaurant.');
    }
    return membership;
  }

  private async requireManager(restaurantId: string, userId: string) {
    const membership = await this.requireMembership(restaurantId, userId);
    if (!MANAGE_ROLES.includes(membership.role)) {
      throw new ForbiddenException('Only restaurant admins can manage the menu.');
    }
    return membership;
  }

  private async findCategoryOrThrow(restaurantId: string, categoryId: string) {
    this.assertValidId(categoryId, 'Category');
    const category = await this.categoryModel.findOne({ _id: categoryId, restaurantId });
    if (!category) {
      throw new NotFoundException('Category not found.');
    }
    return category;
  }

  private async findMenuItemOrThrow(restaurantId: string, itemId: string) {
    this.assertValidId(itemId, 'Menu item');
    const item = await this.menuItemModel.findOne({ _id: itemId, restaurantId });
    if (!item) {
      throw new NotFoundException('Menu item not found.');
    }
    return item;
  }

  private serializeItem(item: MenuItemDocument) {
    return {
      id: item._id.toString(),
      categoryId: item.categoryId.toString(),
      name: item.name,
      description: item.description ?? null,
      price: item.price,
      isAvailable: item.isAvailable,
      sortOrder: item.sortOrder,
      isFeatured: item.isFeatured ?? false,
      imageUrl: item.imageUrl ?? null,
    };
  }

  // ---- Reads (any restaurant member) ----

  async getMenu(restaurantId: string, userId: string) {
    await this.requireMembership(restaurantId, userId);

    const [categories, items] = await Promise.all([
      this.categoryModel.find({ restaurantId }).sort({ sortOrder: 1 }).lean(),
      this.menuItemModel.find({ restaurantId }).sort({ sortOrder: 1 }).lean(),
    ]);

    return categories.map((category) => ({
      id: category._id.toString(),
      name: category.name,
      sortOrder: category.sortOrder,
      items: items
        .filter((item) => item.categoryId.toString() === category._id.toString())
        .map((item) => ({
          id: item._id.toString(),
          categoryId: item.categoryId.toString(),
          name: item.name,
          description: item.description ?? null,
          price: item.price,
          isAvailable: item.isAvailable,
          sortOrder: item.sortOrder,
          isFeatured: item.isFeatured ?? false,
          imageUrl: item.imageUrl ?? null,
        })),
    }));
  }

  // ---- Categories (managers only) ----

  async createCategory(restaurantId: string, userId: string, input: CategoryInput) {
    await this.requireManager(restaurantId, userId);
    if (!input.name?.trim()) {
      throw new BadRequestException('Category name is required.');
    }

    const category = await this.categoryModel.create({
      restaurantId,
      name: input.name.trim(),
      sortOrder: input.sortOrder ?? 0,
    });

    return { id: category._id.toString(), name: category.name, sortOrder: category.sortOrder };
  }

  async updateCategory(
    restaurantId: string,
    categoryId: string,
    userId: string,
    input: Partial<CategoryInput>,
  ) {
    await this.requireManager(restaurantId, userId);
    const category = await this.findCategoryOrThrow(restaurantId, categoryId);
    if (input.name !== undefined && !input.name.trim()) {
      throw new BadRequestException('Category name is required.');
    }

    if (input.name !== undefined) category.name = input.name.trim();
    if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder;
    await category.save();

    return { id: category._id.toString(), name: category.name, sortOrder: category.sortOrder };
  }

  async deleteCategory(restaurantId: string, categoryId: string, userId: string) {
    await this.requireManager(restaurantId, userId);
    await this.findCategoryOrThrow(restaurantId, categoryId);

    // Unlike Prisma's relationMode="prisma" cascade emulation, Mongoose
    // does nothing automatically here — delete the category's items
    // ourselves before removing the category.
    await this.menuItemModel.deleteMany({ categoryId });
    await this.categoryModel.deleteOne({ _id: categoryId });
    return { success: true };
  }

  // ---- Menu items ----

  async createMenuItem(restaurantId: string, userId: string, input: MenuItemInput) {
    await this.requireManager(restaurantId, userId);
    if (!input.name?.trim()) {
      throw new BadRequestException('Item name is required.');
    }
    if (typeof input.price !== 'number' || Number.isNaN(input.price) || input.price < 0) {
      throw new BadRequestException('Price must be a non-negative number.');
    }
    await this.findCategoryOrThrow(restaurantId, input.categoryId);

    const item = await this.menuItemModel.create({
      restaurantId,
      categoryId: input.categoryId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      price: input.price,
      isAvailable: input.isAvailable ?? true,
      sortOrder: input.sortOrder ?? 0,
    });

    return this.serializeItem(item);
  }

  async updateMenuItem(
    restaurantId: string,
    itemId: string,
    userId: string,
    input: Partial<MenuItemInput>,
  ) {
    await this.requireManager(restaurantId, userId);
    const item = await this.findMenuItemOrThrow(restaurantId, itemId);

    if (input.name !== undefined && !input.name.trim()) {
      throw new BadRequestException('Item name is required.');
    }
    if (
      input.price !== undefined &&
      (typeof input.price !== 'number' || Number.isNaN(input.price) || input.price < 0)
    ) {
      throw new BadRequestException('Price must be a non-negative number.');
    }
    if (input.categoryId !== undefined) {
      await this.findCategoryOrThrow(restaurantId, input.categoryId);
      item.categoryId = new Types.ObjectId(input.categoryId);
    }
    if (input.name !== undefined) item.name = input.name.trim();
    if (input.description !== undefined) item.description = input.description?.trim() || null;
    if (input.price !== undefined) item.price = input.price;
    if (input.isAvailable !== undefined) item.isAvailable = input.isAvailable;
    if (input.sortOrder !== undefined) item.sortOrder = input.sortOrder;

    await item.save();
    return this.serializeItem(item);
  }

  async setAvailability(restaurantId: string, itemId: string, userId: string, isAvailable: boolean) {
    // Deliberately just requireMembership, not requireManager: staff can
    // toggle a dish off the menu without full edit rights.
    await this.requireMembership(restaurantId, userId);
    const item = await this.findMenuItemOrThrow(restaurantId, itemId);
    item.isAvailable = isAvailable;
    await item.save();
    return this.serializeItem(item);
  }

  // Day 22 — admin-controlled Featured flag. Unlike setAvailability
  // above this is requireManager, not requireMembership: 86'ing a dish
  // that's run out is an operational call any staff member makes mid
  // service, but deciding what the restaurant *promotes* on its
  // customer home screen is an editorial/marketing decision, which
  // matches how every other content edit (create/update/delete item) is
  // already gated in this service.
  //
  // `findMenuItemOrThrow` scopes by {_id, restaurantId} together, so one
  // restaurant can never feature another restaurant's dish — same
  // isolation every other menu write already relies on.
  async setFeatured(restaurantId: string, itemId: string, userId: string, isFeatured: boolean) {
    await this.requireManager(restaurantId, userId);
    const item = await this.findMenuItemOrThrow(restaurantId, itemId);
    item.isFeatured = isFeatured;
    await item.save();
    return this.serializeItem(item);
  }

  async deleteMenuItem(restaurantId: string, itemId: string, userId: string) {
    await this.requireManager(restaurantId, userId);
    await this.findMenuItemOrThrow(restaurantId, itemId);
    await this.menuItemModel.deleteOne({ _id: itemId });
    return { success: true };
  }

  // ---- Menu item image ----

  // Best-effort: destroys the previous Cloudinary asset, if any, before
  // either uploading a new one or just clearing the fields. A failed
  // destroy (asset already gone, transient network blip) is not worth
  // failing the request over — same reasoning the local-disk version
  // used for a missing file, just against Cloudinary's API instead of
  // the filesystem.
  private async destroyImageIfAny(item: MenuItemDocument) {
    if (!item.imagePublicId) return;
    try {
      await cloudinary.uploader.destroy(item.imagePublicId);
    } catch {
      // Already gone, or the API call itself failed — fine either way,
      // we're about to overwrite/clear the reference regardless.
    }
  }

  async uploadItemImage(
    restaurantId: string,
    itemId: string,
    userId: string,
    file: Express.Multer.File | undefined,
  ) {
    await this.requireManager(restaurantId, userId);
    const item = await this.findMenuItemOrThrow(restaurantId, itemId);

    if (!file) {
      throw new BadRequestException('No image file was uploaded.');
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Unsupported image type. Please upload a JPEG, PNG, or WebP file.');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image is too large. Please upload a file under 5MB.');
    }

    await this.destroyImageIfAny(item);

    // Multer's memoryStorage() (see MenuController) already gave us the
    // whole file as a Buffer — the Cloudinary Node SDK's upload() only
    // takes a file path or a data URI, not a raw Buffer, so
    // upload_stream (which does accept one, via a writable stream) is
    // the correct call here, wrapped in a Promise so this method can
    // still just be awaited like the rest of this class.
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `${CLOUDINARY_FOLDER}/${restaurantId}`,
          resource_type: 'image',
        },
        (error, uploadResult) => {
          if (error || !uploadResult) {
            reject(error ?? new Error('Cloudinary upload failed.'));
            return;
          }
          resolve(uploadResult);
        },
      );
      stream.end(file.buffer);
    }).catch((err) => {
      throw new BadRequestException(
        err instanceof Error ? `Image upload failed: ${err.message}` : 'Image upload failed.',
      );
    });

    item.imageUrl = result.secure_url;
    item.imagePublicId = result.public_id;
    await item.save();
    return this.serializeItem(item);
  }

  async removeItemImage(restaurantId: string, itemId: string, userId: string) {
    await this.requireManager(restaurantId, userId);
    const item = await this.findMenuItemOrThrow(restaurantId, itemId);

    await this.destroyImageIfAny(item);
    item.imageUrl = null;
    item.imagePublicId = null;
    await item.save();
    return this.serializeItem(item);
  }

  // ---- Public read (Day 9 — no auth, no membership check) ----

  // Deliberately a separate method rather than reusing getMenu(): the
  // access rule is different (no membership required at all — this is
  // what an anonymous customer's browser calls) and the shape returned
  // is intentionally smaller (no isAvailable/sortOrder/categoryId on
  // items, no unavailable items at all, no empty categories) — this is
  // public-facing data, not the admin management payload with fields
  // trimmed off client-side.
  //
  // Day 14 addition: `createdAt` is now included per item. This isn't a
  // new field — `MenuItem` has always had it via `{ timestamps: true }`
  // — it just wasn't exposed here before because nothing on the
  // customer side needed it. The new customer Home page's "New
  // Arrivals" section needs a real, non-fabricated recency signal, and
  // this is already-real, already-stored data; exposing it is a
  // one-line addition, not a new backend system.
  async getPublicMenu(restaurantId: string) {
    this.assertValidId(restaurantId, 'Restaurant');
    const restaurant = await this.restaurantModel.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }

    const [categories, items] = await Promise.all([
      this.categoryModel.find({ restaurantId }).sort({ sortOrder: 1 }).lean(),
      // Only isAvailable items — an 86'd dish shouldn't show to
      // customers, even though it's still visible to staff/admins in
      // the manage view (getMenu() above returns it either way).
      this.menuItemModel.find({ restaurantId, isAvailable: true }).sort({ sortOrder: 1 }).lean(),
    ]);

    return {
      restaurantName: restaurant.name,
      // Day 22 — restaurant branding for the customer header/loading
      // screen. All nullable; the customer UI has a defined fallback for
      // each (initial-letter avatar + MnU default palette), so a
      // restaurant that has set none of this still renders completely.
      // Only these three fields are exposed — nothing else on the
      // Restaurant document is public.
      branding: {
        logoUrl: restaurant.logoUrl ?? null,
        primaryColor: restaurant.primaryColor ?? null,
        accentColor: restaurant.accentColor ?? null,
      },
      categories: categories
        .map((category) => ({
          id: category._id.toString(),
          name: category.name,
          items: items
            .filter((item) => item.categoryId.toString() === category._id.toString())
            .map((item) => ({
              id: item._id.toString(),
              name: item.name,
              description: item.description ?? null,
              price: item.price,
              createdAt: item.createdAt,
              // Day 22 — admin-controlled. Drives both the Home
              // "Featured" section and the in-category highlight, from
              // this one field on this one record: the item is never
              // duplicated or moved out of its category.
              isFeatured: item.isFeatured ?? false,
              imageUrl: item.imageUrl ?? null,
            })),
        }))
        // Drop categories that end up with nothing visible in them,
        // rather than showing an empty heading with no items under it.
        .filter((category) => category.items.length > 0),
    };
  }
}
