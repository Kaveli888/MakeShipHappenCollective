import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import AppShell from '@/components/Layout/AppShell';
import HomePage from '@/components/Home/HomePage';
import GalleryView from '@/components/Gallery/GalleryView';
import TranscriptViewer from '@/components/Viewer/TranscriptViewer';
import { useAppStore } from '@/lib/stores/useAppStore';
import type { AppData, TranscribeEvent } from '@/types';

export default function App() {
  const { view, selectedVideoId, setVideos, setGroups, setLiveProgress, clearLiveProgress, updateVideo } = useAppStore();

  // Load data on mount + listen for global progress events
  useEffect(() => {
    invoke<AppData>('get_all_data')
      .then((data) => {
        setVideos(data.videos);
        setGroups(data.groups);
      })
      .catch(console.error);

    invoke('check_dependencies')
      .then((deps: any) => {
        console.log('Dependencies:', deps);
      })
      .catch(console.error);

    // Global listener for transcription progress — feeds all views
    const unlistenPromise = listen<TranscribeEvent>('transcribe-progress', (event) => {
      const { video_id, status, progress, message } = event.payload;

      // Update live progress for all views to see
      setLiveProgress(video_id, progress, message);

      // Update video status in store
      if (status === 'extracting' || status === 'transcribing') {
        updateVideo(video_id, { status: status as any });
      }

      // On completion or error, refresh full data and clear progress
      if (status === 'completed' || status === 'error') {
        invoke<AppData>('get_all_data').then((data) => {
          const updated = data.videos.find((v) => v.id === video_id);
          if (updated) updateVideo(video_id, updated);
        });

        setTimeout(() => {
          clearLiveProgress(video_id);
        }, 3000);
      }
    });

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  const renderContent = () => {
    if (selectedVideoId) return <TranscriptViewer />;
    switch (view) {
      case 'gallery':
        return <GalleryView />;
      case 'home':
      default:
        return <HomePage />;
    }
  };

  return <AppShell>{renderContent()}</AppShell>;
}
