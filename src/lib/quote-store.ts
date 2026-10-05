"use client";

import { useSyncExternalStore } from "react";
import { getProduct } from "@/lib/catalog";

/**
 * Quote basket. Lives in localStorage (no account), validated with zod on load and
 * re-checked against the catalogue. Client numbers are display only: the server recomputes.
 */
export const QUOTE_STORAGE_KEY = "terroa.quote.v1";
export const MAX_QTY = 9999;

export interface QuoteLine {
  id: string;
  productId: string;
  unit: "box" | "panel" | "area";
  quantity: number;
  rooms?: string[];
  plannedAreaSqft?: number;
  source?: "catalogue" | "calculator" | "plan";
  sourceLabel?: string;
}
interface QuoteState {
  lines: QuoteLine[];
  removed: QuoteLine[];
}

// Hand-written validation (instead of zod) keeps the header's bundle small: this module loads on every page.
const isStr = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

function parseLine(v: unknown): QuoteLine | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.id, 64) || !isStr(o.productId, 64)) return null;
  if (o.unit !== "box" && o.unit !== "panel" && o.unit !== "area") return null;
  if (!Number.isInteger(o.quantity) || (o.quantity as number) < 1 || (o.quantity as number) > MAX_QTY) return null;
  const line: QuoteLine = { id: o.id, productId: o.productId, unit: o.unit, quantity: o.quantity as number };
  if (Array.isArray(o.rooms)) {
    if (o.rooms.length > 60 || !o.rooms.every((r) => typeof r === "string" && r.length <= 60)) return null;
    line.rooms = o.rooms as string[];
  }
  if (o.plannedAreaSqft !== undefined) {
    if (typeof o.plannedAreaSqft !== "number" || !(o.plannedAreaSqft > 0) || o.plannedAreaSqft > 100000) return null;
    line.plannedAreaSqft = o.plannedAreaSqft;
  }
  if (o.source === "catalogue" || o.source === "calculator" || o.source === "plan") line.source = o.source;
  if (typeof o.sourceLabel === "string" && o.sourceLabel.length <= 80) line.sourceLabel = o.sourceLabel;
  return line;
}

function parseState(v: unknown): QuoteState | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const lines = Array.isArray(o.lines) && o.lines.length <= 100 ? o.lines.map(parseLine) : null;
  if (!lines || lines.some((l) => l === null)) return null;
  const removedRaw = Array.isArray(o.removed) && o.removed.length <= 100 ? o.removed.map(parseLine) : [];
  return { lines: lines as QuoteLine[], removed: removedRaw.filter((l): l is QuoteLine => l !== null) };
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
    const parsed = parseState(JSON.parse(raw));
    if (parsed) state = parsed;
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
