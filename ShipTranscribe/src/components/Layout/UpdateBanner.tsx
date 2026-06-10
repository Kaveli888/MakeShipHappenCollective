import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface UpdateCheckResult {
  available: boolean;
  version?: string;
  current_version?: string;
  body?: string;
}

export default function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateCheckResult | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Delay check so it doesn't slow down startup
    const timer = setTimeout(async () => {
      try {
        const result = await invoke<UpdateCheckResult>('check_for_updates');
        if (result.available) {
          setUpdate(result);
        }
      } catch {
        // Silently ignore — network errors are expected in offline environments
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!update?.available || dismissed) return null;

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      await invoke('install_update');
      // App will restart — this line is never reached on success
    } catch (e) {
      setError('Update failed. Please try again.');
      setInstalling(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 10px',
        height: 28,
        borderRadius: 6,
        background: 'var(--bg-base, #1a1a2e)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        fontSize: 12,
        flexShrink: 0,
      }}
    >
      {error ? (
        <span style={{ color: '#f87171' }}>{error}</span>
      ) : installing ? (
        <span style={{ color: 'var(--text-secondary, #888)' }}>
          Installing v{update.version}… App will restart shortly.
        </span>
      ) : (
        <>
          <span style={{ color: 'var(--text-secondary, #888)' }}>
            v{update.version} available
          </span>
          <button
            onClick={handleInstall}
            style={{
              background: 'var(--accent, #6366f1)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              lineHeight: '18px',
            }}
          >
            Update &amp; Restart
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary, #888)',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
              padding: '0 2px',
            }}
            aria-label="Dismiss update notification"
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}
