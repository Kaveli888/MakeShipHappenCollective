import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {CodeRain} from './components/CodeRain';
import {COLORS, FONT, H, W} from './theme';

// ---- timeline (frames @30fps, 450 total) ----
const A_END = 150; // floating laptop: closed → open → push into screen
const B_END = 360; // slam stage: panels slap on one by one
const DUR = 450; // pull-back reveal + tagline

const LID_OPEN_START = 55;
const PUSH_START = 120;

// slam times, local to phase B
const SLAMS = [12, 30, 48, 66, 84, 102]; // t1..t6
const BROWSER_SLAM = 128;

// ---- source geometry: ui-workspace-wide.png is 3407x1401 ----
const SRC_W = 3407;
const STAGE_SCALE = W / SRC_W; // fit-width on the 1920 stage
const STAGE_H = 1401 * STAGE_SCALE; // ≈ 790
const STAGE_TOP = (H - STAGE_H) / 2;

type PanelDef = {src: string; x: number; y: number; w: number; h: number};
const PANELS: PanelDef[] = [
  {src: 'slam/t1.png', x: 293, y: 72, w: 582, h: 650},
  {src: 'slam/t2.png', x: 898, y: 72, w: 580, h: 650},
  {src: 'slam/t3.png', x: 1499, y: 72, w: 576, h: 650},
  {src: 'slam/t4.png', x: 293, y: 741, w: 582, h: 658},
  {src: 'slam/t5.png', x: 898, y: 741, w: 580, h: 658},
  {src: 'slam/t6.png', x: 1499, y: 741, w: 576, h: 658},
];
const BROWSER: PanelDef = {src: 'slam/browser.png', x: 2096, y: 44, w: 1288, h: 1356};

const stagePx = (p: PanelDef) => ({
  left: p.x * STAGE_SCALE,
  top: STAGE_TOP + p.y * STAGE_SCALE,
  width: p.w * STAGE_SCALE,
  height: p.h * STAGE_SCALE,
});

// deterministic shake
const jitter = (f: number, seed: number) =>
  Math.sin(f * 12.9898 + seed * 78.233) * 0.5 + Math.sin(f * 4.1414 + seed * 7.7) * 0.5;

// ---------------------------------------------------------------- laptop rig
const LAPTOP_W = 1150;
const LAPTOP_H = 700;

const Laptop: React.FC<{
  lidAngle: number; // rotateX deg, -88 closed → -8 open
  screenLit: number; // 0..1
  float: number; // global frame for float bob
  camTilt?: number; // camera elevation; NEGATIVE rotateX = viewed from above
}> = ({lidAngle, screenLit, float, camTilt = -6}) => {
  const bobY = 12 * Math.sin(float / 38);
  const swayR = 2.2 * Math.sin(float / 55);

  return (
    <div
      style={{
        position: 'relative',
        transformStyle: 'preserve-3d',
        transform: `translateY(${bobY}px) rotateX(${camTilt}deg) rotateY(${swayR}deg)`,
      }}
    >
      {/* lid, hinged at its bottom edge */}
      <div
        style={{
          width: LAPTOP_W,
          height: LAPTOP_H,
          transformOrigin: 'bottom center',
          transform: `rotateX(${lidAngle}deg)`,
          transformStyle: 'preserve-3d',
          position: 'relative',
        }}
      >
        {/* screen face */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 18,
            background: '#06050b',
            border: '2px solid #1c1929',
            overflow: 'hidden',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            boxShadow: `0 0 ${100 * screenLit}px rgba(45,212,191,${0.2 * screenLit}), 0 0 ${170 * screenLit}px rgba(139,92,246,${0.16 * screenLit})`,
          }}
        >
          <Img
            src={staticFile('ui-workspace-wide.png')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'left center',
              opacity: screenLit,
              filter: `brightness(${0.3 + 0.8 * screenLit})`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(112deg, rgba(255,255,255,0.09) 0%, transparent 30%)',
              opacity: screenLit,
            }}
          />
        </div>
        {/* lid top (visible while closed) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 18,
            transform: 'rotateX(180deg)',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            background: 'linear-gradient(160deg, #110e1c 0%, #07060d 55%, #0d0b16 100%)',
            border: '1px solid #1f1a30',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* no counter-flip: with the lid folded flat, the rotateX(180) face
              flip is what makes the emblem read upright from the camera */}
          <div style={{position: 'relative'}}>
            <div
              style={{
                position: 'absolute',
                inset: -90,
                background: 'radial-gradient(circle, rgba(45,212,191,0.55) 0%, transparent 66%)',
              }}
            />
            {/* circle-crop instead of mixBlendMode — blend modes are unreliable
                inside 3D-transformed backface-hidden planes */}
            <Img
              src={staticFile('emblem.png')}
              style={{
                width: 150,
                height: 150,
                objectFit: 'cover',
                borderRadius: '50%',
                position: 'relative',
                filter: 'brightness(1.35)',
                boxShadow: '0 0 60px rgba(94,234,212,0.55)',
              }}
            />
          </div>
        </div>
      </div>

      {/* base deck */}
      <div
        style={{
          width: LAPTOP_W + 60,
          height: 30,
          marginLeft: -30,
          borderRadius: '0 0 24px 24px',
          background: 'linear-gradient(to bottom, #17131f 0%, #0a0810 100%)',
          borderTop: '1px solid #2a2440',
          boxShadow: '0 24px 70px rgba(0,0,0,0.85)',
        }}
      />

      {/* floor reflection */}
      <div
        style={{
          width: LAPTOP_W,
          height: LAPTOP_H * 0.45,
          transform: 'scaleY(-1)',
          marginTop: 6,
          borderRadius: 18,
          overflow: 'hidden',
          opacity: 0.14 * screenLit + 0.05,
          maskImage: 'linear-gradient(to top, black 0%, transparent 72%)',
          WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 72%)',
          filter: 'blur(4px)',
        }}
      >
        <Img
          src={staticFile('ui-workspace-wide.png')}
          style={{width: '100%', height: LAPTOP_H, objectFit: 'cover', objectPosition: 'left center'}}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- slam panel
