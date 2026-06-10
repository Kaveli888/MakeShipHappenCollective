import { Home, FolderOpen, Upload, Crown } from 'lucide-react';
import MshLogo from './MshLogo';
import { useAppStore } from '@/lib/stores/useAppStore';
import type { View } from '@/types';

const navItems: { view: View; icon: typeof Home; label: string }[] = [
  { view: 'home', icon: Home, label: 'Home' },
  { view: 'gallery', icon: FolderOpen, label: 'Gallery' },
];

export default function Sidebar() {
  const { view, setView, selectedVideoId, selectVideo } = useAppStore();

  const handleNav = (v: View) => {
    if (v !== 'viewer') {
      selectVideo(null);
    }
    setView(v);
  };

  return (
    <aside
      className="flex flex-col items-center py-4 gap-2 border-r h-full"
      style={{
        width: 68,
        minWidth: 68,
        background: 'var(--bg-elevated)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Logo */}
      <div className="mb-4 mt-1">
        <MshLogo size={40} />
      </div>

      {/* Nav Items */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map(({ view: v, icon: Icon, label }) => {
          const active = view === v && !selectedVideoId;
          return (
            <button
              key={v}
              onClick={() => handleNav(v)}
              title={label}
              className="relative flex items-center justify-center rounded-xl transition-all duration-200"
              style={{
                width: 44,
                height: 44,
                background: active ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                color: active ? '#818cf8' : 'var(--text-muted)',
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              {active && (
                <div
                  className="absolute left-0 rounded-r-full"
                  style={{
                    width: 3,
                    height: 20,
                    background: 'linear-gradient(180deg, var(--gradient-start), var(--gradient-end))',
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Pro Badge */}
      <div className="mb-2 flex flex-col items-center gap-2">
        <div
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 44,
            height: 44,
            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.15), rgba(234, 179, 8, 0.05))',
            border: '1px solid rgba(234, 179, 8, 0.2)',
          }}
          title="Pro Membership"
        >
          <Crown size={18} style={{ color: '#eab308' }} />
        </div>
        <span style={{ fontSize: 9, color: '#eab308', fontWeight: 700, letterSpacing: '0.08em' }}>
          PRO
        </span>
      </div>
    </aside>
  );
}
