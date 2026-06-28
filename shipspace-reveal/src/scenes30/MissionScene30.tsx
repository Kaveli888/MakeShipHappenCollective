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
import {LightSweep} from '../components/LightSweep';
import {UIShot} from '../components/UIShot';
import {COLORS, FONT, MONO} from '../theme';

const MISSION = 'Run a security audit, fix the risks, verify the build.';
const SPLIT = 84; // local frame where mission hands off to directory+context

// C4 — the mission types itself in the real wizard, then the directory and
// context panels attach as floating slabs.
export const MissionScene30: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp'});

  // -- part 1: mission screen push-in + typewriter
  const mScale = interpolate(frame, [0, SPLIT], [1.5, 1.66]);
  const mY = interpolate(frame, [0, SPLIT], [255, 300]);
  const typed = Math.max(0, Math.min(MISSION.length, Math.floor((frame - 10) / 1.15)));
  const cursorOn = Math.floor(frame / 14) % 2 === 0;
  const missionOut = interpolate(frame, [SPLIT - 10, SPLIT], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // -- part 2: directory + context slabs
  const slabSpring = (delay: number) =>
    spring({frame: frame - SPLIT - delay, fps, config: {damping: 16, mass: 0.8}});
  const dirIn = frame >= SPLIT ? slabSpring(0) : 0;
  const ctxIn = frame >= SPLIT ? slabSpring(12) : 0;
  const part2Zoom = interpolate(frame, [SPLIT, 168], [1, 1.05], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const captionIn = interpolate(
    frame,
    frame < SPLIT ? [12, 26] : [SPLIT + 8, SPLIT + 22],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );

  return (
    <AbsoluteFill style={{opacity: fadeIn, background: COLORS.bg}}>
      {frame < SPLIT ? (
        <AbsoluteFill style={{opacity: missionOut}}>
          <UIShot src="ui-mission-169.png" scale={mScale} y={mY} vignette={0.58} />
          <LightSweep from={8} duration={28} opacity={0.18} />

          {/* typed mission, pinned as a glass console line */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 200,
              transform: 'translateX(-50%)',
              width: 1280,
              background: 'rgba(8,5,16,0.82)',
              border: '1px solid rgba(139,92,246,0.35)',
              borderRadius: 16,
              padding: '26px 34px',
              fontFamily: MONO,
              fontSize: 30,
              color: COLORS.ink,
              boxShadow: '0 18px 70px rgba(0,0,0,0.6), 0 0 40px rgba(139,92,246,0.12)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <span style={{color: COLORS.purpleSoft, marginRight: 16}}>mission ▸</span>
            {MISSION.slice(0, typed)}
            <span style={{opacity: cursorOn ? 1 : 0, color: COLORS.tealSoft}}>▋</span>
          </div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{transform: `scale(${part2Zoom})`}}>
          <CodeRain opacity={0.3} columns={38} />
          {/* directory slab */}
          <div
            style={{
              position: 'absolute',
              left: 130,
              top: 180,
              width: 780,
              borderRadius: 18,
              overflow: 'hidden',
              border: '1px solid rgba(45,212,191,0.3)',
              boxShadow: '0 30px 90px rgba(0,0,0,0.75), 0 0 60px rgba(45,212,191,0.10)',
              opacity: dirIn,
              transform: `translateY(${(1 - dirIn) * 90}px) rotateZ(-0.6deg) scale(${0.92 + dirIn * 0.08})`,
            }}
          >
            <Img
              src={staticFile('ui-directory.png')}
              style={{width: '100%', display: 'block', filter: 'brightness(1.35)'}}
            />
          </div>
          {/* context slab */}
          <div
            style={{
              position: 'absolute',
              right: 130,
              top: 120,
              width: 820,
              borderRadius: 18,
              overflow: 'hidden',
              border: '1px solid rgba(139,92,246,0.35)',
              boxShadow: '0 30px 90px rgba(0,0,0,0.75), 0 0 60px rgba(139,92,246,0.12)',
              opacity: ctxIn,
              transform: `translateY(${(1 - ctxIn) * 90}px) rotateZ(0.6deg) scale(${0.92 + ctxIn * 0.08})`,
            }}
          >
            <Img
              src={staticFile('ui-context.png')}
              style={{width: '100%', display: 'block', filter: 'brightness(1.2)'}}
            />
          </div>
        </AbsoluteFill>
      )}

      {/* caption */}
      <div
        style={{
          position: 'absolute',
          left: 90,
          bottom: 76,
          fontFamily: FONT,
          opacity: captionIn,
          transform: `translateY(${(1 - captionIn) * 26}px)`,
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
          {frame < SPLIT ? 'Step 02 — Mission' : 'Step 03 — Directory & Context'}
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
          {frame < SPLIT ? 'Define the mission' : 'Attach context'}
        </div>
        {frame >= SPLIT ? (
          <div style={{fontSize: 28, color: COLORS.dim, marginTop: 12, fontWeight: 500}}>
            Point the gang at your real files
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
