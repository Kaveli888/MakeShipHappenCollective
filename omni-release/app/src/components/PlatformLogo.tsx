import type { PlatformId } from "../types.js";

const LABEL: Record<PlatformId, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
  linkedin: "LinkedIn",
  twitch: "Twitch",
  rumble: "Rumble",
};

export const platformLabel = (p: PlatformId): string => LABEL[p] ?? p;

/** Brand accent color for each platform — used for chip borders / dots. */
export const PLATFORM_COLOR: Record<PlatformId, string> = {
  youtube: "#FF0000",
  tiktok: "#25F4EE",
  instagram: "#E1306C",
  facebook: "#1877F2",
  x: "#e6edf3",
  linkedin: "#0A66C2",
  twitch: "#9146FF",
  rumble: "#85C742",
};

/** Small rounded-badge brand logos. Recognizable at 14–18px in the calendar. */
export function PlatformLogo({
  platform,
  size = 16,
}: {
  platform: PlatformId;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    role: "img",
    "aria-label": platformLabel(platform),
  };
  switch (platform) {
    case "youtube":
      return (
        <svg {...common}>
          <rect width="24" height="24" rx="6" fill="#FF0000" />
          <path d="M10 8.3 L16 12 L10 15.7 Z" fill="#fff" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <rect width="24" height="24" rx="6" fill="#010101" />
          <path
            d="M15.2 5.5c.35 1.6 1.45 2.78 3 2.95v2.2c-1.05.05-2.07-.27-2.98-.9v4.43a4.35 4.35 0 1 1-4.35-4.35c.2 0 .4.02.6.05v2.28a2.07 2.07 0 1 0 1.45 1.97V5.5h2.28z"
            fill="#25F4EE"
          />
          <path
            d="M15.7 5.5c.35 1.6 1.45 2.78 3 2.95v2.2c-1.05.05-2.07-.27-2.98-.9v4.43a4.35 4.35 0 1 1-4.35-4.35c.2 0 .4.02.6.05v2.28a2.07 2.07 0 1 0 1.45 1.97V5.5h2.28z"
            fill="#FE2C55"
            opacity="0.85"
          />
          <path
            d="M15.45 5.5c.35 1.6 1.45 2.78 3 2.95v2.2c-1.05.05-2.07-.27-2.98-.9v4.43a4.35 4.35 0 1 1-4.35-4.35c.2 0 .4.02.6.05v2.28a2.07 2.07 0 1 0 1.45 1.97V5.5h2.28z"
            fill="#fff"
          />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#FEDA75" />
              <stop offset="0.45" stopColor="#D62976" />
              <stop offset="1" stopColor="#4F5BD5" />
            </linearGradient>
          </defs>
          <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
          <rect
            x="6.5"
            y="6.5"
            width="11"
            height="11"
            rx="3.4"
            fill="none"
            stroke="#fff"
            strokeWidth="1.6"
          />
          <circle cx="12" cy="12" r="2.9" fill="none" stroke="#fff" strokeWidth="1.6" />
          <circle cx="15.5" cy="8.5" r="1" fill="#fff" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <rect width="24" height="24" rx="6" fill="#1877F2" />
          <path
            d="M13.4 19v-6h2l.4-2.4h-2.4V9.1c0-.7.2-1.16 1.2-1.16h1.27V5.8c-.22-.03-.98-.1-1.86-.1-1.84 0-3.1 1.12-3.1 3.18v1.72H8.5V13h2.4v6h2.5z"
            fill="#fff"
          />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <rect width="24" height="24" rx="6" fill="#000" />
          <path
            d="M14.2 5h2.06l-4.5 5.14L17 19h-4.13l-3.24-4.24L5.92 19H3.85l4.81-5.5L4 5h4.24l2.93 3.87L14.2 5zm-.72 12.75h1.14L8.6 6.18H7.37l6.11 11.57z"
            fill="#fff"
          />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...common}>
          <rect width="24" height="24" rx="6" fill="#0A66C2" />
          <path
            d="M8.34 9.5v8.2H5.6V9.5h2.74zM6.97 5.5a1.59 1.59 0 1 1 0 3.18 1.59 1.59 0 0 1 0-3.18zM10.06 9.5h2.63v1.12h.04c.37-.7 1.26-1.43 2.6-1.43 2.78 0 3.29 1.83 3.29 4.2v4.31h-2.74v-3.82c0-.91-.02-2.08-1.27-2.08-1.27 0-1.46.99-1.46 2.01v3.89h-2.73V9.5z"
            fill="#fff"
          />
        </svg>
      );
    case "twitch":
      return (
        <svg {...common}>
          <rect width="24" height="24" rx="6" fill="#9146FF" />
          <path
            d="M7.2 5.5 6 8v8h2.7v1.7L10.5 16h2.3L17 11.8V5.5H7.2zm8.3 5.7-1.6 1.6h-2.3l-1.4 1.4v-1.4H8.4V6.7h7.1v4.5z"
            fill="#fff"
          />
          <path d="M13.8 8.2h1.1v3h-1.1zm-3 0h1.1v3h-1.1z" fill="#9146FF" />
        </svg>
      );
    case "rumble":
      return (
        <svg {...common}>
          <rect width="24" height="24" rx="6" fill="#85C742" />
          <path
            d="M8 6.4c4.6.3 8.3 4 8.6 8.6.06.95-1.07 1.45-1.7.74a10.4 10.4 0 0 0-6.38-3.36c-.93-.13-1.4-1.26-.72-1.9l.2-.2c-.65-.66-.18-1.8.76-1.7l-.76-2.32z"
            fill="#fff"
            transform="rotate(8 12 12)"
          />
          <circle cx="10.2" cy="13.6" r="2.4" fill="#85C742" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect width="24" height="24" rx="6" fill="#26323f" />
        </svg>
      );
  }
}
