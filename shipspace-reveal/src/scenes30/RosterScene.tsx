import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Caption} from '../components/Caption';
import {LightSweep} from '../components/LightSweep';
import {UIShot} from '../components/UIShot';

// C3 — the gang roster: real "Assemble your gang" wizard capture, slow push-in.
export const RosterScene: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp'});
  const scale = interpolate(frame, [0, 138], [1.42, 1.58]);
  // The roster card sits in the upper middle of the ultrawide capture.
  const x = interpolate(frame, [0, 138], [-24, 24]);
  const y = interpolate(frame, [0, 138], [290, 345]);

  return (
    <AbsoluteFill style={{opacity: fadeIn, background: '#000'}}>
      <UIShot src="ui-roster.png" scale={scale} x={x} y={y} vignette={0.6} />
      <LightSweep from={16} duration={30} opacity={0.22} />
      <Caption
        eyebrow="Step 01 — Roster"
        headline="Choose the roster"
        sub="Visionary Shippers · Ship Commander · Ship Craft · Ship Radar · Ship Verifier"
      />
    </AbsoluteFill>
  );
};
