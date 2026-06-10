import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Copy,
  Check,
  Download,
  FileText,
  Subtitles,
  Clock,
  HardDrive,
  Calendar,
  FolderOpen,
  Search,
  X,
  BookOpen,
  Type,
  Hash,
  Sparkles,
  Play,
  Minus,
  Plus,
  MessageSquareText,
  Tag,
} from 'lucide-react';
import { useAppStore } from '@/lib/stores/useAppStore';

// ── Helpers ──────────────────────────────────────────────────────────────

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ── Stop words for topic extraction ──────────────────────────────────────
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','it','as',
  'was','are','be','been','being','have','has','had','do','does','did','will','would','could','should',
  'may','might','shall','can','this','that','these','those','i','you','he','she','we','they','me',
  'him','her','us','them','my','your','his','its','our','their','what','which','who','whom','when',
  'where','why','how','all','each','every','both','few','more','most','other','some','such','no',
  'not','only','same','so','than','too','very','just','about','above','after','again','also','am',
  'any','because','before','between','come','get','go','got','if','into','know','like','make','made',
  'much','new','now','one','out','over','own','put','really','right','said','say','see','still',
  'take','tell','then','there','thing','things','think','through','time','up','want','way','well',
  'went','were','going','actually','pretty','kind','lot','yeah','okay','um','uh','oh','ah','gonna',
  'wanna','gotta','cause','something','anything','everything','nothing','even','back','look','here',
  'let','don','didn','doesn','won','wouldn','couldn','shouldn','isn','aren','wasn','weren','t','s',
  're','ve','ll','d','m','people','much','many','good','bad','first','last','long','great','little',
  'old','big','high','small','large','next','early','young','important','different','two','three',
]);

// ── Three-act summarization engine (local, no API) ───────────────────────

interface ActSummary {
  label: string;
  summary: string;
  color: string;
}

interface SummaryResult {
  acts: ActSummary[];     // Beginning, Middle, End breakdowns
  topics: string[];       // Key topic tags
}

