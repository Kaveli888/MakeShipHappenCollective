import type { ReactNode } from 'react';

export type AccountTier = 'free' | 'pro' | 'team' | (string & {});

export interface AccountUser {
  email: string;
  displayName?: string | null;
  initials: string;
}

export interface AccountMenuItem {
  id: string;
  label: string;
  icon: 'credit-card' | 'user' | 'cog' | 'help' | 'logout' | 'sparkles';
  onSelect: () => void;
  danger?: boolean;
}

export interface AccountMenuProps {
  user: AccountUser;
  tier: AccountTier;
  tierLabel?: string;
  items: AccountMenuItem[];
  onOpen?: () => void;
  accentColor?: string;
  align?: 'left' | 'right';
  placement?: 'down' | 'up';
  /**
   * Optional content rendered inside the menu panel between the header
   * and the items list. Hosts use this to embed app-specific UI (e.g. a
   * theme picker).
   */
  extraContent?: ReactNode;
  /**
   * Trigger button style.
   * - `filled` (default): solid circle filled with accentColor, white initials.
   * - `outlined`: small rounded square with a faint border, transparent
   *   background, and muted-white initials. Useful when the avatar lives
   *   in a row of stroke-style icon buttons.
   */
  variant?: 'filled' | 'outlined';
}

export interface AccountButtonProps extends AccountMenuProps {
  buttonSize?: number;
}
