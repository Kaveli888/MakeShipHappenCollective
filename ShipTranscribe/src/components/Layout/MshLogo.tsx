export default function MshLogo({ size = 32, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0, overflow: 'hidden', borderRadius: '50%', ...style }}>
      <img
        src="/msh-ring.png"
        alt=""
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
      <img
        src="/msh-sphere.png"
        alt="MSH"
        style={{
          display: 'block',
          width: '42%',
          height: '42%',
          objectFit: 'contain',
          position: 'absolute',
          top: '29%',
          left: '29%',
          transformOrigin: '50% 50%',
          animation: 'msh-spin 12s linear infinite',
        }}
      />
    </div>
  );
}