function scoreSentences(sentences: string[], wordScore: Record<string, number>): { sentence: string; score: number }[] {
  return sentences.map((sentence) => {
    const words = sentence.toLowerCase().replace(/[^a-z\s'-]/g, '').split(/\s+/).filter((w) => w.length > 3);
    const contentWords = words.filter((w) => !STOP_WORDS.has(w));
    const keywordAvg = contentWords.length > 0
      ? contentWords.reduce((sum, w) => sum + (wordScore[w] || 0), 0) / contentWords.length
      : 0;
    const idealLen = 120;
    const lengthScore = 1 - Math.min(Math.abs(sentence.length - idealLen) / 200, 0.5);
    const densityScore = words.length > 0 ? contentWords.length / words.length : 0;
    const score = (keywordAvg * 0.5) + (lengthScore * 0.2) + (densityScore * 0.3);
    return { sentence, score };
  });
}

function pickTopSentences(scored: { sentence: string; score: number }[], count: number): string {
  const top = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
  // Re-sort by original order for coherence
  const ordered = scored.filter((s) => top.includes(s));
  const text = ordered.map((s) => s.sentence).join(' ');
  return text.length > 300 ? text.slice(0, text.lastIndexOf(' ', 300)) + '...' : text;
}

function generateSummary(text: string): SummaryResult {
  const empty: SummaryResult = { acts: [], topics: [] };
  if (!text || text.trim().length < 50) return empty;

  const cleaned = text.replace(/\r\n/g, '\n');

  // ── Split into sentences ──────────────────────────────────────────
  let allSentences = cleaned
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && s.length < 400 && /[a-zA-Z]/.test(s));

  if (allSentences.length === 0) {
    // Fallback for unpunctuated transcripts (common with whisper)
    allSentences = cleaned.split('\n').map((l) => l.trim()).filter((l) => l.length > 15);
    if (allSentences.length === 0) return empty;
  }

  // ── Build word importance map ─────────────────────────────────────
  const allWords = cleaned.toLowerCase().replace(/[^a-z\s'-]/g, '').split(/\s+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w));
  const wordFreq: Record<string, number> = {};
  for (const w of allWords) wordFreq[w] = (wordFreq[w] || 0) + 1;
  const maxFreq = Math.max(...Object.values(wordFreq), 1);
  const wordScore: Record<string, number> = {};
  for (const [w, f] of Object.entries(wordFreq)) wordScore[w] = f / maxFreq;

  // ── Divide into three acts ────────────────────────────────────────
  const total = allSentences.length;
  const third = Math.max(1, Math.floor(total / 3));

  const beginSlice = allSentences.slice(0, third);
  const middleSlice = allSentences.slice(third, third * 2);
  const endSlice = allSentences.slice(third * 2);

  // Score each act independently
  const beginScored = scoreSentences(beginSlice, wordScore);
  const middleScored = scoreSentences(middleSlice, wordScore);
  const endScored = scoreSentences(endSlice, wordScore);

  // Pick best 2-3 sentences per act
  const pickCount = Math.max(2, Math.min(3, Math.ceil(third * 0.15)));

  const acts: ActSummary[] = [
    {
      label: 'The Setup',
      summary: pickTopSentences(beginScored, pickCount),
      color: '#818cf8',
    },
    {
      label: 'The Core',
      summary: pickTopSentences(middleScored, pickCount),
      color: '#a78bfa',
    },
    {
      label: 'The Takeaway',
      summary: pickTopSentences(endScored, pickCount),
      color: '#c084fc',
    },
  ].filter((a) => a.summary.length > 0);

  // ── Extract topics ────────────────────────────────────────────────
  const topWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const seen = new Set<string>();
  const topics: string[] = [];
  for (const [word] of topWords) {
    const stem = word.slice(0, Math.min(word.length, 5));
    if (!seen.has(stem)) {
      seen.add(stem);
      topics.push(word.charAt(0).toUpperCase() + word.slice(1));
      if (topics.length >= 6) break;
    }
  }

  return { acts, topics };
}

// ── Circular Progress Ring ───────────────────────────────────────────────
function ProgressRing({ value, max, size = 52, label, color }: { value: number; max: number; size?: number; label: string; color: string }) {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(value / max, 1);
  const offset = circumference - progress * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease', filter: `drop-shadow(0 0 4px ${color}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span style={{ fontSize: 11, fontWeight: 700, color }}>{value > 999 ? `${(value / 1000).toFixed(1)}k` : value}</span>
        </div>
      </div>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</span>
    </div>
  );
}

// ── Topic Tag ────────────────────────────────────────────────────────────
const TAG_COLORS = ['#818cf8', '#a78bfa', '#c084fc', '#f472b6', '#fb923c', '#34d399'];

function TopicTag({ label, index }: { label: string; index: number }) {
  const color = TAG_COLORS[index % TAG_COLORS.length];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-all duration-200"
      style={{
        fontSize: 10,
        fontWeight: 600,
        color,
        background: `${color}12`,
        border: `1px solid ${color}25`,
        letterSpacing: '0.02em',
        cursor: 'default',
      }}
    >
      {label}
    </span>
  );
}

// ── Main Component ───────────────────────────────────────────────────────
export default function TranscriptViewer() {
  const { videos, groups, selectedVideoId, selectVideo, setView } = useAppStore();
  const video = videos.find((v) => v.id === selectedVideoId);
  const group = video?.group_id ? groups.find((g) => g.id === video.group_id) : null;

  const [tab, setTab] = useState<'txt' | 'srt'>('txt');
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [fontSize, setFontSize] = useState(14.5);
  const [scrollProgress, setScrollProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Stats
  const stats = useMemo(() => {
    if (!video?.transcript_txt) return { words: 0, chars: 0, lines: 0, readingMins: 0, paragraphs: 0 };
    const text = video.transcript_txt;
    const words = text.split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    const lines = text.split('\n').length;
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length || 1;
    const readingMins = Math.max(1, Math.ceil(words / 200));
    return { words, chars, lines, readingMins, paragraphs };
  }, [video?.transcript_txt]);

  // Summary — three-act breakdown
  const summary = useMemo(() => {
    if (!video?.transcript_txt) return { acts: [], topics: [] } as SummaryResult;
    return generateSummary(video.transcript_txt);
  }, [video?.transcript_txt]);

  // Scroll progress tracking
  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const progress = scrollHeight <= clientHeight ? 1 : scrollTop / (scrollHeight - clientHeight);
    setScrollProgress(Math.min(1, Math.max(0, progress)));
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false);
          setSearchTerm('');
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !window.getSelection()?.toString()) {
        e.preventDefault();
        handleCopy();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSearch]);

  if (!video) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
        <p>Video not found</p>
      </div>
    );
  }

  const transcript = tab === 'txt' ? video.transcript_txt : video.transcript_srt;

  const handleCopy = async () => {
    if (!transcript) return;
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async (format: 'txt' | 'srt') => {
    const content = format === 'txt' ? video.transcript_txt : video.transcript_srt;
    if (!content) return;
    try {
      const fileName = `${video.name}.${format}`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleBack = () => {
    selectVideo(null);
    setView('gallery');
  };

  // Search highlighting
  const renderTranscript = () => {
    if (!transcript) return null;

    const applyHighlight = (text: string) => {
      if (!searchTerm) return [text];
      const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      return text.split(regex).map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.4), rgba(168,85,247,0.3))',
              color: 'white',
              borderRadius: 3,
              padding: '1px 4px',
              boxShadow: '0 0 8px rgba(99,102,241,0.2)',
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      );
    };

    // Split into paragraphs for visual breathing room
    if (tab === 'txt') {
      const paragraphs = transcript.split(/\n\s*\n/);
      if (paragraphs.length > 1) {
        return paragraphs.map((para, i) => (
          <div key={i} style={{ marginBottom: i < paragraphs.length - 1 ? 20 : 0 }}>
            {applyHighlight(para.trim())}
          </div>
        ));
      }
      // Single block — split on newlines for some breathing
      const lines = transcript.split('\n');
      return lines.map((line, i) => (
        <div key={i} style={{ minHeight: line.trim() ? undefined : 12 }}>
          {line.trim() ? applyHighlight(line) : '\u00A0'}
        </div>
      ));
    }

    // SRT format — keep as-is with monospace
    return applyHighlight(transcript);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-4 px-5 py-2.5 shrink-0 relative"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-base) 100%)',
        }}
      >
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: 13,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <ArrowLeft size={14} /> Back
        </button>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate" style={{ fontSize: 15 }}>{video.name}</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Text Size Controls */}
          <div
            className="flex items-center rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            <button
              className="flex items-center justify-center transition-colors"
              style={{ width: 28, height: 28, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              onClick={() => setFontSize((s) => Math.max(11, s - 1))}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              title="Decrease text size"
            >
              <Minus size={12} />
            </button>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, padding: '0 2px', minWidth: 20, textAlign: 'center' }}>
              {Math.round(fontSize)}
            </span>
            <button
              className="flex items-center justify-center transition-colors"
              style={{ width: 28, height: 28, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              onClick={() => setFontSize((s) => Math.min(22, s + 1))}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              title="Increase text size"
            >
              <Plus size={12} />
            </button>
          </div>

          <button
            className="btn-ghost"
            style={{ height: 32, padding: '0 10px', fontSize: 12, borderRadius: 8 }}
            onClick={() => { setShowSearch(!showSearch); setTimeout(() => searchInputRef.current?.focus(), 50); }}
          >
            <Search size={14} />
          </button>

          {/* Format Toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {(['txt', 'srt'] as const).map((t) => (
              <button
                key={t}
                className="flex items-center gap-1 px-3 py-1.5 transition-all duration-200"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: tab === t ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))' : 'transparent',
                  color: tab === t ? 'var(--accent-hover)' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  borderLeft: t === 'srt' ? '1px solid var(--border)' : 'none',
                }}
                onClick={() => setTab(t)}
              >
                {t === 'txt' ? <FileText size={13} /> : <Subtitles size={13} />}
                {t === 'txt' ? 'Text' : 'SRT'}
              </button>
            ))}
          </div>

          <button className="btn-ghost" style={{ height: 32, padding: '0 12px', fontSize: 12, borderRadius: 8 }} onClick={handleCopy}>
            {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>

          <button className="btn-primary" style={{ height: 32, padding: '0 14px', fontSize: 12, borderRadius: 8 }} onClick={() => handleExport(tab)}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 44 }}
            exit={{ opacity: 0, height: 0 }}
            className="px-5 flex items-center gap-3 shrink-0"
            style={{
              borderBottom: '1px solid var(--border)',
              background: 'linear-gradient(90deg, rgba(99,102,241,0.03), transparent)',
            }}
          >
            <Search size={14} style={{ color: 'var(--accent-hover)', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              autoFocus
              type="text"
              placeholder="Search transcript...  (Esc to close)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none"
              style={{ fontSize: 13, color: 'var(--text-primary)' }}
            />
            {searchTerm && (
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                onClick={() => setSearchTerm('')}
              >
                <X size={14} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── Scroll Progress Bar ──────────────────────────────── */}
        <div
          className="absolute top-0 left-0 z-10"
          style={{
            width: `calc((100% - 280px) * ${scrollProgress})`,
            height: 2,
            background: 'linear-gradient(90deg, #6366f1, #a855f7, #c084fc)',
            boxShadow: '0 0 8px rgba(99,102,241,0.4), 0 0 20px rgba(99,102,241,0.15)',
            transition: 'width 0.1s linear',
            borderRadius: '0 1px 1px 0',
          }}
        />

        {/* ── Transcript Panel ─────────────────────────────────── */}
        <div
          ref={contentRef}
          className="flex-1 overflow-auto"
          style={{
            background: 'radial-gradient(ellipse at 20% 0%, rgba(99,102,241,0.04) 0%, transparent 60%), var(--bg-base)',
          }}
        >
          <div className="p-8 max-w-3xl mx-auto">
            {transcript ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                {/* Transcript glass card */}
                <div
                  className="relative rounded-2xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 4px 40px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
                  }}
                >
                  {/* Accent glow line on left */}
                  <div
                    className="absolute left-0 top-0 bottom-0"
                    style={{
                      width: 3,
                      background: 'linear-gradient(180deg, #6366f1, #a855f7, #6366f1)',
                      boxShadow: '0 0 12px rgba(99,102,241,0.3), 0 0 24px rgba(99,102,241,0.1)',
                    }}
                  />

                  {/* Content */}
                  <div className="p-8 pl-10">
                    <div
                      className="leading-relaxed"
                      style={{
                        fontSize,
                        color: '#d4d4d8',
                        lineHeight: 2,
                        fontFamily: tab === 'srt' ? "'JetBrains Mono', monospace" : "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                        fontWeight: 400,
                        letterSpacing: '0.01em',
                        wordSpacing: '0.02em',
                        whiteSpace: tab === 'srt' ? 'pre-wrap' : undefined,
                      }}
                    >
                      {renderTranscript()}
                    </div>
                  </div>
                </div>

                {/* Bottom indicator */}
                <div className="flex justify-center mt-6">
                  <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    <Sparkles size={12} style={{ color: 'var(--accent)' }} />
                    <span>{stats.words.toLocaleString()} words transcribed</span>
                    <span style={{ color: 'var(--border)' }}>|</span>
                    <span>~{stats.readingMins} min read</span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="text-center py-24">
                <div
                  className="mx-auto mb-4 rounded-2xl flex items-center justify-center"
                  style={{
                    width: 64,
                    height: 64,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.05))',
                    border: '1px solid var(--border)',
                  }}
                >
                  <FileText size={24} style={{ color: 'var(--text-muted)' }} />
                </div>
                <p className="font-medium" style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  No {tab === 'txt' ? 'text' : 'SRT'} transcript available
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Sidebar ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="shrink-0 overflow-auto"
          style={{
            width: 280,
            borderLeft: '1px solid var(--border)',
            background: 'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-base) 100%)',
          }}
        >
          <div className="p-5 space-y-5">

            {/* Video Thumbnail Hero */}
            <div
              className="relative rounded-xl overflow-hidden"
              style={{
                aspectRatio: '16/9',
                background: video.thumbnail_path
                  ? `url(asset://localhost/${encodeURIComponent(video.thumbnail_path)}) center/cover`
                  : 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              }}
            >
              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.7) 100%)' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="rounded-full flex items-center justify-center"
                  style={{
                    width: 40, height: 40,
                    background: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  <Play size={18} style={{ color: 'white', marginLeft: 2 }} fill="white" />
                </div>
              </div>
              <div
                className="absolute bottom-2 right-2 rounded-md px-2 py-0.5 flex items-center gap-1"
                style={{ fontSize: 11, fontWeight: 700, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', color: 'white' }}
              >
                <Clock size={10} />
                {formatDuration(video.duration_secs)}
              </div>
            </div>

            {/* Video Title */}
            <div>
              <h3 className="font-semibold" style={{ fontSize: 14, lineHeight: 1.4, marginBottom: 4 }}>{video.name}</h3>
              {group && (
                <div className="flex items-center gap-1.5" style={{ color: 'var(--accent-hover)', fontSize: 12 }}>
                  <FolderOpen size={12} />
                  <span>{group.name}</span>
                </div>
              )}
            </div>

            {/* Stats Ring Row */}
            <div
              className="rounded-xl p-4 flex justify-around"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(168,85,247,0.03))',
                border: '1px solid rgba(99,102,241,0.1)',
              }}
            >
              <ProgressRing value={stats.words} max={Math.max(stats.words, 5000)} label="Words" color="#818cf8" />
              <ProgressRing value={stats.readingMins} max={Math.max(stats.readingMins, 30)} label="Min Read" color="#a78bfa" />
              <ProgressRing value={stats.paragraphs} max={Math.max(stats.paragraphs, 20)} label="Sections" color="#c084fc" />
            </div>

            {/* Detail Cards */}
            <div className="space-y-2">
              {[
                { icon: Type, label: 'Characters', value: stats.chars.toLocaleString(), gradient: 'rgba(99,102,241,0.08)', iconColor: '#818cf8' },
                { icon: Hash, label: 'Lines', value: stats.lines.toLocaleString(), gradient: 'rgba(168,85,247,0.08)', iconColor: '#a78bfa' },
                { icon: BookOpen, label: 'Reading Time', value: `~${stats.readingMins} min`, gradient: 'rgba(192,132,252,0.08)', iconColor: '#c084fc' },
                { icon: HardDrive, label: 'File Size', value: formatFileSize(video.file_size), gradient: 'rgba(34,197,94,0.06)', iconColor: '#4ade80' },
              ].map(({ icon: Icon, label, value, gradient, iconColor }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 + i * 0.06 }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200"
                  style={{ background: gradient, border: '1px solid transparent', cursor: 'default' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'translateX(0)'; }}
                >
                  <div className="rounded-lg flex items-center justify-center shrink-0" style={{ width: 30, height: 30, background: `${iconColor}15` }}>
                    <Icon size={14} style={{ color: iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 1 }}>{label}</p>
                    <p className="font-semibold" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{value}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* Dates */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <Calendar size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Added</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDate(video.added_at)} at {formatTime(video.added_at)}</p>
                </div>
              </div>
              {video.transcribed_at && (
                <div className="flex items-center gap-2.5">
                  <Sparkles size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Transcribed</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDate(video.transcribed_at)} at {formatTime(video.transcribed_at)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Content Breakdown ──────────────────────────────── */}
            {summary.acts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.05), rgba(168,85,247,0.03))',
                  border: '1px solid rgba(99,102,241,0.12)',
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center gap-2 px-3.5 py-2.5"
                  style={{
                    borderBottom: '1px solid rgba(99,102,241,0.08)',
                    background: 'linear-gradient(90deg, rgba(99,102,241,0.06), rgba(168,85,247,0.03))',
                  }}
                >
                  <MessageSquareText size={13} style={{ color: '#818cf8' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Content Breakdown
                  </span>
                </div>

                <div className="px-3.5 py-3 space-y-3">
                  {/* Three Acts */}
                  {summary.acts.map((act, i) => (
                    <motion.div
                      key={act.label}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.6 + i * 0.1 }}
                    >
                      {/* Act label */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <div
                          className="rounded-full"
                          style={{
                            width: 6,
                            height: 6,
                            background: act.color,
                            boxShadow: `0 0 6px ${act.color}60`,
                          }}
                        />
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: act.color,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}>
                          {act.label}
                        </span>
                      </div>

                      {/* Act summary text */}
                      <div
                        style={{
                          borderLeft: `2px solid ${act.color}40`,
                          paddingLeft: 12,
                          marginLeft: 2,
                        }}
                      >
                        <p style={{
                          fontSize: 11.5,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.7,
                        }}>
                          {act.summary}
                        </p>
                      </div>

                      {/* Connector line between acts */}
                      {i < summary.acts.length - 1 && (
                        <div className="flex justify-center py-1">
                          <div style={{
                            width: 1,
                            height: 10,
                            background: 'linear-gradient(180deg, rgba(99,102,241,0.15), transparent)',
                          }} />
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {/* Divider */}
                  <div style={{ height: 1, background: 'rgba(99,102,241,0.08)' }} />

                  {/* Topic Tags */}
                  {summary.topics.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Tag size={10} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                          Key Topics
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {summary.topics.map((topic, i) => (
                          <TopicTag key={topic} label={topic} index={i} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Source Path */}
            <div
              className="rounded-lg p-3"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}
            >
              <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 6 }}>
                Source File
              </p>
              <p className="font-mono break-all" style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {video.file_path}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
