import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {CodeRain} from '../components/CodeRain';
import {COLORS, FONT} from '../theme';

const ROLES = [
  {name: 'Ship Radar', color: COLORS.teal},
  {name: 'Ship Verifier', color: COLORS.pink},
  {name: 'Ship Commander', color: COLORS.purpleSoft},
];

// C6 — every role's panel converges into one glowing verdict card.
export const VerdictCardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 6], [0, 1], {extrapolateRight: 'clamp'});

  // Role chips fly in from the edges, then the card lands.
  const chipIn = (i: number) =>
    spring({frame: frame - i * 6, fps, config: {damping: 15, mass: 0.7}});
  const cardAt = 30;
  const cardIn = spring({frame: frame - cardAt, fps, config: {damping: 13, mass: 0.9}});
  const chipsConverge = interpolate(frame, [cardAt - 6, cardAt + 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const glow = 0.5 + 0.3 * Math.sin((frame / 34) * Math.PI * 2);
  const drift = interpolate(frame, [cardAt, 102], [1, 1.05], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const chipStartY = [-330, 0, 330];

  return (
    <AbsoluteFill style={{background: COLORS.bg, opacity: fadeIn, fontFamily: FONT}}>
      <CodeRain opacity={0.24} columns={40} />

      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
        {/* converging role chips */}
        {ROLES.map((r, i) => {
          const inn = chipIn(i);
          const fromX = i === 0 ? -640 : i === 1 ? 640 : 0;
          const fromY = chipStartY[i];
          const x = interpolate(chipsConverge, [0, 1], [fromX * (1 - inn) + fromX * 0.32 * inn, 0]);
          const y = interpolate(chipsConverge, [0, 1], [fromY * (1 - inn) + fromY * 0.32 * inn, 0]);
          const fade = interpolate(chipsConverge, [0.55, 1], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={r.name}
              style={{
                position: 'absolute',
                transform: `translate(${x}px, ${y}px) scale(${0.7 + inn * 0.3})`,
                opacity: inn * fade,
                background: 'rgba(10,7,18,0.9)',
                border: `1px solid ${r.color}`,
                color: r.color,
                borderRadius: 999,
                padding: '18px 38px',
                fontSize: 30,
                fontWeight: 600,
                boxShadow: `0 0 36px ${r.color}33`,
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
              }}
            >
              ✓ {r.name}
            </div>
          );
        })}

        {/* the verdict card */}
        <div
          style={{
            opacity: cardIn,
            transform: `scale(${(0.86 + cardIn * 0.14) * drift})`,
            background:
              'linear-gradient(160deg, rgba(16,12,28,0.96) 0%, rgba(8,6,14,0.96) 100%)',
            border: '1px solid rgba(45,212,191,0.55)',
            borderRadius: 28,
            padding: '64px 110px',
            textAlign: 'center',
            boxShadow: `0 0 ${110 * glow}px rgba(45,212,191,${0.3 * glow}), 0 40px 120px rgba(0,0,0,0.8)`,
          }}
        >
          <div
            style={{
              fontSize: 24,
              letterSpacing: '0.4em',
              textIndent: '0.4em',
              color: COLORS.teal,
              fontWeight: 600,
              marginBottom: 26,
            }}
          >
            3 OF 3 ROLES AGREE
          </div>
          <div
            style={{
              fontSize: 112,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: COLORS.ink,
              lineHeight: 1.05,
            }}
          >
            Ready to Ship<span style={{color: COLORS.teal}}>.</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
