import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  FolderPlus,
  FileVideo,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Edit3,
  FolderInput,
  X,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '@/lib/stores/useAppStore';
import type { Video, Group } from '@/types';

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
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function VideoCard({
  video,
  groups,
  progress,
  onSelect,
  onAssignGroup,
  onDelete,
}: {
  video: Video;
  groups: Group[];
  progress?: { progress: number; message: string };
  onSelect: () => void;
  onAssignGroup: (groupId: string | null) => void;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const isActive = video.status === 'extracting' || video.status === 'transcribing';
  const pct = progress ? Math.round(progress.progress * 100) : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass-card overflow-hidden cursor-pointer group relative"
      onClick={onSelect}
    >
      {/* Thumbnail */}
      <div
        className="relative w-full flex items-center justify-center overflow-hidden"
        style={{
          height: 140,
          background: video.thumbnail_path
            ? `url(asset://localhost/${encodeURIComponent(video.thumbnail_path)}) center/cover`
            : 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1))',
        }}
      >
        {!video.thumbnail_path && <FileVideo size={32} style={{ color: 'var(--text-muted)' }} />}

        {/* Status badge */}
        <div
          className="absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5"
          style={{
            fontSize: 10,
            fontWeight: 600,
            background:
              video.status === 'completed'
                ? 'rgba(34, 197, 94, 0.2)'
                : video.status === 'error'
                ? 'rgba(239, 68, 68, 0.2)'
                : isActive
                ? 'rgba(99, 102, 241, 0.25)'
                : 'rgba(255, 255, 255, 0.1)',
            color:
              video.status === 'completed'
                ? 'var(--success)'
                : video.status === 'error'
                ? 'var(--error)'
                : isActive
                ? '#818cf8'
                : 'var(--text-secondary)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {video.status === 'completed' ? (
            <CheckCircle2 size={10} />
          ) : video.status === 'error' ? (
            <AlertCircle size={10} />
          ) : isActive ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <Clock size={10} />
          )}
          {isActive && progress ? `${pct}%` : video.status}
        </div>

        {/* Progress bar overlay at bottom of thumbnail */}
        {isActive && progress && (
          <div className="absolute bottom-0 left-0 right-0" style={{ height: 3 }}>
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #6366f1, #a855f7)',
                boxShadow: '0 0 8px rgba(99,102,241,0.4)',
                transition: 'width 0.5s ease',
                borderRadius: '0 1px 0 0',
              }}
            />
          </div>
        )}

        {/* Duration */}
        {video.duration_secs > 0 && (
          <div
            className="absolute bottom-2 right-2 rounded px-1.5 py-0.5"
            style={{
              fontSize: 10,
              fontWeight: 600,
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(4px)',
            }}
          >
            {formatDuration(video.duration_secs)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-medium truncate mb-1" style={{ fontSize: 13 }}>
          {video.name}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {formatFileSize(video.file_size)}
        </p>
      </div>

      {/* Context menu button */}
      <button
        className="absolute top-2 left-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        style={{
          width: 28,
          height: 28,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          border: 'none',
          cursor: 'pointer',
          color: 'white',
        }}
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
          setShowGroupPicker(false);
        }}
      >
        <MoreHorizontal size={14} />
      </button>

      {/* Context Menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-10 left-2 rounded-xl overflow-hidden z-10"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              minWidth: 160,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors"
              style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { setShowGroupPicker(true); setShowMenu(false); }}
            >
              <FolderInput size={13} /> Move to group
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors"
              style={{ fontSize: 12, color: 'var(--error)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { onDelete(); setShowMenu(false); }}
            >
              <Trash2 size={13} /> Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Group Picker */}
      <AnimatePresence>
        {showGroupPicker && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-10 left-2 rounded-xl overflow-hidden z-10"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              minWidth: 160,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors"
              style={{ fontSize: 12, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { onAssignGroup(null); setShowGroupPicker(false); }}
            >
              <X size={13} /> No group
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors"
                style={{
                  fontSize: 12,
                  color: video.group_id === g.id ? 'var(--accent-hover)' : 'var(--text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { onAssignGroup(g.id); setShowGroupPicker(false); }}
              >
                <FolderOpen size={13} /> {g.name}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function GalleryView() {
  const { videos, groups, searchQuery, setSearchQuery, addGroup, removeVideo, removeGroup, updateVideo, selectVideo, liveProgress } = useAppStore();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = videos.filter((v) =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const ungrouped = filtered.filter((v) => !v.group_id);
  const grouped = groups.map((g) => ({
    ...g,
    videos: filtered.filter((v) => v.group_id === g.id),
  }));

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const group: Group = await invoke('create_group', { name: newGroupName.trim() });
      addGroup(group);
      setNewGroupName('');
      setShowNewGroup(false);
      setExpandedGroups((prev) => new Set([...prev, group.id]));
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  const handleAssignGroup = async (videoId: string, groupId: string | null) => {
    try {
      await invoke('assign_group', { videoId, groupId });
      updateVideo(videoId, { group_id: groupId });
    } catch (err) {
      console.error('Failed to assign group:', err);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    try {
      await invoke('delete_video', { videoId });
      removeVideo(videoId);
    } catch (err) {
      console.error('Failed to delete video:', err);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await invoke('delete_group', { groupId });
      removeGroup(groupId);
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2
          className="font-display font-bold"
          style={{
            fontSize: 24,
            background: 'linear-gradient(135deg, #fff, #a1a1aa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Gallery
        </h2>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div
            className="flex items-center gap-2 rounded-lg px-3"
            style={{
              height: 36,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
            }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none"
              style={{ fontSize: 13, color: 'var(--text-primary)', width: 180 }}
            />
          </div>

          {/* New Group */}
          <button className="btn-ghost" style={{ height: 36, padding: '0 14px', fontSize: 13 }} onClick={() => setShowNewGroup(true)}>
            <FolderPlus size={15} /> New Group
          </button>
        </div>
      </div>

      {/* New Group Input */}
      <AnimatePresence>
        {showNewGroup && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-panel p-4 flex items-center gap-3"
          >
            <FolderOpen size={18} style={{ color: 'var(--accent-hover)' }} />
            <input
              autoFocus
              type="text"
              placeholder="Group name (e.g. Spider-Man Movies)"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
              className="flex-1 bg-transparent border-none outline-none"
              style={{ fontSize: 14, color: 'var(--text-primary)' }}
            />
            <button className="btn-primary" style={{ height: 32, padding: '0 14px', fontSize: 12 }} onClick={handleCreateGroup}>
              Create
            </button>
            <button
              className="btn-ghost"
              style={{ height: 32, padding: '0 10px', fontSize: 12 }}
              onClick={() => { setShowNewGroup(false); setNewGroupName(''); }}
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Groups */}
      {grouped
        .filter((g) => g.videos.length > 0)
        .map((group) => {
          const expanded = expandedGroups.has(group.id);
          return (
            <div key={group.id} className="space-y-3">
              <button
                className="flex items-center gap-2 w-full text-left"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
                onClick={() => toggleGroup(group.id)}
              >
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <FolderOpen size={16} style={{ color: 'var(--accent-hover)' }} />
                <span className="font-semibold" style={{ fontSize: 15 }}>{group.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
                  {group.videos.length} video{group.videos.length !== 1 ? 's' : ''}
                </span>
                <button
                  className="ml-auto"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                  onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                  title="Delete group"
                >
                  <Trash2 size={13} />
                </button>
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid gap-4 pl-6"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
                  >
                    {group.videos.map((video) => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        groups={groups}
                        progress={liveProgress[video.id]}
                        onSelect={() => video.status === 'completed' && selectVideo(video.id)}
                        onAssignGroup={(gid) => handleAssignGroup(video.id, gid)}
                        onDelete={() => handleDeleteVideo(video.id)}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

      {/* Ungrouped */}
      {ungrouped.length > 0 && (
        <div className="space-y-3">
          {grouped.some((g) => g.videos.length > 0) && (
            <p className="font-semibold" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Ungrouped
            </p>
          )}
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
          >
            {ungrouped.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                groups={groups}
                progress={liveProgress[video.id]}
                onSelect={() => video.status === 'completed' && selectVideo(video.id)}
                onAssignGroup={(gid) => handleAssignGroup(video.id, gid)}
                onDelete={() => handleDeleteVideo(video.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {videos.length === 0 && (
        <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
          <FolderOpen size={40} className="mx-auto mb-4" style={{ opacity: 0.3 }} />
          <p className="font-medium mb-1">No videos yet</p>
          <p style={{ fontSize: 13 }}>Upload a video from the Home page to get started</p>
        </div>
      )}
    </div>
  );
}
