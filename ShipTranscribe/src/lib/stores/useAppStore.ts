import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Video, Group, View } from '@/types';

interface ProgressInfo {
  progress: number;
  message: string;
}

interface AppState {
  view: View;
  videos: Video[];
  groups: Group[];
  selectedVideoId: string | null;
  searchQuery: string;
  liveProgress: Record<string, ProgressInfo>;
  setView: (view: View) => void;
  setVideos: (videos: Video[]) => void;
  setGroups: (groups: Group[]) => void;
  addVideo: (video: Video) => void;
  updateVideo: (id: string, updates: Partial<Video>) => void;
  removeVideo: (id: string) => void;
  addGroup: (group: Group) => void;
  removeGroup: (id: string) => void;
  selectVideo: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setLiveProgress: (videoId: string, progress: number, message: string) => void;
  clearLiveProgress: (videoId: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      view: 'home',
      videos: [],
      groups: [],
      selectedVideoId: null,
      searchQuery: '',
      liveProgress: {},
      setView: (view) => set({ view }),
      setVideos: (videos) => set({ videos }),
      setGroups: (groups) => set({ groups }),
      addVideo: (video) => set((s) => ({ videos: [...s.videos, video] })),
      updateVideo: (id, updates) =>
        set((s) => ({
          videos: s.videos.map((v) => (v.id === id ? { ...v, ...updates } : v)),
        })),
      removeVideo: (id) =>
        set((s) => ({
          videos: s.videos.filter((v) => v.id !== id),
          selectedVideoId: s.selectedVideoId === id ? null : s.selectedVideoId,
        })),
      addGroup: (group) => set((s) => ({ groups: [...s.groups, group] })),
      removeGroup: (id) =>
        set((s) => ({
          groups: s.groups.filter((g) => g.id !== id),
          videos: s.videos.map((v) =>
            v.group_id === id ? { ...v, group_id: null } : v
          ),
        })),
      selectVideo: (id) =>
        set({ selectedVideoId: id, view: id ? 'viewer' : 'gallery' }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setLiveProgress: (videoId, progress, message) =>
        set((s) => ({
          liveProgress: { ...s.liveProgress, [videoId]: { progress, message } },
        })),
      clearLiveProgress: (videoId) =>
        set((s) => {
          const next = { ...s.liveProgress };
          delete next[videoId];
          return { liveProgress: next };
        }),
    }),
    {
      name: 'shiptranscribe-app',
      partialize: (state) => ({
        view: state.view,
        selectedVideoId: state.selectedVideoId,
      }),
    }
  )
);
