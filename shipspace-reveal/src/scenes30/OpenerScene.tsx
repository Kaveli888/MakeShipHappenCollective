import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {COLORS, FONT} from '../theme';

// C1 — the AI silk footage: cloth-draped monolith, glowing globe, code rain.
// Footage is the motion-interpolated first 1.3s of the Seedance render
// stretched to ~4.1s. A garbled UI tab fades in top-left near the end of the
// source, so a corner shade grows over it and the scene hands off on a flash.
export const OpenerScene: React.FC = () => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Slow push-in; slight over-scale also crops the corner watermark.
  const zoom = interpolate(frame, [0, 114], [1.08, 1.17]);

  // Shade the top-left corner as the garbled slab edge starts to peek through.
  const cornerShade = interpolate(frame, [58, 84], [0, 0.92], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const eyebrowIn = interpolate(frame, [34, 52], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{background: '#000', opacity: fadeIn}}>
      <AbsoluteFill style={{transform: `scale(${zoom})`}}>
        <OffthreadVideo
          src={staticFile('opener.mp4')}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          muted
        />
      </AbsoluteFill>

      {/* corner shade hiding the AI's garbled tab */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 46% 40% at 12% 10%, rgba(0,0,0,0.97) 0%, transparent 70%)',
          opacity: cornerShade,
        }}
      />

      {/* cinematic vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, transparent 46%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 96,
          textAlign: 'center',
          fontFamily: FONT,
          fontSize: 26,
          letterSpacing: '0.6em',
          textIndent: '0.6em',
          color: COLORS.teal,
          fontWeight: 600,
          opacity: eyebrowIn,
          textShadow: '0 0 26px rgba(45,212,191,0.55)',
        }}
      >
        SHIPSPACE
      </div>
    </AbsoluteFill>
  );
};
