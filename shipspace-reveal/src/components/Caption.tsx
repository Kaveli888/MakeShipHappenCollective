import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {COLORS, FONT} from '../theme';

type Props = {
  eyebrow: string;
  headline: string;
  sub?: string;
  appearAt?: number; // local frame
};

export const Caption: React.FC<Props> = ({eyebrow, headline, sub, appearAt = 8}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [appearAt, appearAt + 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rise = (1 - t) * 26;

  return (
    <div
      style={{
        position: 'absolute',
        left: 90,
        bottom: 76,
        fontFamily: FONT,
        opacity: t,
        transform: `translateY(${rise}px)`,
      }}
    >
      <div
        style={{
          fontSize: 21,
          letterSpacing: '0.42em',
          color: COLORS.teal,
          fontWeight: 600,
          marginBottom: 14,
          textTransform: 'uppercase',
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontSize: 64,
          fontWeight: 700,
          color: COLORS.ink,
          letterSpacing: '-0.02em',
          textShadow: '0 4px 40px rgba(0,0,0,0.9)',
        }}
      >
        {headline}
      </div>
      {sub ? (
        <div style={{fontSize: 28, color: COLORS.dim, marginTop: 12, fontWeight: 500}}>
          {sub}
        </div>
      ) : null}
    </div>
  );
};
