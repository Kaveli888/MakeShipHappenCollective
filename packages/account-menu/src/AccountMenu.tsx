import React, { useEffect, useRef, useState } from 'react';
import { iconFor } from './icons';
import type { AccountButtonProps, AccountTier } from './types';

const DEFAULT_ACCENT = '#7c5bf0';

function defaultTierLabel(tier: AccountTier): string {
  if (tier === 'pro') return 'Pro';
  if (tier === 'team') return 'Team';
  if (tier === 'free') return 'Free';
  return String(tier).charAt(0).toUpperCase() + String(tier).slice(1);
}

export function AccountButton(props: AccountButtonProps) {
  const {
    user,
    tier,
    tierLabel,
    items,
    onOpen,
    accentColor = DEFAULT_ACCENT,
    align = 'right',
    placement = 'down',
    buttonSize = 28,
    extraContent,
    variant = 'filled',
  } = props;

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    onOpen?.();

    function onDocMouseDown(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpen]);

  const label = tierLabel ?? defaultTierLabel(tier);

  return (
    <div ref={wrapperRef} style={styles.wrapper}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open account menu"
        title={user.displayName || user.email}
        style={
          variant === 'outlined'
            ? {
                ...styles.avatarButton,
                width: buttonSize,
                height: buttonSize,
                borderRadius: 6,
                background: open
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.55)',
                outline: 'none',
              }
            : {
                ...styles.avatarButton,
                width: buttonSize,
                height: buttonSize,
                background: accentColor,
                outline: open ? `2px solid ${accentColor}66` : 'none',
                outlineOffset: 2,
              }
        }
      >
        <span style={styles.initials}>{user.initials}</span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            ...styles.panel,
            top: placement === 'up' ? undefined : 'calc(100% + 8px)',
            bottom: placement === 'up' ? 'calc(100% + 8px)' : undefined,
            [align === 'right' ? 'right' : 'left']: 0,
          }}
        >
          <div style={styles.header}>
            <div style={{ ...styles.headerAvatar, background: accentColor }}>
              <span style={styles.initials}>{user.initials}</span>
            </div>
            <div style={styles.headerText}>
              {user.displayName && (
                <div style={styles.name}>{user.displayName}</div>
              )}
              <div style={styles.email}>{user.email}</div>
            </div>
            <div
              style={{
                ...styles.tierBadge,
                color: accentColor,
                borderColor: `${accentColor}66`,
                background: `${accentColor}14`,
              }}
            >
              {label}
            </div>
          </div>

          <div style={styles.divider} />

          {extraContent && (
            <>
              <div style={styles.extra}>{extraContent}</div>
              <div style={styles.divider} />
            </>
          )}

          <div style={styles.items}>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                style={{
                  ...styles.item,
                  color: item.danger ? '#f87171' : '#e4e4e7',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <span style={styles.itemIcon}>{iconFor(item.icon)}</span>
                <span style={styles.itemLabel}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
    display: 'inline-block',
  },
  avatarButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    padding: 0,
    transition: 'outline-color 0.15s ease',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  initials: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.3,
    lineHeight: 1,
    userSelect: 'none',
    textTransform: 'uppercase',
  },
  panel: {
    position: 'absolute',
    minWidth: 360,
    background: '#1a1a1f',
    border: '1px solid #2a2a30',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    padding: 6,
    zIndex: 1000,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 10px 10px 8px',
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: '#e4e4e7',
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  email: {
    color: '#a1a1aa',
    fontSize: 12,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  tierBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 8px',
    border: '1px solid',
    borderRadius: 999,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  divider: {
    height: 1,
    background: '#2a2a30',
    margin: '4px 0',
  },
  extra: {
    padding: '6px 8px 8px',
  },
  items: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    background: 'transparent',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: 13,
    transition: 'background 0.12s ease',
  },
  itemIcon: {
    width: 16,
    height: 16,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#a1a1aa',
    flexShrink: 0,
  },
  itemLabel: {
    flex: 1,
  },
};

export function deriveInitials(input: {
  displayName?: string | null;
  email: string;
}): string {
  const source = (input.displayName || input.email || '').trim();
  if (!source) return '?';
  const atIdx = source.indexOf('@');
  const local = atIdx > -1 ? source.slice(0, atIdx) : source;
  const parts = local.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}
