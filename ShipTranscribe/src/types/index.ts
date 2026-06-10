export interface Video {
  id: string;
  name: string;
  file_path: string;
  duration_secs: number;
  file_size: number;
  added_at: string;
  transcribed_at: string | null;
  status: 'pending' | 'extracting' | 'transcribing' | 'completed' | 'error';
  group_id: string | null;
  transcript_txt: string | null;
  transcript_srt: string | null;
  thumbnail_path: string | null;
  error_message: string | null;
}

export interface Group {
  id: string;
  name: string;
  created_at: string;
}

export interface AppData {
  videos: Video[];
  groups: Group[];
}

export interface TranscribeEvent {
  video_id: string;
  status: string;
  progress: number;
  message: string;
}

export type View = 'home' | 'gallery' | 'viewer';
