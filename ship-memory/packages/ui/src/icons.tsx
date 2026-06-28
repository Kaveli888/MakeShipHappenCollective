import type { SVGProps } from "react";

/**
 * Inline stroke icons (lucide-style, 24-grid) so the chrome matches
 * Obsidian's line-icon look without pulling in an icon dependency.
 * All inherit `currentColor`.
 */

type P = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: P) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconPanelLeft(p: P) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </Svg>
  );
}

export function IconFileSearch(p: P) {
  return (
    <Svg {...p}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v5h5" />
      <circle cx="11" cy="13.5" r="2.5" />
      <path d="m13 15.5 2.5 2.5" />
    </Svg>
  );
}

export function IconGraph(p: P) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="5" r="2.4" />
      <circle cx="5" cy="19" r="2.4" />
      <circle cx="19" cy="19" r="2.4" />
      <path d="M10.9 7.2 6.1 16.9" />
      <path d="m13.1 7.2 4.8 9.7" />
      <path d="M7.4 19h9.2" />
    </Svg>
  );
}

export function IconCalendar(p: P) {
  return (
    <Svg {...p}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
    </Svg>
  );
}

export function IconSquarePen(p: P) {
  return (
    <Svg {...p}>
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.4 2.6a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4Z" />
    </Svg>
  );
}

export function IconFolderPlus(p: P) {
  return (
    <Svg {...p}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M12 10v6" />
      <path d="M9 13h6" />
    </Svg>
  );
}

export function IconSort(p: P) {
  return (
    <Svg {...p}>
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
      <path d="M13 12h4" />
      <path d="M13 16h7" />
      <path d="M13 8h1" />
    </Svg>
  );
}

export function IconChevronsDownUp(p: P) {
  return (
    <Svg {...p}>
      <path d="m7 20 5-5 5 5" />
      <path d="m7 4 5 5 5-5" />
    </Svg>
  );
}

export function IconPlus(p: P) {
  return (
    <Svg {...p}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </Svg>
  );
}

export function IconX(p: P) {
  return (
    <Svg {...p}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Svg>
  );
}

export function IconChevronDown(p: P) {
  return (
    <Svg {...p}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function IconArrowLeft(p: P) {
  return (
    <Svg {...p}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </Svg>
  );
}

export function IconArrowRight(p: P) {
  return (
    <Svg {...p}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </Svg>
  );
}
