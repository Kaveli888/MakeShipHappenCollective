import React from 'react';
import {Composition} from 'remotion';
import {Commercial} from './Commercial';
import {Reveal} from './Reveal';
import {SlamFilmWithScore, SLAM_DUR} from './SlamFilm';
import {C30_DUR, DUR, FPS, H, W} from './theme';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Reveal15"
        component={Reveal}
        durationInFrames={DUR}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="Commercial30"
        component={Commercial}
        durationInFrames={C30_DUR}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="TerminalSlam"
        component={SlamFilmWithScore}
        durationInFrames={SLAM_DUR}
        fps={FPS}
        width={W}
        height={H}
      />
    </>
  );
};
