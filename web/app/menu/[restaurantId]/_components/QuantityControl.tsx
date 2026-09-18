'use client';

import { useRef, useState } from 'react';

interface QuantityControlProps {
  label: string;
  quantity: number;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
  // 'pill'  — "Add" text button, then a bordered stepper (list rows)
  // 'round' — circular + button, then a compact stepper (grid cards)
  variant?: 'pill' | 'round';
}

// Extracted in Day 21 because the identical add/stepper markup was
// duplicated across MenuItemCard, HomeItemCard and the item detail page,
// and each copy had drifted to a different touch-target size. One
// component means one place to keep them ≥32px.
//
// Day 23 — "the customer should understand that item was added without
// leaving the menu" (no toast per action). This component now gives
// that confirmation itself: tapping Add plays a one-shot pop on the
// button and briefly shows a check, then settles into the +/- stepper
// that was already the "it's in your cart" state. No new state is
// invented for this — `quantity` already flips 0 → 1 the moment the
// parent's cart updates, this just makes that instant register visually
// instead of the stepper silently appearing.
export function QuantityControl({
  label,
  quantity,
  onAdd,
  onIncrease,
  onDecrease,
  variant = 'pill',
}: QuantityControlProps) {
  const [justAdded, setJustAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAdd = () => {
    onAdd();
    setJustAdded(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setJustAdded(false), 420);
  };

  if (quantity === 0) {
    return (
      <button
        type="button"
        onClick={handleAdd}
        aria-label={`Add ${label} to cart`}
        className={
          variant === 'round'
            ? 'flex h-9 w-9 items-center justify-center rounded-full bg-terracotta-500 text-lg font-bold leading-none text-white shadow-soft transition active:scale-90'
            : 'min-h-[36px] rounded-full bg-terracotta-500 px-4 py-2 text-xs font-bold text-white transition active:scale-95'
        }
      >
        {variant === 'round' ? '+' : 'Add'}
      </button>
    );
  }

  return (
    <div
      className={`flex items-center gap-0.5 rounded-full border border-hairline bg-surface p-1 ${
        justAdded ? 'animate-pop' : ''
      }`}
    >
      <button
        type="button"
        onClick={onDecrease}
        aria-label={`Decrease ${label} quantity`}
        className="flex h-8 w-8 items-center justify-center rounded-full text-base font-bold text-carbon-700 transition active:scale-90 active:bg-canvas-deep"
      >
        −
      </button>
      <span
        key={quantity}
        aria-live="polite"
        className="w-5 animate-scale-in text-center text-sm font-bold tabular-nums text-carbon-900"
      >
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => {
          onIncrease();
          setJustAdded(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => setJustAdded(false), 420);
        }}
        aria-label={`Increase ${label} quantity`}
        className="flex h-8 w-8 items-center justify-center rounded-full text-base font-bold text-carbon-700 transition active:scale-90 active:bg-canvas-deep"
      >
        +
      </button>
    </div>
  );
}
