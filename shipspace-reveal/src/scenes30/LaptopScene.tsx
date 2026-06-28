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

const SCREEN_W = 1150;
const SCREEN_H = 700;

// C2 — a dark laptop on a glass table opens by itself, revealing the live
// ShipSpace cockpit. Pure CSS 3D; the screen is the real workspace capture.
export const LaptopScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const flash = interpolate(frame, [0, 7], [0.85, 0], {
    extrapolateRight: 'clamp',
  });

  // Lid opens from nearly closed to open over ~2.4s with spring ease.
  const open = spring({frame: frame - 6, fps, config: {damping: 22, mass: 1.4, stiffness: 38}});
  const lidAngle = interpolate(open, [0, 1], [-98, -7]); // rotateX, hinged at bottom

  // Screen light grows as the lid opens.
  const screenLit = interpolate(open, [0.25, 0.85], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Slow dolly-in the whole rig.
  const dolly = interpolate(frame, [0, 126], [0.94, 1.05]);
  const rigY = interpolate(frame, [0, 126], [30, 0]);

  const captionIn = interpolate(frame, [72, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      <CodeRain opacity={0.22} columns={36} />

      {/* table: a glassy horizon line */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '72%',
          bottom: 0,
          background:
            'linear-gradient(to bottom, rgba(20,16,34,0.92) 0%, rgba(5,2,8,1) 60%)',
          borderTop: '1px solid rgba(167,139,250,0.14)',
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          perspective: 1900,
          transform: `scale(${dolly}) translateY(${rigY}px)`,
        }}
      >
        <div style={{position: 'relative', transformStyle: 'preserve-3d', transform: 'rotateX(8deg)'}}>
          {/* lid + screen, hinged at its bottom edge */}
          <div
            style={{
              width: SCREEN_W,
              height: SCREEN_H,
              transformOrigin: 'bottom center',
              transform: `rotateX(${lidAngle}deg)`,
              transformStyle: 'preserve-3d',
              borderRadius: 18,
              background: '#07060c',
              border: '2px solid #1b1828',
              boxShadow: `0 0 ${90 * screenLit}px rgba(45,212,191,${0.22 * screenLit}), 0 0 ${160 * screenLit}px rgba(139,92,246,${0.18 * screenLit})`,
              overflow: 'hidden',
            }}
          >
            <Img
              src={staticFile('ui-cockpit.png')}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                // keep the browser hero ("Set a Mission. Ship the Verdict.")
                // fully in frame; crop spills onto the terminal side instead
                objectPosition: 'right center',
                opacity: screenLit,
                filter: `brightness(${0.6 + 0.55 * screenLit})`,
              }}
            />
            {/* screen glass sheen */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(112deg, rgba(255,255,255,0.10) 0%, transparent 32%)',
                opacity: screenLit,
              }}
            />
          </div>

          {/* base / keyboard deck */}
          <div
            style={{
              width: SCREEN_W + 56,
              height: 30,
              marginLeft: -28,
              borderRadius: '0 0 22px 22px',
              background: 'linear-gradient(to bottom, #15121f 0%, #0a0810 100%)',
              borderTop: '1px solid #262138',
              boxShadow: '0 22px 60px rgba(0,0,0,0.85)',
            }}
          />

          {/* table reflection of the lit screen */}
          <div
            style={{
              width: SCREEN_W,
              height: SCREEN_H * 0.5,
              transform: 'scaleY(-1)',
              marginTop: 4,
              borderRadius: 18,
              overflow: 'hidden',
              opacity: 0.16 * screenLit,
              maskImage: 'linear-gradient(to top, black 0%, transparent 75%)',
              WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 75%)',
              filter: 'blur(3px)',
            }}
          >
            <Img
              src={staticFile('ui-cockpit.png')}
              style={{width: '100%', height: SCREEN_H, objectFit: 'cover', objectPosition: 'right center'}}
            />
          </div>
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 70,
          textAlign: 'center',
          fontFamily: FONT,
          opacity: captionIn,
          transform: `translateY(${(1 - captionIn) * 22}px)`,
        }}
      >
        <div style={{fontSize: 56, fontWeight: 700, color: COLORS.ink, letterSpacing: '-0.02em'}}>
          One ADE. Every Agent.
        </div>
      </div>

      <AbsoluteFill style={{background: '#dff7f2', opacity: flash, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};
