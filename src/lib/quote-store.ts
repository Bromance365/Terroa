"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { getProduct } from "@/lib/catalog";

/**
 * Quote basket. Lives in localStorage (no account), validated with zod on load and
 * re-checked against the catalogue. Client numbers are display only: the server recomputes.
 */
export const QUOTE_STORAGE_KEY = "terroa.quote.v1";
export const MAX_QTY = 9999;

export const quoteLineSchema = z.object({
  id: z.string().min(1).max(64),
  productId: z.string().min(1).max(64),
  unit: z.enum(["box", "panel", "area"]),
  quantity: z.number().int().min(1).max(MAX_QTY),
  rooms: z.array(z.string().max(60)).max(60).optional(),
  plannedAreaSqft: z.number().positive().max(100000).optional(),
  source: z.enum(["catalogue", "calculator", "plan"]).optional(),
  sourceLabel: z.string().max(80).optional(),
});
export type QuoteLine = z.infer<typeof quoteLineSchema>;

const stateSchema = z.object({
  lines: z.array(quoteLineSchema).max(100),
  removed: z.array(quoteLineSchema).max(100).default([]),
});
interface QuoteState {
  lines: QuoteLine[];
  removed: QuoteLine[];
}

const EMPTY: QuoteState = { lines: [], removed: [] };
let state: QuoteState = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function persist() {
  try {
    window.localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or quota: the basket still works for this page view.
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(QUOTE_STORAGE_KEY);
    if (!raw) return;
    const parsed = stateSchema.safeParse(JSON.parse(raw));
    if (parsed.success) state = parsed.data;
  } catch {
    state = EMPTY;
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function set(next: QuoteState) {
  state = next;
  persist();
  emit();
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== QUOTE_STORAGE_KEY) return;
    hydrated = false;
    state = EMPTY;
    hydrate();
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => {
  hydrate();
  return state;
};
const getServerSnapshot = () => EMPTY;

export function useQuote() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `l-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const clampQty = (n: number) => Math.min(MAX_QTY, Math.max(1, Math.round(n)));

/** Adds a line; merges with an existing line for the same product and unit. Returns the resulting line. */
export function addToQuote(input: Omit<QuoteLine, "id">): QuoteLine {
  hydrate();
  const existing = state.lines.find((l) => l.productId === input.productId && l.unit === input.unit && l.source === input.source);
  if (existing) {
    const merged: QuoteLine = {
      ...existing,
      quantity: clampQty(existing.quantity + input.quantity),
      rooms: [...new Set([...(existing.rooms ?? []), ...(input.rooms ?? [])])].slice(0, 60),
      plannedAreaSqft:
        existing.plannedAreaSqft !== undefined || input.plannedAreaSqft !== undefined
          ? Math.min(100000, (existing.plannedAreaSqft ?? 0) + (input.plannedAreaSqft ?? 0))
          : undefined,
    };
    set({ ...state, lines: state.lines.map((l) => (l.id === existing.id ? merged : l)) });
    return merged;
  }
  const line: QuoteLine = { ...input, id: newId(), quantity: clampQty(input.quantity) };
  set({ ...state, lines: [...state.lines, line].slice(0, 100) });
  return line;
}

export function setQuantity(id: string, quantity: number) {
  set({ ...state, lines: state.lines.map((l) => (l.id === id ? { ...l, quantity: clampQty(quantity) } : l)) });
}

export function removeLine(id: string) {
  const line = state.lines.find((l) => l.id === id);
  if (!line) return;
  set({ lines: state.lines.filter((l) => l.id !== id), removed: [...state.removed, line].slice(-20) });
}

export function restoreRemoved() {
  set({ lines: [...state.lines, ...state.removed].slice(0, 100), removed: [] });
}

export function clearQuote() {
  set(EMPTY);
}

/** Lines whose product is no longer published are flagged, never silently dropped. */
export const isLineAvailable = (line: QuoteLine) => Boolean(getProduct(line.productId));

export function summarize(lines: QuoteLine[]) {
  let boxes = 0;
  let panels = 0;
  let areaSqft = 0;
  for (const l of lines) {
    if (l.unit === "box") boxes += l.quantity;
    if (l.unit === "panel") panels += l.quantity;
    if (l.plannedAreaSqft) areaSqft += l.plannedAreaSqft;
  }
  return { products: lines.length, boxes, panels, areaSqft };
}

// Toasts ------------------------------------------------------------------

export interface ToastMessage {
  id: number;
  text: string;
  detail?: string;
}
let toast: ToastMessage | null = null;
const toastListeners = new Set<() => void>();
let toastSeq = 0;

export function showToast(text: string, detail?: string) {
  toast = { id: ++toastSeq, text, detail };
  toastListeners.forEach((l) => l());
}
export function dismissToast() {
  toast = null;
  toastListeners.forEach((l) => l());
}
export function useToast() {
  return useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toast,
    () => null,
  );
}
