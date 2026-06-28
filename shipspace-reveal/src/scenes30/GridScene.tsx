import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Caption} from '../components/Caption';
import {LightSweep} from '../components/LightSweep';
import {UIShot} from '../components/UIShot';

// C5 — the six-terminal cockpit running Claude, Codex and Gemini in parallel,
// browser preview alongside. Slow pan across the real ultrawide capture.
export const GridScene: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp'});
  const scale = interpolate(frame, [0, 162], [1.0, 1.1]);
  // Pan left→right: terminals first, then the live browser preview.
  const x = interpolate(frame, [0, 162], [300, -300]);

  return (
    <AbsoluteFill style={{opacity: fadeIn, background: '#000'}}>
      <UIShot src="ui-workspace-wide.png" scale={scale} x={x} vignette={0.5} />
      <LightSweep from={70} duration={32} opacity={0.16} />
      {frame < 84 ? (
        <Caption
          eyebrow="Mission running"
          headline="Run agents in parallel"
          sub="Claude · Codex · Gemini — one controlled workspace"
        />
      ) : (
        <Caption
          eyebrow="Mission running"
          headline="Review every diff"
          sub="Files update · tests pass · preview goes live"
          appearAt={0}
        />
      )}
    </AbsoluteFill>
  );
};
