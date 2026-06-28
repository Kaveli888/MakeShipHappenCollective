import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {CodeRain} from '../components/CodeRain';
import {COLORS, FONT} from '../theme';

// Scene 4: the verdict — logo, tagline, CTA.
export const VerdictScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const flash = interpolate(frame, [0, 5], [0.9, 0], {
    extrapolateRight: 'clamp',
  });

  const emblemIn = spring({frame, fps, config: {damping: 14, mass: 0.7}});
  const line1In = interpolate(frame, [10, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const line2In = interpolate(frame, [20, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const metaIn = interpolate(frame, [34, 48], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const drift = interpolate(frame, [0, 120], [1, 1.03]);
  const pulse = 1 + 0.025 * Math.sin((frame / 30) * Math.PI * 2);
  const glow = 0.55 + 0.25 * Math.sin((frame / 30) * Math.PI * 2);

  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      <CodeRain opacity={0.16} />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          transform: `scale(${drift})`,
          fontFamily: FONT,
        }}
      >
        <div style={{position: 'relative', marginBottom: 44, transform: `scale(${emblemIn})`}}>
          <div
            style={{
              position: 'absolute',
              inset: -70,
              background:
                'radial-gradient(circle, rgba(45,212,191,0.4) 0%, transparent 65%)',
            }}
          />
          {/* screen blend drops the emblem's black square against the dark bg */}
          <Img
            src={staticFile('emblem.png')}
            style={{width: 190, height: 'auto', mixBlendMode: 'screen', position: 'relative'}}
          />
        </div>
        <div
          style={{
            fontSize: 104,
            fontWeight: 700,
            color: COLORS.ink,
            letterSpacing: '-0.025em',
            opacity: line1In,
            transform: `translateY(${(1 - line1In) * 24}px)`,
            lineHeight: 1.04,
          }}
        >
          Set a Mission.
        </div>
        <div
          style={{
            fontSize: 104,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            opacity: line2In,
            transform: `translateY(${(1 - line2In) * 24}px)`,
            lineHeight: 1.12,
            background: `linear-gradient(90deg, ${COLORS.pink}, ${COLORS.orange})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Ship the Verdict.
        </div>
        <div
          style={{
            marginTop: 38,
            fontSize: 27,
            letterSpacing: '0.34em',
            color: COLORS.purpleSoft,
            opacity: metaIn,
            textIndent: '0.34em',
          }}
        >
          MAKESHIPHAPPEN.TECH
        </div>
        <div
          style={{
            marginTop: 40,
            opacity: metaIn,
            transform: `scale(${pulse})`,
            background: `linear-gradient(90deg, ${COLORS.purple}, #6d28d9)`,
            color: '#fff',
            fontSize: 30,
            fontWeight: 600,
            padding: '22px 64px',
            borderRadius: 999,
            boxShadow: `0 0 ${60 * glow}px rgba(139,92,246,${glow})`,
          }}
        >
          Download ShipSpace
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#fff', opacity: flash, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};
