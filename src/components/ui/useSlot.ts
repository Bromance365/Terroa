"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Element (appended after <main>) that sticky mobile bars portal into, so they follow the content in DOM order. */
export function useStickySlot() {
  return useSyncExternalStore(
    noop,
    () => document.getElementById("sticky-slot"),
    () => null,
  );
}
