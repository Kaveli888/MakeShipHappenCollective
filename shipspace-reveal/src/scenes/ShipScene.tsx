import React from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame} from 'remotion';
import {Caption} from '../components/Caption';
import {UIShot} from '../components/UIShot';
import {COLORS, S3_CUT, S3_END, S2_END} from '../theme';

const CUT = S3_CUT - S2_END; // local frame of the cockpit -> mission control cut
const LEN = S3_END - S2_END;

// Scene 3: the cockpit alive — terminal grid pan, then Mission Control.
export const ShipScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Shot A: pan across cockpit from terminals (left) to the live site (right)
  const panX = interpolate(frame, [0, CUT], [240, -240], {
    easing: Easing.inOut(Easing.quad),
    extrapolateRight: 'clamp',
  });
  const scaleA = interpolate(frame, [0, CUT], [1.06, 1.12], {
    extrapolateRight: 'clamp',
  });

  // Shot B: Mission Control — keep the feature cards (left third) centered
  const bFrame = frame - CUT;
  const scaleB = interpolate(bFrame, [0, LEN - CUT], [1.18, 1.08], {
    easing: Easing.out(Easing.quad),
  });
  const xB = interpolate(bFrame, [0, LEN - CUT], [380, 330], {
    easing: Easing.out(Easing.quad),
  });

  const fadeIn = interpolate(frame, [0, 5], [0, 1], {extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{background: COLORS.bg, opacity: fadeIn}}>
      <Sequence from={0} durationInFrames={CUT}>
        <UIShot src="ui-cockpit.png" scale={scaleA} x={panX} vignette={0.6} />
        <Caption
          eyebrow="Execute"
          headline="Six agents. Working live."
          sub="Real terminals. Real output. No babysitting."
        />
      </Sequence>
      <Sequence from={CUT} durationInFrames={LEN - CUT}>
        <UIShot src="ui-mission-control.png" scale={scaleB} x={xB} vignette={0.6} />
        <Caption
          eyebrow="Command"
          headline="Mission Control, built in."
          appearAt={4}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
