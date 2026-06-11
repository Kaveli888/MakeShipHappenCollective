import React from 'react';
import {
	AbsoluteFill,
	Easing,
	Img,
	Sequence,
	interpolate,
	spring,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';

export const PROMO_FPS = 30;
export const PROMO_DURATION = 450; // 15s

// ─── Brand tokens (from makeshiphappen.tech) ─────────────────────────────────
const PURPLE = '#A78BFA';
const PINK = '#F472B6';
const ORANGE = '#FB923C';
const GREEN = '#34D399';
const BG = '#000000';
const FONT =
	"-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'SF Mono', Menlo, Monaco, 'Courier New', monospace";
const GRADIENT = `linear-gradient(100deg, ${PURPLE} 0%, ${PINK} 50%, ${ORANGE} 100%)`;

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

// ─── Cinematic layers ────────────────────────────────────────────────────────
const FilmGrain: React.FC = () => {
	const frame = useCurrentFrame();
	const ox = (frame * 97) % 512;
	const oy = (frame * 61) % 512;
	return (
		<AbsoluteFill
			style={{
				pointerEvents: 'none',
				opacity: 0.045,
				mixBlendMode: 'overlay',
				backgroundImage: `url(${staticFile('noise.png')})`,
				backgroundRepeat: 'repeat',
				backgroundPosition: `${ox}px ${oy}px`,
			}}
		/>
	);
};

const Vignette: React.FC = () => (
	<AbsoluteFill
		style={{
			pointerEvents: 'none',
			background:
				'radial-gradient(ellipse 130% 115% at 50% 48%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.85) 100%)',
		}}
	/>
);

// Anamorphic horizontal lens flare — flashes at cuts / reveals
const Flare: React.FC<{at: number; color?: string; peak?: number}> = ({
	at,
	color = '#cfd6ff',
	peak = 0.9,
}) => {
	const frame = useCurrentFrame();
	const o = interpolate(frame, [at - 4, at, at + 14], [0, peak, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	const w = interpolate(frame, [at - 4, at + 14], [40, 130], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	if (o <= 0.01) return null;
	return (
		<AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', pointerEvents: 'none'}}>
			<div
				style={{
					width: `${w}%`,
					height: 3,
					background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
					opacity: o,
					filter: 'blur(2px)',
					boxShadow: `0 0 60px 8px ${color}`,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					width: 320,
					height: 320,
					borderRadius: '50%',
					background: `radial-gradient(circle, ${color}55 0%, transparent 65%)`,
					opacity: o,
				}}
			/>
		</AbsoluteFill>
	);
};

// White flash cut (2-3 frames) — commercial transition
const FlashCut: React.FC<{at: number}> = ({at}) => {
	const frame = useCurrentFrame();
	const o = interpolate(frame, [at - 2, at, at + 5], [0, 0.55, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	if (o <= 0.01) return null;
	return <AbsoluteFill style={{background: 'white', opacity: o, pointerEvents: 'none'}} />;
};

// Specular sweep across a card surface
const Sweep: React.FC<{delay: number; duration?: number; intensity?: number}> = ({
	delay,
	duration = 36,
	intensity = 0.14,
}) => {
	const frame = useCurrentFrame();
	const x = interpolate(frame, [delay, delay + duration], [-60, 160], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	return (
		<div
			style={{
				position: 'absolute',
				inset: 0,
				overflow: 'hidden',
				borderRadius: 'inherit',
				pointerEvents: 'none',
			}}
		>
			<div
				style={{
					position: 'absolute',
					top: '-30%',
					bottom: '-30%',
					left: `${x}%`,
					width: '34%',
					transform: 'rotate(14deg)',
					background: `linear-gradient(90deg, transparent, rgba(255,255,255,${intensity}), transparent)`,
				}}
			/>
		</div>
	);
};

// Drifting bokeh dust particles
const Particles: React.FC<{count?: number}> = ({count = 16}) => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			{Array.from({length: count}, (_, i) => {
				const seedX = Math.abs(Math.sin(i * 999.7)) * width;
				const seedY = Math.abs(Math.sin(i * 432.1)) * height;
				const size = 2 + Math.abs(Math.sin(i * 77.7)) * 5;
				const speed = 0.15 + Math.abs(Math.sin(i * 13.3)) * 0.35;
				const y = ((seedY - frame * speed) % (height + 80)) + (seedY - frame * speed < -80 ? height + 80 : 0);
				const x = seedX + Math.sin(frame / 50 + i) * 24;
				const tw = 0.25 + Math.abs(Math.sin(frame / 22 + i * 2)) * 0.5;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x,
							top: y,
							width: size,
							height: size,
							borderRadius: '50%',
							background: 'white',
							opacity: tw * 0.4,
							filter: `blur(${size > 4 ? 2.5 : 1}px)`,
						}}
					/>
				);
			})}
		</AbsoluteFill>
	);
};

// Chromatic-aberration display text
const ChromaText: React.FC<{
	children: React.ReactNode;
	size: number;
	weight?: number;
	spacing?: string;
	aberration?: number;
}> = ({children, size, weight = 800, spacing = '-0.03em', aberration = 2}) => (
	<div
		style={{
			fontFamily: FONT,
			fontWeight: weight,
			fontSize: size,
			letterSpacing: spacing,
			lineHeight: 1.02,
			color: 'white',
			textShadow: `${aberration}px 0 rgba(255,60,120,0.28), -${aberration}px 0 rgba(60,160,255,0.28), 0 0 80px rgba(255,255,255,0.18)`,
		}}
	>
		{children}
	</div>
);

const CameraDrift: React.FC<{children: React.ReactNode; push?: number}> = ({
	children,
	push = 0,
}) => {
	const frame = useCurrentFrame();
	const x = Math.sin(frame / 53) * 7;
	const y = Math.cos(frame / 67) * 6;
	const rot = Math.sin(frame / 90) * 0.25;
	return (
		<AbsoluteFill
			style={{
				transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${1 + push})`,
			}}
		>
			{children}
		</AbsoluteFill>
	);
};

// ─── Scene 1 · The laptop opens ──────────────────────────────────────────────
const SCREEN_W = 1320;
const SCREEN_H = 850;

const ScreenWallpaper: React.FC<{lit: number}> = ({lit}) => {
	const frame = useCurrentFrame();
	return (
		<div
			style={{
				position: 'absolute',
				inset: 0,
				background: '#060608',
				overflow: 'hidden',
				opacity: lit,
			}}
		>
			{/* gradient blob wallpaper in brand colors */}
			<div
				style={{
					position: 'absolute',
					left: '18%',
					top: '8%',
					width: '64%',
					height: '74%',
					borderRadius: '50%',
					background: `radial-gradient(circle at 38% 35%, ${PURPLE}cc 0%, ${PINK}88 45%, ${ORANGE}33 75%, transparent 100%)`,
					filter: 'blur(46px)',
					transform: `rotate(${frame * 0.15}deg) scale(${1 + Math.sin(frame / 40) * 0.04})`,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					left: '30%',
					top: '30%',
					width: '40%',
					height: '42%',
					borderRadius: '50%',
					background: `radial-gradient(circle, #0a0a10dd 0%, transparent 70%)`,
					filter: 'blur(30px)',
				}}
			/>
			{/* wireframe globe ghost */}
			<Img
				src={staticFile('msh-globe.png')}
				style={{
					position: 'absolute',
					left: '50%',
					top: '47%',
					width: 460,
					height: 460,
					transform: `translate(-50%, -50%) rotate(${frame * 0.3}deg)`,
					opacity: 0.5,
				}}
			/>
			{/* dock hint */}
			<div
				style={{
					position: 'absolute',
					bottom: 26,
					left: '50%',
					transform: 'translateX(-50%)',
					display: 'flex',
					gap: 13,
					padding: '12px 20px',
					borderRadius: 20,
					background: 'rgba(255,255,255,0.07)',
					border: '1px solid rgba(255,255,255,0.12)',
					backdropFilter: 'blur(10px)',
				}}
			>
				{[PURPLE, PINK, ORANGE, GREEN, '#8b9cf7', '#f7d58b'].map((c, i) => (
					<div
						key={i}
						style={{
							width: 38,
							height: 38,
							borderRadius: 10,
							background: `linear-gradient(135deg, ${c}cc, ${c}55)`,
						}}
					/>
				))}
			</div>
			{/* screen glass glare */}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					background:
						'linear-gradient(112deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 28%, transparent 45%)',
				}}
			/>
		</div>
	);
};

