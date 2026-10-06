import type { PreviewRoom } from "./build";

/** Synthetic rooms in feet (no real plan data). For tests and demos only. */
export const sampleRooms: PreviewRoom[] = [
  {
    id: "r1",
    name: "Salon",
    points: [
      { x: 0, y: 0 },
      { x: 18, y: 0 },
      { x: 18, y: 12 },
      { x: 0, y: 12 },
    ],
    productId: "p-chene-naturel",
  },
  {
    id: "r2",
    name: "Cuisine",
    // L shape (concave).
    points: [
      { x: 18, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 6 },
      { x: 24, y: 6 },
      { x: 24, y: 12 },
      { x: 18, y: 12 },
    ],
    productId: null,
  },
  {
    id: "r3",
    name: "Bureau",
    points: [
      { x: 0, y: 12 },
      { x: 10, y: 12 },
      { x: 10, y: 22 },
      { x: 0, y: 22 },
    ],
    productId: "p-lattes-chene",
  },
];
