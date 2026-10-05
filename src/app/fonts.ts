import localFont from "next/font/local";

// Self-hosted variable fonts (no runtime call to Google). Same families as the design: Fraunces + DM Sans.
export const fraunces = localFont({
  src: [
    { path: "./fonts/fraunces-latin-wght-normal.woff2", style: "normal", weight: "100 900" },
    { path: "./fonts/fraunces-latin-wght-italic.woff2", style: "italic", weight: "100 900" },
  ],
  variable: "--font-fraunces",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const dmSans = localFont({
  src: [{ path: "./fonts/dm-sans-latin-wght-normal.woff2", style: "normal", weight: "100 1000" }],
  variable: "--font-dm-sans",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
});
