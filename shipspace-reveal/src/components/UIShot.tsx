import React from 'react';
import {Img, staticFile} from 'remotion';
import {H, W} from '../theme';

type Props = {
  src: string;
  // transform applied to the image plane
  scale: number;
  x?: number;
  y?: number;
  vignette?: number; // 0..1 strength
};

// Full-bleed screenshot plane with cinematic vignette.
export const UIShot: React.FC<Props> = ({src, scale, x = 0, y = 0, vignette = 0.55}) => {
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#000'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
        }}
      >
        {/* height-fit plane wider than the viewport so pans never show edges */}
        <Img src={staticFile(src)} style={{height: H, width: 'auto', flexShrink: 0}} />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,${vignette}) 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to top, rgba(0,0,0,0.62) 0%, transparent 26%)',
        }}
      />
    </div>
  );
};
