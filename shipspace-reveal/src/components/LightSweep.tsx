import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {W} from '../theme';

type Props = {
  // local frame range during which the sweep crosses the screen
  from: number;
  duration?: number;
  angle?: number;
  opacity?: number;
};

// A diagonal specular highlight that crosses the frame once — the
// "glossy slab" move from the Cascade grammar.
export const LightSweep: React.FC<Props> = ({
  from,
  duration = 26,
  angle = 18,
  opacity = 0.5,
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [from, from + duration], [-0.45, 1.45], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (frame < from || frame > from + duration) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: -200,
        pointerEvents: 'none',
        background: `linear-gradient(${90 + angle}deg, transparent ${t * 100 - 9}%, rgba(255,255,255,${opacity}) ${t * 100}%, transparent ${t * 100 + 9}%)`,
        mixBlendMode: 'screen',
        transform: `translateX(${(t - 0.5) * 0.06 * W}px)`,
      }}
    />
  );
};
