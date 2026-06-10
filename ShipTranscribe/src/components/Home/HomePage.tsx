import { useCallback, useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { motion } from 'framer-motion';
import {
  Upload,
  FileVideo,
  Zap,
  Shield,
  HardDrive,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '@/lib/stores/useAppStore';
import type { Video, TranscribeEvent } from '@/types';
import { listen } from '@tauri-apps/api/event';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function HomePage() {
  const { videos, addVideo, updateVideo, setView, selectVideo } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const [activeTranscriptions, setActiveTranscriptions] = useState<
    Record<string, { progress: number; message: string }>
  >({});
  const listenersRef = useRef<Set<string>>(new Set());

  const handleImportAndTranscribe = useCallback(
    async (filePath: string) => {
      try {
        const video: Video = await invoke('import_video', { filePath });
        addVideo(video);

        // Set up progress listener for this video
        if (!listenersRef.current.has(video.id)) {
          listenersRef.current.add(video.id);

          const unlisten = await listen<TranscribeEvent>('transcribe-progress', (event) => {
            if (event.payload.video_id === video.id) {
              setActiveTranscriptions((prev) => ({
                ...prev,
                [video.id]: {
                  progress: event.payload.progress,
                  message: event.payload.message,
                },
              }));

              if (event.payload.status === 'completed' || event.payload.status === 'error') {
                // Refresh video data
                invoke<{ videos: Video[] }>('get_all_data').then((data) => {
                  const updated = data.videos.find((v) => v.id === video.id);
                  if (updated) {
                    updateVideo(video.id, updated);
                  }
                });

                setTimeout(() => {
                  setActiveTranscriptions((prev) => {
                    const next = { ...prev };
                    delete next[video.id];
                    return next;
                  });
                  listenersRef.current.delete(video.id);
                  unlisten();
                }, 3000);
              }
            }
          });
        }

        // Start transcription
        invoke('start_transcription', { videoId: video.id }).catch((err) => {
          updateVideo(video.id, { status: 'error', error_message: String(err) });
        });
      } catch (err) {
        console.error('Import failed:', err);
      }
    },
    [addVideo, updateVideo]
  );

  const handleFilePick = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Video',
            extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v', 'ts', 'mpg', 'mpeg'],
          },
        ],
      });

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        for (const p of paths) {
          if (p) handleImportAndTranscribe(p);
        }
      }
    } catch (err) {
      console.error('File picker error:', err);
    }
  };

  // Tauri native drag-and-drop (browser drag events don't provide file paths in Tauri)
  useEffect(() => {
    const currentWindow = getCurrentWindow();
    const unlisten = currentWindow.onDragDropEvent((event) => {
      if (event.payload.type === 'over') {
        setIsDragging(true);
      } else if (event.payload.type === 'leave') {
        setIsDragging(false);
      } else if (event.payload.type === 'drop') {
        setIsDragging(false);
        const paths = event.payload.paths;
        const videoExts = /\.(mp4|mkv|avi|mov|webm|flv|wmv|m4v|ts|mpg|mpeg)$/i;
        for (const p of paths) {
          if (videoExts.test(p)) {
            handleImportAndTranscribe(p);
          }
        }
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [handleImportAndTranscribe]);

  const recentVideos = [...videos]
    .sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime())
    .slice(0, 6);

  const completedCount = videos.filter((v) => v.status === 'completed').length;
  const activeCount = videos.filter((v) => v.status === 'extracting' || v.status === 'transcribing').length;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center pt-8 pb-4"
      >
        <h1
          className="font-display font-bold mb-3"
          style={{
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            background: 'linear-gradient(135deg, #fff 0%, #a1a1aa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.03em',
          }}
        >
          Transcribe Any Video
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>
          Drop a video, get a perfect transcript. Local AI, unlimited length, zero cost.
        </p>
      </motion.div>

      {/* Stats Strip */}
      <div className="flex justify-center gap-8">
        {[
          { icon: CheckCircle2, label: 'Transcribed', value: completedCount, color: 'var(--success)' },
          { icon: Loader2, label: 'Active', value: activeCount, color: 'var(--accent)' },
          { icon: FileVideo, label: 'Total', value: videos.length, color: 'var(--text-secondary)' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="flex items-center gap-2" style={{ color }}>
            <Icon size={16} />
            <span className="font-semibold" style={{ fontSize: 20 }}>{value}</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Upload Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div
          className={`drop-zone ${isDragging ? 'active' : ''} cursor-pointer`}
          onClick={handleFilePick}
          style={{ padding: '48px 24px', textAlign: 'center' }}
        >
          <div
            className="mx-auto mb-4 flex items-center justify-center rounded-2xl"
            style={{
              width: 64,
              height: 64,
              background: isDragging
                ? 'rgba(99, 102, 241, 0.15)'
                : 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border)',
            }}
          >
            <Upload
              size={28}
              style={{
                color: isDragging ? 'var(--accent-hover)' : 'var(--text-muted)',
                transition: 'color 0.2s',
              }}
            />
          </div>
          <p className="font-semibold mb-1" style={{ fontSize: 16, color: 'var(--text-primary)' }}>
            Drop videos here or click to browse
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            MP4, MKV, AVI, MOV, WebM — any format, any length
          </p>
        </div>
      </motion.div>

      {/* Active Transcriptions */}
      {Object.keys(activeTranscriptions).length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Active Transcriptions
          </h3>
          {Object.entries(activeTranscriptions).map(([id, { progress, message }]) => {
            const video = videos.find((v) => v.id === id);
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium" style={{ fontSize: 14 }}>
                    {video?.name || 'Processing...'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--accent-hover)' }}>
                    {Math.round(progress * 100)}%
                  </span>
                </div>
                <div className="progress-bar mb-2">
                  <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{message}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Features */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Zap, title: 'GPU Accelerated', desc: 'Metal-powered AI runs at native speed' },
          { icon: Shield, title: '100% Private', desc: 'Everything stays on your machine' },
          { icon: HardDrive, title: 'Unlimited', desc: 'No limits on file size or duration' },
        ].map(({ icon: Icon, title, desc }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
            className="glass-panel p-5 text-center"
          >
            <Icon size={22} style={{ color: 'var(--accent-hover)', margin: '0 auto 10px' }} />
            <p className="font-semibold mb-1" style={{ fontSize: 14 }}>{title}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent Videos */}
      {recentVideos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Recent
            </h3>
            {videos.length > 6 && (
              <button
                onClick={() => setView('gallery')}
                className="text-sm font-medium"
                style={{ color: 'var(--accent-hover)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                View all
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {recentVideos.map((video, i) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
                className="glass-card p-4 cursor-pointer"
                onClick={() => video.status === 'completed' && selectVideo(video.id)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="shrink-0 rounded-lg flex items-center justify-center overflow-hidden"
                    style={{
                      width: 48,
                      height: 48,
                      background: video.thumbnail_path
                        ? `url(asset://localhost/${encodeURIComponent(video.thumbnail_path)}) center/cover`
                        : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    {!video.thumbnail_path && <FileVideo size={20} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate" style={{ fontSize: 13 }}>
                      {video.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {video.status === 'completed' ? (
                        <CheckCircle2 size={12} style={{ color: 'var(--success)' }} />
                      ) : video.status === 'error' ? (
                        <AlertCircle size={12} style={{ color: 'var(--error)' }} />
                      ) : (
                        <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {formatDuration(video.duration_secs)} · {formatFileSize(video.file_size)}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
