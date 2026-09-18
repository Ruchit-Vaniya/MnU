'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  authApi,
  menuApi,
  resolveImageUrl,
  type CategoryRecord,
  type Membership,
  type MenuItemRecord,
} from '@/lib/api';

const MANAGE_ROLES: Membership['role'][] = ['SUPER_ADMIN', 'RESTAURANT_ADMIN'];

// Mirrors the backend's own checks (MenuService.uploadItemImage) —
// duplicated here purely so the admin gets an immediate, friendly
// message before ever making a network request, not to replace the
// server-side validation (which still runs regardless).
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Please choose a JPEG, PNG, or WebP image.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Image must be 5MB or smaller.';
  }
  return null;
}

export default function RestaurantMenuPage() {
  const router = useRouter();
  const params = useParams<{ restaurantId: string }>();
  const restaurantId = params.restaurantId;

  const [membership, setMembership] = useState<Membership | null>(null);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canManage = !!membership && MANAGE_ROLES.includes(membership.role);

  useEffect(() => {
    if (!localStorage.getItem('mnu_token')) {
      router.push('/login');
      return;
    }

    Promise.all([authApi.me(), menuApi.getMenu(restaurantId)])
      .then(([me, menu]) => {
        const match = me.memberships.find((m) => m.restaurant_id === restaurantId);
        if (!match) {
          setError("You don't have access to this restaurant.");
          return;
        }
        setMembership(match);
        setCategories(menu);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load menu.'))
      .finally(() => setLoading(false));
  }, [restaurantId, router]);

  const refreshMenu = async () => {
    const menu = await menuApi.getMenu(restaurantId);
    setCategories(menu);
  };

  if (loading) return <p className="p-6 text-sm text-ink-400">Loading menu...</p>;
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-xs font-semibold text-ink-400">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-xl font-bold text-ink-900">{membership?.restaurant_name}</h1>
          <p className="text-sm text-ink-400">
            Menu management{!canManage && ' · view only (staff)'}
          </p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
          {membership?.role}
        </span>
      </div>

      <div className="space-y-5">
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            restaurantId={restaurantId}
            category={category}
            canManage={canManage}
            onChanged={refreshMenu}
          />
        ))}

        {categories.length === 0 && (
          <p className="rounded-2xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-400">
            No categories yet. {canManage ? 'Add one below to get started.' : 'Check back once an admin sets up the menu.'}
          </p>
        )}
      </div>

      {canManage && (
        <div className="mt-6">
          <AddCategoryForm restaurantId={restaurantId} onCreated={refreshMenu} />
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------

function CategoryCard({
  restaurantId,
  category,
  canManage,
  onChanged,
}: {
  restaurantId: string;
  category: CategoryRecord;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveName = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await menuApi.updateCategory(restaurantId, category.id, { name });
      setIsEditing(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename category.');
    } finally {
      setBusy(false);
    }
  };

  const deleteCategory = async () => {
    if (!confirm(`Delete "${category.name}" and all its items?`)) return;
    setBusy(true);
    setError(null);
    try {
      await menuApi.deleteCategory(restaurantId, category.id);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category.');
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        {isEditing ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-brand-400"
              autoFocus
            />
            <button
              onClick={saveName}
              disabled={busy}
              className="text-xs font-semibold text-brand-600 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                setName(category.name);
                setIsEditing(false);
              }}
              className="text-xs font-semibold text-ink-400"
            >
              Cancel
            </button>
          </div>
        ) : (
          <h2 className="text-base font-bold text-ink-900">{category.name}</h2>
        )}

        {canManage && !isEditing && (
          <div className="flex shrink-0 gap-3 text-xs font-semibold">
            <button onClick={() => setIsEditing(true)} className="text-ink-400 hover:text-ink-700">
              Rename
            </button>
            <button onClick={deleteCategory} disabled={busy} className="text-red-500 disabled:opacity-50">
              Delete
            </button>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 divide-y divide-ink-100">
        {category.items.map((item) => (
          <ItemRow
            key={item.id}
            restaurantId={restaurantId}
            item={item}
            canManage={canManage}
            onChanged={onChanged}
          />
        ))}
        {category.items.length === 0 && (
          <p className="py-3 text-xs text-ink-400">No items in this category yet.</p>
        )}
      </div>

      {canManage &&
        (isAddingItem ? (
          <AddItemForm
            restaurantId={restaurantId}
            categoryId={category.id}
            onDone={async () => {
              setIsAddingItem(false);
              await onChanged();
            }}
            onCancel={() => setIsAddingItem(false)}
          />
        ) : (
          <button
            onClick={() => setIsAddingItem(true)}
            className="mt-3 text-xs font-semibold text-brand-600"
          >
            + Add item
          </button>
        ))}
    </section>
  );
}

function ItemRow({
  restaurantId,
  item,
  canManage,
  onChanged,
}: {
  restaurantId: string;
  item: MenuItemRecord;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAvailability = async () => {
    setBusy(true);
    setError(null);
    try {
      await menuApi.setAvailability(restaurantId, item.id, !item.isAvailable);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update availability.');
    } finally {
      setBusy(false);
    }
  };

  const toggleFeatured = async () => {
    setBusy(true);
    setError(null);
    try {
      await menuApi.setFeatured(restaurantId, item.id, !item.isFeatured);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update featured status.');
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async () => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await menuApi.deleteMenuItem(restaurantId, item.id);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item.');
      setBusy(false);
    }
  };

  if (isEditing) {
    return (
      <div className="py-3">
        <EditItemForm
          restaurantId={restaurantId}
          item={item}
          onDone={async () => {
            setIsEditing(false);
            await onChanged();
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="flex min-w-0 gap-2.5">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-ink-100">
          {item.imageUrl ? (
            <img src={resolveImageUrl(item.imageUrl) ?? ''} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-ink-200">
              <span className="text-lg">🍽</span>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className={`font-medium ${item.isAvailable ? 'text-ink-900' : 'text-ink-400 line-through'}`}>
              {item.name}
            </p>
            {!item.isAvailable && (
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-400">
                86&apos;d
              </span>
            )}
            {item.isFeatured && (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
                ★ Featured
              </span>
            )}
          </div>
          {item.description && <p className="mt-0.5 text-xs text-ink-400">{item.description}</p>}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <p className="font-semibold text-ink-900">₹{item.price}</p>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <button onClick={toggleAvailability} disabled={busy} className="text-ink-400 disabled:opacity-50">
            {item.isAvailable ? 'Mark 86' : 'Restore'}
          </button>
          {canManage && (
            <>
              {/* Day 22 — Featured toggle lives on the existing menu
                  management row, not a separate admin page. */}
              <button
                onClick={toggleFeatured}
                disabled={busy}
                className={`disabled:opacity-50 ${item.isFeatured ? 'text-brand-600' : 'text-ink-400 hover:text-ink-700'}`}
                title={item.isFeatured ? 'Remove from Featured' : 'Show in the customer Featured section'}
              >
                {item.isFeatured ? '★ Featured' : '☆ Feature'}
              </button>
              <button onClick={() => setIsEditing(true)} className="text-ink-400 hover:text-ink-700">
                Edit
              </button>
              <button onClick={deleteItem} disabled={busy} className="text-red-500 disabled:opacity-50">
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AddCategoryForm({
  restaurantId,
  onCreated,
}: {
  restaurantId: string;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await menuApi.createCategory(restaurantId, { name });
      setName('');
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-dashed border-ink-200 p-4">
      <p className="mb-2 text-sm font-semibold text-ink-700">Add a category</p>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Starters"
          className="flex-1 rounded-xl border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </form>
  );
}

function AddItemForm({
  restaurantId,
  categoryId,
  onDone,
  onCancel,
}: {
  restaurantId: string;
  categoryId: string;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revokes the previous object URL whenever it's replaced or the form
  // unmounts — otherwise each picked file leaks its blob URL.
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      e.target.value = '';
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = Number(price);
    if (!name.trim() || Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Enter a name and a valid, non-negative price.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Image upload needs a real item id, so it always happens as a
      // second step after creation — an item without a picked image
      // still creates in one step, exactly as before.
      const created = await menuApi.createMenuItem(restaurantId, {
        categoryId,
        name,
        description: description || undefined,
        price: parsedPrice,
      });
      if (imageFile) {
        try {
          await menuApi.uploadItemImage(restaurantId, created.id, imageFile);
        } catch (imgErr) {
          // The item itself was created successfully — don't lose that
          // by throwing here. Surface the image failure and still
          // refresh the list; the admin can retry the image via Edit.
          setError(
            `Item added, but the image failed to upload: ${
              imgErr instanceof Error ? imgErr.message : 'unknown error'
            }`,
          );
          await onDone();
          setBusy(false);
          return;
        }
      }
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl bg-cream-100 p-3">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Item name"
        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
        autoFocus
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
      />
      <input
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Price (₹)"
        inputMode="decimal"
        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
      />

      <div className="flex items-center gap-3">
        {imagePreview ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-ink-200">
            <img src={imagePreview} alt="Selected item" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={clearImage}
              aria-label="Remove selected image"
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-ink-200 text-ink-300">
            <span className="text-lg">🍽</span>
          </div>
        )}
        <label className="text-xs font-semibold text-brand-600">
          {imagePreview ? 'Change photo' : 'Add photo (optional)'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Add item
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-semibold text-ink-400">
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditItemForm({
  restaurantId,
  item,
  onDone,
  onCancel,
}: {
  restaurantId: string;
  item: MenuItemRecord;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? '');
  const [price, setPrice] = useState(String(item.price));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removingImage, setRemovingImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      e.target.value = '';
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // Removing the current image is its own immediate action, not staged
  // for "Save" — there's no ambiguity to defer (nothing else to
  // combine it with), and it means a mistaken tap on "Remove" is
  // reflected right away rather than sitting silently until Save.
  const removeCurrentImage = async () => {
    if (!confirm('Remove this item\u2019s photo?')) return;
    setRemovingImage(true);
    setError(null);
    try {
      await menuApi.removeItemImage(restaurantId, item.id);
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove image.');
      setRemovingImage(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = Number(price);
    if (!name.trim() || Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Enter a name and a valid, non-negative price.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await menuApi.updateMenuItem(restaurantId, item.id, {
        name,
        description: description || undefined,
        price: parsedPrice,
      });
      if (imageFile) {
        try {
          await menuApi.uploadItemImage(restaurantId, item.id, imageFile);
        } catch (imgErr) {
          setError(
            `Item saved, but the new image failed to upload: ${
              imgErr instanceof Error ? imgErr.message : 'unknown error'
            }`,
          );
          await onDone();
          setBusy(false);
          return;
        }
      }
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item.');
      setBusy(false);
    }
  };

  const currentImageUrl = resolveImageUrl(item.imageUrl);

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl bg-cream-100 p-3">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
        autoFocus
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
      />
      <input
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        inputMode="decimal"
        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
      />

      <div className="flex items-center gap-3">
        {/* A newly-picked file's local preview always wins over the
            saved image while one is staged — it's what Save is about
            to upload. */}
        {imagePreview || currentImageUrl ? (
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-ink-200">
            <img src={imagePreview ?? currentImageUrl ?? ''} alt={item.name} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-ink-200 text-ink-300">
            <span className="text-lg">🍽</span>
          </div>
        )}

        <div className="flex flex-col items-start gap-1">
          <label className="text-xs font-semibold text-brand-600">
            {currentImageUrl || imagePreview ? 'Replace photo' : 'Add photo (optional)'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          {currentImageUrl && !imagePreview && (
            <button
              type="button"
              onClick={removeCurrentImage}
              disabled={removingImage}
              className="text-xs font-semibold text-red-500 disabled:opacity-50"
            >
              {removingImage ? 'Removing…' : 'Remove photo'}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-semibold text-ink-400">
          Cancel
        </button>
      </div>
    </form>
  );
}
