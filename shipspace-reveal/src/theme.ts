export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const DUR = 450; // 15s

// Scene boundaries (frames)
export const S1_END = 96; // Mission
export const S2_END = 198; // Fleet
export const S3_END = 330; // Ship (cockpit pan + mission control)
export const S3_CUT = 276; // cockpit -> mission control

// Flip to true once an AI-generated silk opener exists at public/opener.mp4.
// It replaces Scene 1 visuals (typed mission text stays as an overlay).
export const USE_AI_OPENER = false;

// ---- Commercial30 (30s spot) scene boundaries (frames @ 30fps) ----
export const C30_DUR = 900;
export const C1_END = 114; // Cloth opener (AI footage)
export const C2_END = 240; // Laptop opens
export const C3_END = 378; // Roster
export const C4_END = 546; // Mission + context
export const C5_END = 708; // Terminal grid
export const C6_END = 810; // Verdict card
// C7 end card runs C6_END..C30_DUR

export const COLORS = {
  bg: '#050208',
  ink: '#f4f4f5',
  dim: 'rgba(244,244,245,0.55)',
  teal: '#2dd4bf',
  tealSoft: '#5eead4',
  pink: '#f472b6',
  orange: '#fb923c',
  purple: '#8b5cf6',
  purpleSoft: '#a78bfa',
};

export const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif';
export const MONO =
  '"SF Mono", ui-monospace, Menlo, Monaco, "Cascadia Mono", monospace';