const Laptop: React.FC = () => {
	const frame = useCurrentFrame();
	// lid angle: closed (-86deg) → open (0deg)
	const open = interpolate(frame, [10, 58], [86, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.bezier(0.3, 0.9, 0.25, 1),
	});
	const lit = interpolate(open, [20, 60], [1, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	// camera push into the screen at the end
	const push = interpolate(frame, [56, 78], [1, 1.62], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.bezier(0.5, 0, 0.8, 1),
	});
	const rise = interpolate(frame, [56, 78], [0, 170], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.bezier(0.5, 0, 0.8, 1),
	});
	const glowSpill = lit * interpolate(open, [0, 40], [1, 0.3], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

	const laptop = (reflection: boolean) => (
		<div
			style={{
				position: 'relative',
				width: SCREEN_W,
				perspective: 2300,
				transform: reflection ? 'scaleY(-1)' : undefined,
				opacity: reflection ? 0.3 : 1,
				filter: reflection ? 'blur(7px) brightness(0.55)' : undefined,
			}}
		>
			{/* lid + screen, hinged at bottom */}
			<div
				style={{
					width: SCREEN_W,
					height: SCREEN_H,
					transformOrigin: 'bottom center',
					transform: `rotateX(${-open}deg)`,
					transformStyle: 'preserve-3d',
					borderRadius: '26px 26px 6px 6px',
					background: 'linear-gradient(180deg, #2c2c30 0%, #18181b 100%)',
					border: '1px solid rgba(255,255,255,0.14)',
					boxShadow: `0 0 ${90 * glowSpill}px rgba(167,139,250,${0.32 * glowSpill})`,
					padding: 16,
					backfaceVisibility: 'hidden',
				}}
			>
				<div
					style={{
						position: 'relative',
						width: '100%',
						height: '100%',
						borderRadius: 14,
						background: '#000',
						overflow: 'hidden',
						boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.06)`,
					}}
				>
					<ScreenWallpaper lit={lit} />
					{/* camera notch */}
					<div
						style={{
							position: 'absolute',
							top: 0,
							left: '50%',
							transform: 'translateX(-50%)',
							width: 150,
							height: 20,
							borderRadius: '0 0 12px 12px',
							background: '#000',
						}}
					/>
				</div>
			</div>
			{/* lid back face (visible while closed) with glowing globe */}
			<div
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					width: SCREEN_W,
					height: SCREEN_H,
					transformOrigin: 'bottom center',
					transform: `rotateX(${-open}deg) translateZ(-2px) scaleY(-1)`,
					borderRadius: '26px 26px 6px 6px',
					background: 'linear-gradient(180deg, #232327 0%, #131316 100%)',
					border: '1px solid rgba(255,255,255,0.10)',
					backfaceVisibility: 'hidden',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<Img
					src={staticFile('msh-globe.png')}
					style={{
						width: 230,
						height: 230,
						opacity: 0.9,
						filter: 'drop-shadow(0 0 26px rgba(255,255,255,0.45)) invert(0)',
					}}
				/>
			</div>
			{/* base / keyboard deck */}
			<div
				style={{
					width: SCREEN_W,
					height: 360,
					transformOrigin: 'top center',
					transform: 'rotateX(76deg)',
					borderRadius: '6px 6px 30px 30px',
					background: 'linear-gradient(180deg, #2e2e33 0%, #1c1c20 55%, #121215 100%)',
					border: '1px solid rgba(255,255,255,0.12)',
					position: 'relative',
					overflow: 'hidden',
				}}
			>
				{/* keys */}
				<div
					style={{
						position: 'absolute',
						left: 90,
						right: 90,
						top: 36,
						height: 175,
						borderRadius: 12,
						background:
							'repeating-linear-gradient(90deg, #0c0c0f 0px, #0c0c0f 72px, #1d1d22 72px, #1d1d22 78px), repeating-linear-gradient(0deg, rgba(0,0,0,0.55) 0px, rgba(0,0,0,0.55) 26px, rgba(40,40,46,0.9) 26px, rgba(40,40,46,0.9) 30px)',
						opacity: 0.9,
					}}
				/>
				{/* trackpad */}
				<div
					style={{
						position: 'absolute',
						left: '50%',
						transform: 'translateX(-50%)',
						bottom: 22,
						width: 360,
						height: 105,
						borderRadius: 14,
						background: 'linear-gradient(180deg, #232327, #19191d)',
						border: '1px solid rgba(255,255,255,0.08)',
					}}
				/>
				{/* screen light spilling onto the deck */}
				<div
					style={{
						position: 'absolute',
						inset: 0,
						background: `linear-gradient(180deg, rgba(167,139,250,${0.20 * glowSpill}) 0%, rgba(244,114,182,${0.07 * glowSpill}) 35%, transparent 70%)`,
					}}
				/>
			</div>
		</div>
	);

	return (
		<AbsoluteFill
			style={{
				justifyContent: 'center',
				alignItems: 'center',
				transform: `scale(${push}) translateY(${rise}px)`,
			}}
		>
			<div style={{position: 'relative', marginTop: -40}}>
				{laptop(false)}
				{/* floor reflection */}
				<div
					style={{
						position: 'absolute',
						top: '100%',
						left: 0,
						right: 0,
						marginTop: -290,
						WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.7), transparent 55%)',
						maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.7), transparent 55%)',
					}}
				>
					{laptop(true)}
				</div>
				{/* floor glow pool */}
				<div
					style={{
						position: 'absolute',
						top: '96%',
						left: '50%',
						transform: 'translateX(-50%)',
						width: SCREEN_W * 1.4,
						height: 270,
						background: `radial-gradient(ellipse, rgba(167,139,250,${0.16 * glowSpill}) 0%, transparent 65%)`,
						filter: 'blur(18px)',
					}}
				/>
			</div>
		</AbsoluteFill>
	);
};

const OpeningScene: React.FC<{duration: number}> = ({duration}) => {
	const frame = useCurrentFrame();
	const inOp = interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp'});
	const out = interpolate(frame, [duration - 4, duration], [1, 0], {extrapolateLeft: 'clamp'});
	return (
		<AbsoluteFill style={{opacity: inOp * out}}>
			<Laptop />
			<Flare at={12} peak={0.5} />
			<Flare at={56} color="#d8c8ff" peak={0.85} />
			{/* tagline under laptop */}
			<div
				style={{
					position: 'absolute',
					bottom: 86,
					width: '100%',
					textAlign: 'center',
					opacity:
						interpolate(frame, [20, 34], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) *
						interpolate(frame, [52, 62], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
				}}
			>
				<div
					style={{
						fontFamily: FONT,
						fontSize: 25,
						fontWeight: 600,
						letterSpacing: '0.34em',
						textTransform: 'uppercase',
						color: 'rgba(255,255,255,0.75)',
					}}
				>
					The Execution Engine
				</div>
			</div>
		</AbsoluteFill>
	);
};

// ─── Scene 2 · Describe (inside the screen) ──────────────────────────────────
const MISSION = 'Run a security audit on ~/ShipSpace.';

const WaveBars: React.FC<{accent: string}> = ({accent}) => {
	const frame = useCurrentFrame();
	return (
		<div style={{display: 'flex', alignItems: 'center', gap: 5, height: 40}}>
			{Array.from({length: 9}, (_, i) => (
				<div
					key={i}
					style={{
						width: 5,
						borderRadius: 3,
						background: accent,
						height: 8 + Math.abs(Math.sin(frame / 4.5 + i * 1.7)) * 28,
						boxShadow: `0 0 10px ${accent}aa`,
					}}
				/>
			))}
		</div>
	);
};

const DescribeScene: React.FC<{duration: number}> = ({duration}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const enter = spring({frame, fps, config: {damping: 16, mass: 0.7}});
	const out = interpolate(frame, [duration - 5, duration], [1, 0], {extrapolateLeft: 'clamp'});
	const typed = Math.max(0, Math.floor((frame - 10) / 1.15));
	const text = MISSION.slice(0, typed);
	const caretOn = Math.floor(frame / 8) % 2 === 0;
	const push = interpolate(frame, [0, duration], [1, 1.05]);
	return (
		<AbsoluteFill style={{opacity: out, perspective: 1800}}>
			{/* ambient wallpaper continues behind — deep blurred brand blob */}
			<div
				style={{
					position: 'absolute',
					left: '22%',
					top: '12%',
					width: '56%',
					height: '64%',
					borderRadius: '50%',
					background: `radial-gradient(circle at 40% 38%, ${PURPLE}33 0%, ${PINK}1d 50%, transparent 80%)`,
					filter: 'blur(70px)',
				}}
			/>
			<AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', transform: `scale(${push})`}}>
				<div
					style={{
						width: 1240,
						borderRadius: 26,
						background: 'linear-gradient(180deg, rgba(22,22,28,0.92) 0%, rgba(10,10,14,0.96) 100%)',
						border: '1px solid rgba(255,255,255,0.13)',
						boxShadow: `0 60px 160px rgba(0,0,0,0.9), 0 0 160px ${PURPLE}26, inset 0 1px 0 rgba(255,255,255,0.10)`,
						overflow: 'hidden',
						backdropFilter: 'blur(20px)',
						transform: `rotateX(${interpolate(enter, [0, 1], [10, 3])}deg) rotateY(${-4 + frame * 0.01}deg) translateY(${interpolate(enter, [0, 1], [90, -40])}px) scale(${interpolate(enter, [0, 1], [0.94, 1])})`,
						transformStyle: 'preserve-3d',
					}}
				>
					<Sweep delay={8} intensity={0.10} />
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 9,
							padding: '20px 28px',
							borderBottom: '1px solid rgba(255,255,255,0.08)',
						}}
					>
						{['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
							<span key={c} style={{width: 15, height: 15, borderRadius: '50%', background: c}} />
						))}
						<span style={{marginLeft: 20, fontFamily: FONT, fontSize: 21, fontWeight: 600, color: 'rgba(255,255,255,0.5)'}}>
							ShipSpace — New Mission
						</span>
						<span
							style={{
								marginLeft: 'auto',
								fontFamily: FONT,
								fontSize: 15,
								fontWeight: 700,
								letterSpacing: '0.18em',
								color: PURPLE,
								textTransform: 'uppercase',
							}}
						>
							⌘K
						</span>
					</div>
					<div style={{padding: '58px 64px 64px'}}>
						<div
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 28,
								padding: '34px 42px',
								borderRadius: 20,
								background: 'rgba(255,255,255,0.05)',
								border: `1.5px solid ${PURPLE}77`,
								boxShadow: `0 0 70px ${PURPLE}22 inset, 0 0 50px ${PURPLE}1c`,
							}}
						>
							<WaveBars accent={PURPLE} />
							<div style={{fontFamily: MONO, fontSize: 34, color: 'white', whiteSpace: 'pre'}}>
								{text}
								<span style={{opacity: caretOn ? 1 : 0, color: PURPLE}}>▍</span>
							</div>
						</div>
						<div style={{marginTop: 30, display: 'flex', gap: 14}}>
							{['Roster: research · build · review · verify', 'Real files on disk', 'Verdict required'].map(
								(p, i) => (
									<span
										key={p}
										style={{
											fontFamily: FONT,
											fontSize: 19,
											fontWeight: 600,
											color: 'rgba(255,255,255,0.6)',
											padding: '10px 22px',
											borderRadius: 999,
											border: '1px solid rgba(255,255,255,0.13)',
											background: 'rgba(255,255,255,0.04)',
											opacity: interpolate(frame, [22 + i * 7, 32 + i * 7], [0, 1], {
												extrapolateLeft: 'clamp',
												extrapolateRight: 'clamp',
											}),
										}}
									>
										{p}
									</span>
								)
							)}
						</div>
					</div>
				</div>
			</AbsoluteFill>
			{/* kinetic word */}
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					bottom: 100,
					textAlign: 'center',
					opacity: interpolate(frame, [6, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
					transform: `translateY(${interpolate(spring({frame: frame - 6, fps, config: {damping: 15}}), [0, 1], [50, 0])}px)`,
				}}
			>
				<ChromaText size={108}>
					Describe<span style={{color: PURPLE}}>.</span>
				</ChromaText>
			</div>
			<FlashCut at={1} />
		</AbsoluteFill>
	);
};

// ─── Scene 3 · Orchestrate ───────────────────────────────────────────────────
const AGENT_FEEDS: {name: string; accent: string; lines: string[]}[] = [
	{
		name: 'Claude Code',
		accent: PURPLE,
		lines: [
			'$ role: implementation',
			'› scanning src/auth/**',
			'✓ token rotation patched',
			'› writing tests…',
			'✓ 14 tests added',
			'› staging diff: +212 −41',
			'✓ implementation ready',
		],
	},
	{
		name: 'Codex',
		accent: PINK,
		lines: [
			'$ role: review',
			'› reading branch diff',
			'⚠ unsafe regex · L142',
			'› auditing deps…',
			'✓ 0 vulnerable deps',
			'› notes → verdict.md',
			'✓ review complete',
		],
	},
	{
		name: 'opencode',
		accent: GREEN,
		lines: [
			'$ role: verification',
			'› npm test --all',
			'✓ 312 passing',
			'› e2e: auth flows',
			'✓ 9/9 scenarios',
			'› perf baseline held',
			'✓ verified on disk',
		],
	},
];

const TerminalSlab: React.FC<{
	feed: (typeof AGENT_FEEDS)[number];
	index: number;
	focus: number; // 0..2 which card is sharp
}> = ({feed, index, focus}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const enter = spring({frame: frame - index * 7, fps, config: {damping: 17, mass: 0.8}});
	const visible = Math.max(0, Math.floor((frame - 16 - index * 7) / 9));
	const shown = feed.lines.slice(0, visible);
	const dist = Math.abs(index - focus);
	const blur = dist * 2.4;
	return (
		<div
			style={{
				width: 560,
				height: 500,
				flexShrink: 0,
				borderRadius: 22,
				position: 'relative',
				background: 'linear-gradient(180deg, rgba(18,18,24,0.95) 0%, rgba(8,8,12,0.98) 100%)',
				border: '1px solid rgba(255,255,255,0.12)',
				boxShadow: `0 50px 130px rgba(0,0,0,0.85), 0 0 110px ${feed.accent}21, inset 0 1px 0 rgba(255,255,255,0.10)`,
				overflow: 'hidden',
				opacity: interpolate(enter, [0, 0.5], [0, 1], {extrapolateRight: 'clamp'}),
				transform: `translateY(${interpolate(enter, [0, 1], [110, 0])}px) translateZ(${-dist * 70}px)`,
				filter: `blur(${blur}px) brightness(${1 - dist * 0.16})`,
			}}
		>
			<Sweep delay={20 + index * 9} intensity={0.12} />
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 13,
					padding: '18px 26px',
					borderBottom: '1px solid rgba(255,255,255,0.07)',
					background: 'rgba(255,255,255,0.025)',
				}}
			>
				<span
					style={{
						width: 11,
						height: 11,
						borderRadius: '50%',
						background: feed.accent,
						boxShadow: `0 0 14px ${feed.accent}`,
					}}
				/>
				<span style={{fontFamily: FONT, fontSize: 23, fontWeight: 700, color: 'white'}}>{feed.name}</span>
				<span
					style={{
						marginLeft: 'auto',
						fontFamily: FONT,
						fontSize: 14,
						fontWeight: 700,
						letterSpacing: '0.16em',
						color: feed.accent,
						textTransform: 'uppercase',
						padding: '6px 14px',
						borderRadius: 999,
						border: `1px solid ${feed.accent}66`,
						background: `${feed.accent}14`,
					}}
				>
					running
				</span>
			</div>
			<div style={{padding: '24px 30px', fontFamily: MONO, fontSize: 22, lineHeight: 1.9}}>
				{shown.map((line, i) => (
					<div
						key={i}
						style={{
							color: line.startsWith('✓')
								? GREEN
								: line.startsWith('⚠')
								? ORANGE
								: line.startsWith('$')
								? 'rgba(255,255,255,0.45)'
								: 'rgba(255,255,255,0.85)',
							textShadow: line.startsWith('✓') ? `0 0 18px ${GREEN}55` : undefined,
						}}
					>
						{line}
					</div>
				))}
				{visible < feed.lines.length ? (
					<span style={{color: feed.accent, opacity: Math.floor(frame / 7) % 2 === 0 ? 1 : 0}}>▍</span>
				) : null}
			</div>
		</div>
	);
};

const OrchestrateScene: React.FC<{duration: number}> = ({duration}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const out = interpolate(frame, [duration - 5, duration], [1, 0], {extrapolateLeft: 'clamp'});
	// rack-focus: camera pans across the three slabs, focus follows
	const focus = interpolate(frame, [0, 45, 90], [0, 1, 2], {
		extrapolateRight: 'clamp',
		easing: Easing.inOut(Easing.quad),
	});
	const pan = interpolate(frame, [0, duration], [330, -330], {easing: Easing.inOut(Easing.quad)});
	return (
		<AbsoluteFill style={{opacity: out, perspective: 2000}}>
			<div
				style={{
					position: 'absolute',
					left: '28%',
					top: '20%',
					width: '44%',
					height: '50%',
					borderRadius: '50%',
					background: `radial-gradient(circle, ${PINK}1f 0%, transparent 75%)`,
					filter: 'blur(80px)',
				}}
			/>
			<Particles count={14} />
			<AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
				<div
					style={{
						display: 'flex',
						gap: 52,
						transform: `translateX(${pan}px) translateY(-64px) rotateY(${interpolate(frame, [0, duration], [-9, 6])}deg) rotateX(3.5deg)`,
						transformStyle: 'preserve-3d',
					}}
				>
					{AGENT_FEEDS.map((feed, i) => (
						<TerminalSlab key={feed.name} feed={feed} index={i} focus={focus} />
					))}
				</div>
			</AbsoluteFill>
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					bottom: 96,
					textAlign: 'center',
					opacity: interpolate(frame, [8, 18], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
					transform: `translateY(${interpolate(spring({frame: frame - 8, fps, config: {damping: 15}}), [0, 1], [50, 0])}px)`,
				}}
			>
				<ChromaText size={108}>
					Orchestrate<span style={{color: PINK}}>.</span>
				</ChromaText>
				<div
					style={{
						fontFamily: FONT,
						fontSize: 29,
						fontWeight: 500,
						color: 'rgba(255,255,255,0.6)',
						marginTop: 16,
						opacity: interpolate(frame, [18, 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
					}}
				>
					Every agent. In parallel. One window.
				</div>
			</div>
			<FlashCut at={1} />
			<Flare at={4} color={`${PINK}`} peak={0.35} />
		</AbsoluteFill>
	);
};

// ─── Scene 4 · Ship the Verdict ──────────────────────────────────────────────
const VerdictScene: React.FC<{duration: number}> = ({duration}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const out = interpolate(frame, [duration - 5, duration], [1, 0], {extrapolateLeft: 'clamp'});
	const card = spring({frame: frame - 6, fps, config: {damping: 15, mass: 0.85}});
	const checks = ['Implementation', 'Tests', 'Review', 'Verification'];
	const push = interpolate(frame, [0, duration], [1, 1.07]);
	return (
		<AbsoluteFill style={{opacity: out}}>
			<div
				style={{
					position: 'absolute',
					left: '26%',
					top: '16%',
					width: '48%',
					height: '56%',
					borderRadius: '50%',
					background: `radial-gradient(circle, ${GREEN}21 0%, transparent 72%)`,
					filter: 'blur(85px)',
				}}
			/>
			<Particles count={12} />
			<AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', transform: `scale(${push})`, perspective: 1800}}>
				<div
					style={{
						width: 960,
						borderRadius: 26,
						position: 'relative',
						background: 'linear-gradient(180deg, rgba(16,20,18,0.95) 0%, rgba(8,10,9,0.98) 100%)',
						border: `1px solid ${GREEN}55`,
						boxShadow: `0 60px 160px rgba(0,0,0,0.9), 0 0 170px ${GREEN}26, inset 0 1px 0 rgba(255,255,255,0.10)`,
						padding: '50px 60px',
						transform: `rotateX(${interpolate(card, [0, 1], [12, 2])}deg) translateY(${interpolate(card, [0, 1], [160, -50])}px) scale(${interpolate(card, [0, 1], [0.88, 1])})`,
						opacity: interpolate(card, [0, 0.3], [0, 1], {extrapolateRight: 'clamp'}),
					}}
				>
					<Sweep delay={14} intensity={0.13} />
					<div style={{display: 'flex', alignItems: 'center', gap: 24, marginBottom: 34}}>
						<div
							style={{
								width: 64,
								height: 64,
								borderRadius: '50%',
								background: `${GREEN}1f`,
								border: `2px solid ${GREEN}`,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontSize: 34,
								color: GREEN,
								fontWeight: 800,
								fontFamily: FONT,
								boxShadow: `0 0 ${interpolate(Math.sin(frame / 9), [-1, 1], [22, 44])}px ${GREEN}77`,
							}}
						>
							✓
						</div>
						<div>
							<div
								style={{
									fontFamily: FONT,
									fontSize: 18,
									fontWeight: 700,
									letterSpacing: '0.24em',
									textTransform: 'uppercase',
									color: 'rgba(255,255,255,0.5)',
								}}
							>
								Mission verdict
							</div>
							<div style={{fontFamily: FONT, fontSize: 46, fontWeight: 800, color: 'white'}}>
								Ready to <span style={{color: GREEN, textShadow: `0 0 40px ${GREEN}66`}}>ship</span>
							</div>
						</div>
						<div style={{marginLeft: 'auto', fontFamily: MONO, fontSize: 27, textAlign: 'right'}}>
							<span style={{color: GREEN}}>+342</span> <span style={{color: '#F87171'}}>−87</span>
							<div style={{fontSize: 18, color: 'rgba(255,255,255,0.45)'}}>12 files · real diff</div>
						</div>
					</div>
					<div style={{display: 'flex', gap: 16}}>
						{checks.map((c, i) => (
							<div
								key={c}
								style={{
									flex: 1,
									fontFamily: FONT,
									fontSize: 21,
									fontWeight: 600,
									color: 'rgba(255,255,255,0.9)',
									padding: '18px 0',
									textAlign: 'center',
									borderRadius: 14,
									border: `1px solid rgba(255,255,255,0.10)`,
									background: 'rgba(255,255,255,0.04)',
									opacity: interpolate(frame, [16 + i * 6, 26 + i * 6], [0, 1], {
										extrapolateLeft: 'clamp',
										extrapolateRight: 'clamp',
									}),
									transform: `translateY(${interpolate(frame, [16 + i * 6, 26 + i * 6], [16, 0], {
										extrapolateLeft: 'clamp',
										extrapolateRight: 'clamp',
									})}px)`,
								}}
							>
								<span style={{color: GREEN, marginRight: 10}}>✓</span>
								{c}
							</div>
						))}
					</div>
				</div>
			</AbsoluteFill>
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					bottom: 96,
					textAlign: 'center',
					opacity: interpolate(frame, [10, 20], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
					transform: `translateY(${interpolate(spring({frame: frame - 10, fps, config: {damping: 15}}), [0, 1], [50, 0])}px)`,
				}}
			>
				<ChromaText size={104}>
					Ship the Verdict<span style={{color: ORANGE}}>.</span>
				</ChromaText>
			</div>
			<FlashCut at={1} />
			<Flare at={10} color={`${GREEN}`} peak={0.4} />
		</AbsoluteFill>
	);
};

// ─── Scene 5 · End card ──────────────────────────────────────────────────────
const EndCard: React.FC<{duration: number}> = ({duration}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const enter = spring({frame, fps, config: {damping: 16, mass: 0.9}});
	const titleSpring = spring({frame: frame - 14, fps, config: {damping: 14, mass: 0.7}});
	const spin = frame * 0.45;
	return (
		<AbsoluteFill>
			<Particles count={18} />
			<AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
				<div style={{textAlign: 'center', marginTop: -30}}>
					<div
						style={{
							position: 'relative',
							width: 430,
							height: 430,
							margin: '0 auto',
							opacity: interpolate(enter, [0, 0.6], [0, 1]),
							transform: `scale(${interpolate(enter, [0, 1], [0.66, 1])})`,
						}}
					>
						<div
							style={{
								position: 'absolute',
								inset: -130,
								borderRadius: '50%',
								background: `radial-gradient(circle, rgba(255,255,255,${interpolate(Math.sin(frame / 16), [-1, 1], [0.05, 0.1])}) 0%, transparent 60%)`,
							}}
						/>
						<Img
							src={staticFile('msh-globe.png')}
							style={{
								position: 'absolute',
								inset: 35,
								width: 360,
								height: 360,
								transform: `rotate(${spin}deg)`,
								filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.25))',
							}}
						/>
						<Img
							src={staticFile('msh-text-ring.png')}
							style={{position: 'absolute', inset: 0, width: 430, height: 430}}
						/>
					</div>
					<div
						style={{
							marginTop: 34,
							fontFamily: FONT,
							fontWeight: 800,
							fontSize: 136,
							lineHeight: 1,
							letterSpacing: '-0.03em',
							backgroundImage: GRADIENT,
							backgroundClip: 'text',
							WebkitBackgroundClip: 'text',
							color: 'transparent',
							filter: `drop-shadow(0 0 50px ${PURPLE}44)`,
							opacity: interpolate(titleSpring, [0, 0.4], [0, 1], {extrapolateRight: 'clamp'}),
							transform: `translateY(${interpolate(titleSpring, [0, 1], [55, 0])}px)`,
						}}
					>
						ShipSpace
					</div>
					<div
						style={{
							fontFamily: FONT,
							fontWeight: 600,
							fontSize: 30,
							color: 'rgba(255,255,255,0.7)',
							marginTop: 22,
							opacity: interpolate(frame, [30, 42], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
						}}
					>
						One ADE. Every agent. <span style={{color: 'white', fontWeight: 700}}>Ship the verdict.</span>
					</div>
					<div
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: 14,
							marginTop: 38,
							padding: '21px 56px',
							borderRadius: 999,
							background: GRADIENT,
							fontFamily: FONT,
							fontSize: 29,
							fontWeight: 700,
							color: 'white',
							position: 'relative',
							overflow: 'hidden',
							boxShadow: `0 0 90px ${PURPLE}66, 0 18px 50px rgba(0,0,0,0.6)`,
							opacity: interpolate(frame, [46, 58], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
							transform: `scale(${interpolate(spring({frame: frame - 46, fps, config: {damping: 13}}), [0, 1], [0.85, 1])})`,
						}}
					>
						<Sweep delay={62} duration={28} intensity={0.35} />
						 Download for macOS →
					</div>
					<div
						style={{
							fontFamily: FONT,
							fontWeight: 700,
							fontSize: 26,
							letterSpacing: '0.05em',
							color: 'rgba(255,255,255,0.85)',
							marginTop: 30,
							opacity: interpolate(frame, [56, 68], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
						}}
					>
						makeshiphappen.tech
					</div>
				</div>
			</AbsoluteFill>
			<Flare at={16} peak={0.6} />
			<FlashCut at={1} />
		</AbsoluteFill>
	);
};

// ─── Film ────────────────────────────────────────────────────────────────────
export const Promo: React.FC = () => {
	const frame = useCurrentFrame();
	const fadeOut = interpolate(frame, [PROMO_DURATION - 10, PROMO_DURATION], [1, 0], {
		extrapolateLeft: 'clamp',
	});
	return (
		<AbsoluteFill style={{background: BG}}>
			<AbsoluteFill style={{opacity: fadeOut}}>
				<CameraDrift>
					<Sequence durationInFrames={80}>
						<OpeningScene duration={80} />
					</Sequence>
					<Sequence from={80} durationInFrames={68}>
						<DescribeScene duration={68} />
					</Sequence>
					<Sequence from={148} durationInFrames={112}>
						<OrchestrateScene duration={112} />
					</Sequence>
					<Sequence from={260} durationInFrames={80}>
						<VerdictScene duration={80} />
					</Sequence>
					<Sequence from={340} durationInFrames={PROMO_DURATION - 340}>
						<EndCard duration={PROMO_DURATION - 340} />
					</Sequence>
				</CameraDrift>
				<Vignette />
				<FilmGrain />
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
