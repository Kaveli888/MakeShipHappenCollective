import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {GridScene} from './scenes30/GridScene';
import {LaptopScene} from './scenes30/LaptopScene';
import {MissionScene30} from './scenes30/MissionScene30';
import {OpenerScene} from './scenes30/OpenerScene';
import {RosterScene} from './scenes30/RosterScene';
import {VerdictCardScene} from './scenes30/VerdictCardScene';
import {VerdictScene} from './scenes/VerdictScene';
import {C1_END, C2_END, C3_END, C4_END, C5_END, C6_END, C30_DUR, COLORS} from './theme';

// ShipSpace 30s spot — "Set a Mission. Ship the Verdict."
// C1 silk opener (AI footage) → C2 laptop reveal → C3 roster → C4 mission +
// context → C5 parallel terminal grid → C6 verdict card → C7 end card.
export const Commercial: React.FC = () => {
  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      <Sequence from={0} durationInFrames={C1_END}>
        <OpenerScene />
      </Sequence>
      <Sequence from={C1_END} durationInFrames={C2_END - C1_END}>
        <LaptopScene />
      </Sequence>
      <Sequence from={C2_END} durationInFrames={C3_END - C2_END}>
        <RosterScene />
      </Sequence>
      <Sequence from={C3_END} durationInFrames={C4_END - C3_END}>
        <MissionScene30 />
      </Sequence>
      <Sequence from={C4_END} durationInFrames={C5_END - C4_END}>
        <GridScene />
      </Sequence>
      <Sequence from={C5_END} durationInFrames={C6_END - C5_END}>
        <VerdictCardScene />
      </Sequence>
      <Sequence from={C6_END} durationInFrames={C30_DUR - C6_END}>
        <VerdictScene />
      </Sequence>
      <Audio src={staticFile('score30.wav')} />
    </AbsoluteFill>
  );
};
