import React from 'react';
import {useCurrentFrame} from 'remotion';
import {COLORS, FPS, H, MONO, W} from '../theme';

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテト0123456789$#%&+=*<>/';

const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const PALETTE = [COLORS.teal, COLORS.pink, COLORS.purpleSoft, COLORS.tealSoft];

type Props = {opacity?: number; columns?: number};

export const CodeRain: React.FC<Props> = ({opacity = 0.5, columns = 44}) => {
  const frame = useCurrentFrame();

  const cols = [];
  for (let i = 0; i < columns; i++) {
    const r0 = rand(i * 7 + 1);
    const x = (i / columns) * W + r0 * 24;
    const speed = 70 + rand(i * 7 + 2) * 150; // px/s
    const len = 8 + Math.floor(rand(i * 7 + 3) * 12);
    const fontSize = 13 + rand(i * 7 + 4) * 9;
    const color = PALETTE[Math.floor(rand(i * 7 + 5) * PALETTE.length)];
    const startOffset = rand(i * 7 + 6) * 2600;
    const span = H + len * fontSize * 1.15;
    const y = (((frame / FPS) * speed + startOffset) % span) - len * fontSize * 1.15;
    const colOpacity = 0.35 + rand(i * 7 + 8) * 0.65;

    const glyphs = [];
    for (let j = 0; j < len; j++) {
      const tick = Math.floor(frame / 7);
      const ch = GLYPHS[Math.floor(rand(i * 131 + j * 17 + tick) * GLYPHS.length)];
      const isHead = j === len - 1;
      glyphs.push(
        <div
          key={j}
          style={{
            color: isHead ? '#ffffff' : color,
            opacity: isHead ? 1 : 0.25 + (j / len) * 0.7,
            textShadow: isHead ? `0 0 12px ${color}` : 'none',
            lineHeight: 1.15,
          }}
        >
          {ch}
        </div>
      );
    }

    cols.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: x,
          top: 0,
          transform: `translateY(${y}px)`,
          fontFamily: MONO,
          fontSize,
          opacity: colOpacity,
          userSelect: 'none',
        }}
      >
        {glyphs}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        overflow: 'hidden',
        maskImage:
          'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
      }}
    >
      {cols}
    </div>
  );
};
