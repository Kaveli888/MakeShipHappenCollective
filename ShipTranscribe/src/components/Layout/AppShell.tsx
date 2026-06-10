import Sidebar from './Sidebar';
import UpdateBanner from './UpdateBanner';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden app-glow" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Title bar drag region */}
        <div
          data-tauri-drag-region
          className="flex items-center justify-between px-6 shrink-0"
          style={{
            height: 52,
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
          }}
        >
          <div data-tauri-drag-region className="flex items-center gap-3 flex-1">
            {/* macOS traffic lights spacer */}
            <div style={{ width: 70 }} />
            <h1
              data-tauri-drag-region
              className="font-semibold"
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                letterSpacing: '0.02em',
              }}
            >
              ShipTranscript
            </h1>
          </div>
          <UpdateBanner />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
