import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {Caption} from '../components/Caption';
import {UIShot} from '../components/UIShot';
import {COLORS} from '../theme';

// Scene 2: AI Agent Fleet modal, slow cinematic push-in.
export const FleetScene: React.FC = () => {
  const frame = useCurrentFrame();
  const len = 102;

  const scale = interpolate(frame, [0, len], [1.5, 1.74], {
    easing: Easing.out(Easing.quad),
  });
  const y = interpolate(frame, [0, len], [10, -16]);
  const fadeIn = interpolate(frame, [0, 5], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{background: COLORS.bg, opacity: fadeIn}}>
      <UIShot src="ui-fleet.png" scale={scale} y={y} vignette={0.7} />
      <Caption
        eyebrow="Provision"
        headline="Assemble your agent fleet."
        sub="Claude · Codex · Gemini — six slots, one mission."
      />
    </AbsoluteFill>
  );
};
