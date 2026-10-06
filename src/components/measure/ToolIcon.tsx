import type { SVGProps } from "react";

export type ToolIconName = "select" | "scale" | "detect" | "trace" | "rect" | "pan" | "fit" | "close" | "undo";

const paths: Record<ToolIconName, React.ReactNode> = {
  select: <path d="m5 3 14 8-6 2-2 6z" />,
  scale: (
    <>
      <path d="M3 17 17 3l4 4L7 21z" />
      <path d="m7 13 2 2" />
      <path d="m10 10 2 2" />
      <path d="m13 7 2 2" />
    </>
  ),
  detect: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </>
  ),
  trace: (
    <>
      <path d="m4 18 3-12 11 3-2 10z" />
      <circle cx="4" cy="18" r="1.5" />
      <circle cx="7" cy="6" r="1.5" />
      <circle cx="18" cy="9" r="1.5" />
      <circle cx="16" cy="19" r="1.5" />
    </>
  ),
  rect: <rect x="4" y="6" width="16" height="12" rx="1" />,
  pan: (
    <>
      <path d="M12 3v18" />
      <path d="M3 12h18" />
      <path d="m9 6 3-3 3 3" />
      <path d="m9 18 3 3 3-3" />
      <path d="m6 9-3 3 3 3" />
      <path d="m18 9 3 3-3 3" />
    </>
  ),
  fit: (
    <>
      <path d="M4 9V4h5" />
      <path d="M20 9V4h-5" />
      <path d="M4 15v5h5" />
      <path d="M20 15v5h-5" />
    </>
  ),
  close: <path d="m5 12.5 4.5 4.5L19 7" />,
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </>
  ),
};

/** Tool glyphs for the measuring toolbar (same stroke style as src/components/ui/icons.tsx). Decorative: the button carries the label. */
export function ToolIcon({ name, size = 20, ...rest }: { name: ToolIconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