const SlamPanel: React.FC<{p: PanelDef; at: number; big?: boolean}> = ({p, at, big}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (frame < at) return null;

  const inn = spring({frame: frame - at, fps, config: {damping: 16, mass: 0.55, stiffness: 210}});
  const scale = 1.5 - 0.5 * inn;
  const tilt = (1 - inn) * (big ? -3 : p.x > 1200 ? 2.5 : -2.5);
  const flash = interpolate(frame, [at, at + 9], [big ? 0.85 : 0.6, 0], {
    extrapolateRight: 'clamp',
  });
  const pos = stagePx(p);

  return (
    <>
      {/* landing flash behind the panel */}
      <div
        style={{
          position: 'absolute',
          left: pos.left - 60,
          top: pos.top - 60,
          width: pos.width + 120,
          height: pos.height + 120,
          background: `radial-gradient(ellipse, rgba(94,234,212,${flash}) 0%, transparent 62%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          ...pos,
          transform: `scale(${scale}) rotate(${tilt}deg)`,
          opacity: Math.min(1, inn * 1.6),
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: `0 ${24 * (scale - 0.96)}px ${90 * (scale - 0.92)}px rgba(0,0,0,0.85), 0 0 24px rgba(45,212,191,${0.25 * flash + 0.06})`,
          border: '1px solid rgba(244,244,245,0.10)',
        }}
      >
        <Img src={staticFile(p.src)} style={{width: '100%', height: '100%', display: 'block'}} />
      </div>
    </>
  );
};

// ---------------------------------------------------------------- the film
export const SlamFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // ============ PHASE A: floating laptop, lid opens, push in ============
  if (frame < A_END) {
    const fadeIn = interpolate(frame, [0, 10], [0, 1], {extrapolateRight: 'clamp'});
    const open = spring({
      frame: frame - LID_OPEN_START,
      fps,
      config: {damping: 24, mass: 1.5, stiffness: 34},
    });
    const lidAngle = interpolate(open, [0, 1], [-88, -8]);
    const screenLit = interpolate(open, [0.3, 0.9], [0, 0.85], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    // look down on the closed lid, level out as it opens
    const camTilt = interpolate(open, [0, 1], [-24, -6]);

    const push = interpolate(frame, [PUSH_START, A_END], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const pushEase = push * push;
    const rigScale = 0.92 + pushEase * 1.9;
    const rigY = 30 + pushEase * 250; // dive toward the screen center

    const flashOut = interpolate(frame, [A_END - 4, A_END], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    return (
      <AbsoluteFill style={{background: COLORS.bg, opacity: fadeIn}}>
        <CodeRain opacity={0.18} columns={34} />
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            perspective: 2000,
            transform: `scale(${rigScale}) translateY(${rigY}px)`,
          }}
        >
          <Laptop lidAngle={lidAngle} screenLit={screenLit} float={frame} camTilt={camTilt} />
        </AbsoluteFill>
        <AbsoluteFill style={{background: '#cdf5ec', opacity: flashOut * 0.9}} />
      </AbsoluteFill>
    );
  }

  // ============ PHASE B: full-bleed slam stage ============
  if (frame < B_END) {
    const f = frame - A_END;

    const flashIn = interpolate(f, [0, 7], [0.9, 0], {extrapolateRight: 'clamp'});
    const backdropIn = interpolate(f, [0, 10], [0, 1], {extrapolateRight: 'clamp'});

    // impact shake: sum decaying impulses from each slam
    let shakeAmp = 0;
    for (const s of [...SLAMS, BROWSER_SLAM]) {
      const d = f - s;
      if (d >= 0 && d < 8) shakeAmp += ((8 - d) / 8) * (s === BROWSER_SLAM ? 13 : 8);
    }
    const shakeX = shakeAmp * jitter(f, 1);
    const shakeY = shakeAmp * jitter(f, 9);

    // slow push across the whole phase, drifting toward the browser pane
    const drift = interpolate(f, [0, B_END - A_END], [1.02, 1.18]);
    const driftX = interpolate(f, [BROWSER_SLAM, B_END - A_END], [0, -110], {
      extrapolateLeft: 'clamp',
    });

    // final light sweep across the finished cockpit
    const sweepT = interpolate(f, [BROWSER_SLAM + 22, BROWSER_SLAM + 52], [-0.4, 1.4], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    return (
      <AbsoluteFill style={{background: COLORS.bg}}>
        <AbsoluteFill
          style={{
            transform: `translate(${shakeX + driftX}px, ${shakeY}px) scale(${drift})`,
          }}
        >
          {/* faint defocused ghost of the layout — landed panels pop against it */}
          <Img
            src={staticFile('ui-workspace-wide.png')}
            style={{
              position: 'absolute',
              left: 0,
              top: STAGE_TOP,
              width: W,
              height: STAGE_H,
              opacity: backdropIn * 0.55,
              filter: 'brightness(0.12) saturate(0.6) blur(4px)',
            }}
          />

          {PANELS.map((p, i) => (
            <SlamPanel key={p.src} p={p} at={A_END + SLAMS[i]} />
          ))}
          <SlamPanel p={BROWSER} at={A_END + BROWSER_SLAM} big />

          {/* sweep */}
          {sweepT > -0.4 && sweepT < 1.4 ? (
            <div
              style={{
                position: 'absolute',
                inset: -100,
                background: `linear-gradient(105deg, transparent ${sweepT * 100 - 8}%, rgba(255,255,255,0.20) ${sweepT * 100}%, transparent ${sweepT * 100 + 8}%)`,
                mixBlendMode: 'screen',
              }}
            />
          ) : null}
        </AbsoluteFill>

        {/* scope bars */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: STAGE_TOP, background: '#000'}} />
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: STAGE_TOP, background: '#000'}} />

        <AbsoluteFill style={{background: '#cdf5ec', opacity: flashIn}} />
      </AbsoluteFill>
    );
  }

  // ============ PHASE C: pull back to the finished laptop ============
  const f = frame - B_END;

  const flashIn = interpolate(f, [0, 6], [0.85, 0], {extrapolateRight: 'clamp'});
  const settle = spring({frame: f, fps, config: {damping: 26, mass: 1.2, stiffness: 40}});
  const rigScale = interpolate(settle, [0, 1], [1.7, 0.84]);
  const rigY = interpolate(settle, [0, 1], [190, -40]);

  const taglineIn = interpolate(f, [34, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const urlIn = interpolate(f, [46, 62], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [DUR - 12, DUR - 1], [1, 0], {
    extrapolateLeft: 'clamp',
  });

  return (
    <AbsoluteFill style={{background: COLORS.bg, opacity: fadeOut}}>
      <CodeRain opacity={0.18} columns={34} />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          perspective: 2000,
          transform: `scale(${rigScale}) translateY(${rigY}px)`,
        }}
      >
        <Laptop lidAngle={-8} screenLit={1} float={frame} />
      </AbsoluteFill>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 64,
          textAlign: 'center',
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            fontSize: 58,
            fontWeight: 700,
            color: COLORS.ink,
            letterSpacing: '-0.02em',
            opacity: taglineIn,
            transform: `translateY(${(1 - taglineIn) * 24}px)`,
            textShadow: '0 4px 40px rgba(0,0,0,0.9)',
          }}
        >
          One ADE. Every Agent.
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 21,
            letterSpacing: '0.4em',
            textIndent: '0.4em',
            color: COLORS.purpleSoft,
            fontWeight: 600,
            opacity: urlIn,
          }}
        >
          SHIPSPACE — MAKESHIPHAPPEN.TECH
        </div>
      </div>

      <AbsoluteFill style={{background: '#cdf5ec', opacity: flashIn}} />
    </AbsoluteFill>
  );
};

export const SLAM_DUR = DUR;

export const SlamFilmWithScore: React.FC = () => (
  <AbsoluteFill>
    <SlamFilm />
    <Audio src={staticFile('score-slam.wav')} />
  </AbsoluteFill>
);
