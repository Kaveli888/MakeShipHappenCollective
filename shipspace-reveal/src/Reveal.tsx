import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {FleetScene} from './scenes/FleetScene';
import {MissionScene} from './scenes/MissionScene';
import {ShipScene} from './scenes/ShipScene';
import {VerdictScene} from './scenes/VerdictScene';
import {COLORS, DUR, S1_END, S2_END, S3_END} from './theme';

export const Reveal: React.FC = () => {
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      <Sequence from={0} durationInFrames={S1_END}>
        <MissionScene />
      </Sequence>
      <Sequence from={S1_END} durationInFrames={S2_END - S1_END}>
        <FleetScene />
      </Sequence>
      <Sequence from={S2_END} durationInFrames={S3_END - S2_END}>
        <ShipScene />
      </Sequence>
      <Sequence from={S3_END} durationInFrames={DUR - S3_END}>
        <VerdictScene />
      </Sequence>
      <Audio src={staticFile('score.wav')} />
    </AbsoluteFill>
  );
};
