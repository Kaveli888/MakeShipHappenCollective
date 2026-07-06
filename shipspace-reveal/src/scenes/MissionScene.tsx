import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {CodeRain} from '../components/CodeRain';
import {COLORS, FONT, MONO, S1_END, USE_AI_OPENER} from '../theme';

const HEADLINE = 'Set a mission.';
const PROMPT = '> claude · codex · gemini — one workspace';

export const MissionScene: React.FC = () => {
  const frame = useCurrentFrame();

  const rainIn = interpolate(frame, [0, 40], [0, 0.5], {
    extrapolateRight: 'clamp',
  });

  // Typewriter
  const typed = Math.max(
    0,
    Math.min(HEADLINE.length, Math.floor((frame - 12) / 2.6))
  );
  const promptTyped = Math.max(
    0,
    Math.min(PROMPT.length, Math.floor((frame - 46) / 0.8))
  );
  const cursorOn = Math.floor(frame / 16) % 2 === 0;

  const eyebrowIn = interpolate(frame, [4, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Push-in toward the cut
  const zoom = interpolate(frame, [S1_END - 14, S1_END], [1, 1.06], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fadeIn = interpolate(frame, [0, 6], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{background: COLORS.bg, opacity: fadeIn}}>
      {USE_AI_OPENER ? (
        <OffthreadVideo
          src={staticFile('opener.mp4')}
          style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}}
          muted
        />
      ) : (
        <CodeRain opacity={rainIn} />
      )}

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          transform: `scale(${zoom})`,
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 24,
            letterSpacing: '0.55em',
            color: COLORS.teal,
            fontWeight: 600,
            opacity: eyebrowIn,
            marginBottom: 36,
            textIndent: '0.55em',
          }}
        >
          SHIPSPACE
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 118,
            fontWeight: 700,
            color: COLORS.ink,
            letterSpacing: '-0.025em',
            whiteSpace: 'pre',
          }}
        >
          {HEADLINE.slice(0, typed)}
          <span style={{opacity: cursorOn && typed < HEADLINE.length ? 1 : 0}}>|</span>
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 30,
            color: COLORS.dim,
            marginTop: 42,
            whiteSpace: 'pre',
            minHeight: 40,
          }}
        >
          {PROMPT.slice(0, promptTyped)}
          <span
            style={{
              opacity: frame > 46 && cursorOn ? 1 : 0,
              color: COLORS.tealSoft,
            }}
          >
            ▋
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
