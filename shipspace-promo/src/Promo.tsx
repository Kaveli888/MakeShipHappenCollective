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
export const PROMO_DURATION = 1800; // 60s

const BG = '#0A0A0A';
const GRAPHITE = '#101314';
const PANEL = '#152020';
const GREEN = '#22C55E';
const TEAL = '#14B8A6';
const WHITE = '#F8FAFC';
const MUTED = 'rgba(248,250,252,0.62)';
const FONT =
	"-apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'SF Mono', Menlo, Monaco, Consolas, monospace";
const ease = Easing.bezier(0.16, 1, 0.3, 1);

const fade = (frame: number, start: number, end: number) =>
	interpolate(frame, [start, end], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: ease,
	});

const Background: React.FC = () => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill style={{background: BG, overflow: 'hidden'}}>
			<div
				style={{
					position: 'absolute',
					inset: -220,
					background:
						'radial-gradient(circle at 48% 38%, rgba(20,184,166,0.16), transparent 32%), radial-gradient(circle at 70% 64%, rgba(34,197,94,0.12), transparent 34%), linear-gradient(135deg, #0A0A0A 0%, #101314 58%, #07100f 100%)',
					transform: `translateY(${Math.sin(frame / 120) * 18}px) scale(1.04)`,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					inset: 0,
					backgroundImage:
						'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)',
					backgroundSize: '78px 78px',
					opacity: 0.18,
					transform: `perspective(900px) rotateX(62deg) translateY(${frame * 0.32}px)`,
					transformOrigin: '50% 70%',
				}}
			/>
			{Array.from({length: 34}, (_, i) => {
				const x = (Math.sin(i * 92.71) * 0.5 + 0.5) * 1920;
				const y = ((Math.cos(i * 41.37) * 0.5 + 0.5) * 1080 + frame * (0.12 + i * 0.003)) % 1120;
				const s = 1.2 + (i % 5) * 0.7;
				return (
					<div
						key={i}
						style={{
							position: 'absolute',
							left: x,
							top: y,
							width: s,
							height: s,
							borderRadius: '50%',
							background: i % 3 === 0 ? TEAL : WHITE,
							opacity: 0.12 + Math.sin(frame / 30 + i) * 0.05,
							filter: 'blur(0.6px)',
						}}
					/>
				);
			})}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					background:
						'radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.82) 100%)',
				}}
			/>
		</AbsoluteFill>
	);
};

const Noise: React.FC = () => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill
			style={{
				opacity: 0.045,
				mixBlendMode: 'overlay',
				backgroundImage: `url(${staticFile('noise.png')})`,
				backgroundRepeat: 'repeat',
				backgroundPosition: `${(frame * 47) % 512}px ${(frame * 31) % 512}px`,
			}}
		/>
	);
};

const Lens: React.FC<{at: number; color?: string}> = ({at, color = TEAL}) => {
	const frame = useCurrentFrame();
	const o = interpolate(frame, [at - 8, at, at + 24], [0, 0.75, 0], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});
	if (o < 0.01) return null;
	return (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: o}}>
			<div
				style={{
					width: '118%',
					height: 3,
					background: `linear-gradient(90deg, transparent, ${color}, ${WHITE}, ${color}, transparent)`,
					filter: 'blur(2px)',
					boxShadow: `0 0 70px ${color}`,
				}}
			/>
		</AbsoluteFill>
	);
};

const Kicker: React.FC<{children: React.ReactNode; delay?: number}> = ({children, delay = 0}) => {
	const frame = useCurrentFrame();
	const o = fade(frame, delay, delay + 18);
	return (
		<div
			style={{
				fontFamily: FONT,
				fontSize: 20,
				fontWeight: 700,
				letterSpacing: '0.28em',
				textTransform: 'uppercase',
				color: TEAL,
				opacity: o,
				transform: `translateY(${(1 - o) * 18}px)`,
			}}
		>
			{children}
		</div>
	);
};

const BigText: React.FC<{children: React.ReactNode; delay?: number; size?: number}> = ({
	children,
	delay = 0,
	size = 112,
}) => {
	const frame = useCurrentFrame();
	const v = spring({frame: frame - delay, fps: 30, config: {damping: 18, mass: 0.7}});
	return (
		<div
			style={{
				fontFamily: FONT,
				fontSize: size,
				fontWeight: 820,
				letterSpacing: 0,
				lineHeight: 0.96,
				color: WHITE,
				opacity: interpolate(v, [0, 0.28], [0, 1], {extrapolateRight: 'clamp'}),
				transform: `translateY(${interpolate(v, [0, 1], [54, 0])}px)`,
				textShadow: `0 0 70px rgba(20,184,166,0.24)`,
			}}
		>
			{children}
		</div>
	);
};

const Panel: React.FC<{
	children: React.ReactNode;
	w?: number;
	h?: number;
	accent?: string;
	style?: React.CSSProperties;
	delay?: number;
}> = ({children, w = 460, h = 280, accent = TEAL, style, delay = 0}) => {
	const frame = useCurrentFrame();
	const v = spring({frame: frame - delay, fps: 30, config: {damping: 18, mass: 0.75}});
	return (
		<div
			style={{
				position: 'relative',
				width: w,
				height: h,
				borderRadius: 8,
				background:
					'linear-gradient(180deg, rgba(21,32,32,0.82) 0%, rgba(10,14,14,0.92) 100%)',
				border: '1px solid rgba(255,255,255,0.12)',
				boxShadow: `0 44px 120px rgba(0,0,0,0.62), 0 0 110px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.11)`,
				backdropFilter: 'blur(22px)',
				overflow: 'hidden',
				opacity: interpolate(v, [0, 0.35], [0, 1], {extrapolateRight: 'clamp'}),
				transform: `translateY(${interpolate(v, [0, 1], [72, 0])}px) scale(${interpolate(v, [0, 1], [0.94, 1])})`,
				...style,
			}}
		>
			<div
				style={{
					position: 'absolute',
					inset: 0,
					background: `linear-gradient(116deg, rgba(255,255,255,0.08), transparent 34%, ${accent}0d 100%)`,
				}}
			/>
			{children}
		</div>
	);
};

const HeaderDots: React.FC<{title: string; accent?: string}> = ({title, accent = TEAL}) => (
	<div
		style={{
			height: 52,
			display: 'flex',
			alignItems: 'center',
			gap: 10,
			padding: '0 18px',
			borderBottom: '1px solid rgba(255,255,255,0.08)',
			fontFamily: FONT,
			fontSize: 17,
			fontWeight: 700,
			color: 'rgba(255,255,255,0.72)',
		}}
	>
		<span style={{width: 10, height: 10, borderRadius: 10, background: '#FF5F57'}} />
		<span style={{width: 10, height: 10, borderRadius: 10, background: '#FEBC2E'}} />
		<span style={{width: 10, height: 10, borderRadius: 10, background: accent}} />
		<span style={{marginLeft: 10}}>{title}</span>
	</div>
);

const TerminalLines: React.FC<{lines: string[]; start?: number; accent?: string}> = ({
	lines,
	start = 0,
	accent = GREEN,
}) => {
	const frame = useCurrentFrame();
	const visible = Math.max(0, Math.floor((frame - start) / 11));
	return (
		<div style={{fontFamily: MONO, fontSize: 18, lineHeight: 1.78, padding: '20px 24px'}}>
			{lines.slice(0, visible).map((line, i) => (
				<div
					key={i}
					style={{
						color: line.startsWith('complete') || line.startsWith('passed') ? accent : MUTED,
						textShadow: line.startsWith('complete') || line.startsWith('passed') ? `0 0 24px ${accent}66` : undefined,
					}}
				>
					{line}
				</div>
			))}
			<span style={{color: accent, opacity: Math.floor(frame / 9) % 2 ? 0.2 : 1}}>▌</span>
		</div>
	);
};

const Connections: React.FC<{active?: number}> = ({active = 1}) => {
	const frame = useCurrentFrame();
	return (
		<svg style={{position: 'absolute', inset: 0, opacity: active}} viewBox="0 0 1920 1080">
			{[
				['450 330 C 690 210, 980 210, 1240 330'],
				['460 560 C 720 660, 1030 660, 1260 560'],
				['680 430 C 860 350, 1040 350, 1220 430'],
				['700 560 C 850 485, 1040 485, 1190 560'],
			].map((d, i) => (
				<path
					key={d}
					d={`M ${d}`}
					fill="none"
					stroke={i % 2 ? GREEN : TEAL}
					strokeWidth="2"
					strokeDasharray="10 18"
					strokeDashoffset={-frame * (2 + i)}
					opacity={0.42}
					filter="drop-shadow(0 0 10px rgba(20,184,166,0.8))"
				/>
			))}
		</svg>
	);
};

const Opening: React.FC<{duration: number}> = ({duration}) => {
	const frame = useCurrentFrame();
	const out = interpolate(frame, [duration - 24, duration], [1, 0], {extrapolateLeft: 'clamp'});
	const cursor = Math.floor(frame / 12) % 2;
	return (
		<AbsoluteFill style={{opacity: out}}>
			<div style={{position: 'absolute', left: 250, top: 320}}>
				<Kicker delay={18}>SHIPSPACE</Kicker>
				<BigText delay={42} size={122}>One Workspace.</BigText>
				<BigText delay={96} size={122}>Every Agent.</BigText>
				<div
					style={{
						marginTop: 34,
						fontFamily: MONO,
						fontSize: 30,
						color: cursor ? GREEN : 'transparent',
						opacity: fade(frame, 4, 20),
					}}
				>
					_
				</div>
			</div>
			<Panel
				w={780}
				h={470}
				delay={132}
				style={{
					position: 'absolute',
					right: 155,
					top: 275,
					transform: `perspective(1200px) rotateY(-14deg) rotateX(7deg) translateY(${Math.sin(frame / 60) * 8}px)`,
				}}
			>
				<HeaderDots title="ShipSpace Command Center" />
				<div style={{display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', height: 418}}>
					<div style={{borderRight: '1px solid rgba(255,255,255,0.08)'}}>
						<TerminalLines
							start={146}
							lines={[
								'$ shipspace swarm deploy',
								'architect: planning feature map',
								'builder: opening workspace',
								'tester: preparing suite',
								'reviewer: reading diff policy',
								'complete: swarm online',
							]}
						/>
					</div>
					<div style={{padding: 22}}>
						{['Architect', 'Builder', 'Tester', 'Reviewer'].map((name, i) => (
							<div
								key={name}
								style={{
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'space-between',
									marginBottom: 18,
									padding: '14px 16px',
									borderRadius: 8,
									background: 'rgba(255,255,255,0.045)',
									border: '1px solid rgba(255,255,255,0.08)',
									opacity: fade(frame, 150 + i * 12, 166 + i * 12),
								}}
							>
								<span style={{fontFamily: FONT, color: WHITE, fontWeight: 700}}>{name}</span>
								<span style={{fontFamily: MONO, fontSize: 12, color: GREEN}}>ONLINE</span>
							</div>
						))}
					</div>
				</div>
			</Panel>
		</AbsoluteFill>
	);
};

const Agents: React.FC<{duration: number}> = ({duration}) => {
	const frame = useCurrentFrame();
	const out = interpolate(frame, [duration - 24, duration], [1, 0], {extrapolateLeft: 'clamp'});
	const agents = [
		['Architect', 'THINKING', 260, 250],
		['Builder', 'CODING', 1220, 250],
		['Tester', 'TESTING', 310, 590],
		['Reviewer', 'REVIEWING', 1180, 590],
	];
	return (
		<AbsoluteFill style={{opacity: out}}>
			<Connections active={fade(frame, 70, 100)} />
			<div style={{position: 'absolute', left: 710, top: 130, textAlign: 'center'}}>
				<Kicker delay={12}>MULTI-AGENT ORCHESTRATION</Kicker>
				<BigText delay={30} size={82}>Deploy a Swarm.</BigText>
			</div>
			{agents.map(([name, status, x, y], i) => (
				<Panel
					key={name}
					w={420}
					h={210}
					delay={46 + i * 16}
					accent={i % 2 ? GREEN : TEAL}
					style={{position: 'absolute', left: Number(x), top: Number(y)}}
				>
					<div style={{padding: 26}}>
						<div style={{fontFamily: FONT, fontSize: 32, fontWeight: 800, color: WHITE}}>{name}</div>
						<div
							style={{
								marginTop: 28,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								fontFamily: MONO,
								color: i % 2 ? GREEN : TEAL,
							}}
						>
							<span>{status}</span>
							<span
								style={{
									width: 14,
									height: 14,
									borderRadius: 14,
									background: i % 2 ? GREEN : TEAL,
									boxShadow: `0 0 28px ${i % 2 ? GREEN : TEAL}`,
									opacity: 0.45 + Math.sin(frame / 8 + i) * 0.35,
								}}
							/>
						</div>
						<div style={{marginTop: 22, height: 7, borderRadius: 8, background: 'rgba(255,255,255,0.08)'}}>
							<div
								style={{
									width: `${44 + ((frame * (0.6 + i * 0.16)) % 52)}%`,
									height: '100%',
									borderRadius: 8,
									background: `linear-gradient(90deg, ${TEAL}, ${GREEN})`,
								}}
							/>
						</div>
					</div>
				</Panel>
			))}
		</AbsoluteFill>
	);
};

const Parallel: React.FC<{duration: number}> = ({duration}) => {
	const frame = useCurrentFrame();
	const out = interpolate(frame, [duration - 24, duration], [1, 0], {extrapolateLeft: 'clamp'});
	const feeds = [
		['Claude', ['$ plan workspace model', 'reading product spec', 'mapping edge cases', 'complete: plan locked']],
		['Codex', ['$ implement feature', 'editing src/agents', 'running typecheck', 'complete: code ready']],
		['OpenCode', ['$ verify branch', 'npm test --workspace', 'passed: 128 tests', 'complete: verified']],
	];
	return (
		<AbsoluteFill style={{opacity: out, perspective: 1600}}>
			<div style={{position: 'absolute', left: 140, top: 112}}>
				<Kicker delay={12}>PARALLEL EXECUTION</Kicker>
				<BigText delay={28} size={82}>Claude. Codex. OpenCode.</BigText>
			</div>
			<div
				style={{
					position: 'absolute',
					left: 130,
					top: 320,
					display: 'flex',
					gap: 34,
					transform: `rotateX(8deg) rotateY(${interpolate(frame, [0, duration], [-7, 5])}deg)`,
					transformStyle: 'preserve-3d',
				}}
			>
				{feeds.map(([name, lines], i) => (
					<Panel key={String(name)} w={520} h={390} delay={54 + i * 14} accent={i === 1 ? GREEN : TEAL}>
						<HeaderDots title={String(name)} accent={i === 1 ? GREEN : TEAL} />
						<TerminalLines lines={lines as string[]} start={74 + i * 12} accent={i === 1 ? GREEN : TEAL} />
					</Panel>
				))}
			</div>
			<div
				style={{
					position: 'absolute',
					left: 700,
					bottom: 105,
					fontFamily: FONT,
					fontSize: 36,
					fontWeight: 760,
					color: WHITE,
					opacity: fade(frame, 150, 176),
				}}
			>
				Real-time collaboration. One command surface.
			</div>
		</AbsoluteFill>
	);
};

const Workspace: React.FC<{duration: number}> = ({duration}) => {
	const frame = useCurrentFrame();
	const out = interpolate(frame, [duration - 24, duration], [1, 0], {extrapolateLeft: 'clamp'});
	const names = ['Terminal', 'Kanban', 'Logs', 'Browser', 'Files', 'Agent Chat'];
	return (
		<AbsoluteFill style={{opacity: out}}>
			<div style={{position: 'absolute', left: 150, top: 106}}>
				<Kicker delay={10}>UNIFIED WORKSPACE</Kicker>
				<BigText delay={30} size={88}>One Command Center.</BigText>
			</div>
			<div style={{position: 'absolute', left: 120, right: 120, top: 300, bottom: 110}}>
				{names.map((name, i) => {
					const cols = [
						[0, 0, 720, 330],
						[750, 0, 390, 330],
						[1170, 0, 510, 330],
						[0, 360, 560, 300],
						[590, 360, 460, 300],
						[1080, 360, 600, 300],
					][i];
					return (
						<Panel
							key={name}
							w={cols[2]}
							h={cols[3]}
							delay={46 + i * 8}
							accent={i % 2 ? GREEN : TEAL}
							style={{
								position: 'absolute',
								left: cols[0],
								top: cols[1],
								transform: `translateY(${Math.sin(frame / 44 + i) * 5}px)`,
							}}
						>
							<HeaderDots title={name} accent={i % 2 ? GREEN : TEAL} />
							<div style={{padding: 22, fontFamily: i === 0 || i === 2 ? MONO : FONT, color: MUTED}}>
								{Array.from({length: i === 1 ? 4 : 6}, (_, n) => (
									<div
										key={n}
										style={{
											height: i === 1 ? 42 : 18,
											marginBottom: 14,
											borderRadius: 6,
											width: `${88 - ((n + i) % 4) * 13}%`,
											background:
												i === 1
													? 'rgba(255,255,255,0.055)'
													: `linear-gradient(90deg, rgba(255,255,255,0.13), rgba(20,184,166,${0.1 + n * 0.02}))`,
											opacity: fade(frame, 70 + i * 6 + n * 4, 85 + i * 6 + n * 4),
										}}
									/>
								))}
							</div>
						</Panel>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};

const Knowledge: React.FC<{duration: number}> = ({duration}) => {
	const frame = useCurrentFrame();
	const out = interpolate(frame, [duration - 24, duration], [1, 0], {extrapolateLeft: 'clamp'});
	const assets = ['PDFs', 'Audio', 'Video', 'Notes', 'Websites', 'CSV'];
	return (
		<AbsoluteFill style={{opacity: out}}>
			<div style={{position: 'absolute', left: 150, top: 120}}>
				<Kicker delay={8}>SHIPMIND INTEGRATION</Kicker>
				<BigText delay={28} size={88}>Your Private Second Brain.</BigText>
			</div>
			<div
				style={{
					position: 'absolute',
					left: 740,
					top: 382,
					width: 440,
					height: 440,
					borderRadius: 440,
					border: '1px solid rgba(20,184,166,0.45)',
					boxShadow: `0 0 140px rgba(20,184,166,0.24), inset 0 0 80px rgba(34,197,94,0.10)`,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontFamily: FONT,
					fontSize: 40,
					fontWeight: 830,
					color: WHITE,
					opacity: fade(frame, 50, 80),
				}}
			>
				ShipMind
			</div>
			{assets.map((asset, i) => {
				const angle = (Math.PI * 2 * i) / assets.length + frame / 220;
				const x = 960 + Math.cos(angle) * 560;
				const y = 605 + Math.sin(angle) * 280;
				return (
					<Panel
						key={asset}
						w={190}
						h={96}
						delay={70 + i * 10}
						accent={i % 2 ? GREEN : TEAL}
						style={{position: 'absolute', left: x - 95, top: y - 48}}
					>
						<div
							style={{
								height: '100%',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontFamily: FONT,
								fontSize: 24,
								fontWeight: 760,
								color: WHITE,
							}}
						>
							{asset}
						</div>
					</Panel>
				);
			})}
		</AbsoluteFill>
	);
};

const Execution: React.FC<{duration: number}> = ({duration}) => {
	const frame = useCurrentFrame();
	const out = interpolate(frame, [duration - 24, duration], [1, 0], {extrapolateLeft: 'clamp'});
	return (
		<AbsoluteFill style={{opacity: out}}>
			<div style={{position: 'absolute', left: 160, top: 128}}>
				<Kicker delay={10}>FROM PROMPT TO PRODUCTION</Kicker>
				<BigText delay={30} size={88}>Build the feature.</BigText>
			</div>
			<Panel w={1160} h={560} delay={55} style={{position: 'absolute', left: 380, top: 345}}>
				<HeaderDots title="ShipSpace Execution" />
				<div style={{display: 'grid', gridTemplateColumns: '1fr 360px', height: 508}}>
					<TerminalLines
						start={78}
						lines={[
							'$ user: Build the feature.',
							'architect: task graph created',
							'builder: code generated',
							'tester: suite running',
							'passed: unit and e2e',
							'reviewer: diff approved',
							'complete: deployment ready',
						]}
					/>
					<div style={{borderLeft: '1px solid rgba(255,255,255,0.08)', padding: 26}}>
						{['Plan', 'Code', 'Test', 'Review', 'Deploy'].map((s, i) => (
							<div key={s} style={{marginBottom: 28, opacity: fade(frame, 95 + i * 22, 112 + i * 22)}}>
								<div style={{display: 'flex', justifyContent: 'space-between', fontFamily: FONT, color: WHITE, fontWeight: 760}}>
									<span>{s}</span>
									<span style={{color: GREEN}}>complete</span>
								</div>
								<div style={{height: 8, borderRadius: 8, background: 'rgba(255,255,255,0.08)', marginTop: 10}}>
									<div style={{height: 8, borderRadius: 8, width: '100%', background: `linear-gradient(90deg, ${TEAL}, ${GREEN})`}} />
								</div>
							</div>
						))}
					</div>
				</div>
			</Panel>
		</AbsoluteFill>
	);
};

const Ecosystem: React.FC<{duration: number}> = ({duration}) => {
	const frame = useCurrentFrame();
	const out = interpolate(frame, [duration - 24, duration], [1, 0], {extrapolateLeft: 'clamp'});
	const nodes = ['Agents', 'Workspaces', 'Knowledge', 'Execution'];
	return (
		<AbsoluteFill style={{opacity: out}}>
			<Connections active={0.7} />
			<div style={{position: 'absolute', left: 150, top: 112}}>
				<Kicker delay={10}>THE BUILDER OPERATING SYSTEM</Kicker>
				<BigText delay={32} size={86}>Everything connected.</BigText>
			</div>
			<Img
				src={staticFile('shipspace-logo.png')}
				style={{
					position: 'absolute',
					left: 790,
					top: 365,
					width: 340,
					height: 340,
					objectFit: 'contain',
					filter: `drop-shadow(0 0 80px rgba(34,197,94,0.42))`,
					opacity: fade(frame, 45, 75),
					transform: `scale(${1 + Math.sin(frame / 55) * 0.025})`,
				}}
			/>
			{nodes.map((node, i) => {
				const angle = (Math.PI * 2 * i) / nodes.length - Math.PI / 4;
				return (
					<Panel
						key={node}
						w={270}
						h={130}
						delay={75 + i * 14}
						style={{
							position: 'absolute',
							left: 960 + Math.cos(angle) * 510 - 135,
							top: 535 + Math.sin(angle) * 265 - 65,
						}}
					>
						<div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontSize: 28, fontWeight: 800, color: WHITE}}>
							{node}
						</div>
					</Panel>
				);
			})}
		</AbsoluteFill>
	);
};

const Final: React.FC = () => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill>
			<div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
				<Panel
					w={980}
					h={560}
					delay={16}
					style={{
						transform: `perspective(1300px) rotateX(7deg) rotateY(-11deg) translateY(${Math.sin(frame / 60) * 8}px)`,
					}}
				>
					<HeaderDots title="ShipSpace" />
					<div style={{padding: 42}}>
						<TerminalLines
							start={36}
							lines={[
								'$ shipspace launch',
								'agents: online',
								'workspace: unified',
								'knowledge: connected',
								'execution: ready',
								'complete: start shipping',
							]}
						/>
					</div>
				</Panel>
			</div>
			<div style={{position: 'absolute', left: 150, top: 150}}>
				<BigText delay={22} size={106}>Build Faster.</BigText>
				<BigText delay={64} size={106}>Ship More.</BigText>
				<BigText delay={106} size={106}>Make Ship Happen.</BigText>
			</div>
			<div style={{position: 'absolute', left: 150, bottom: 112, display: 'flex', alignItems: 'center', gap: 28}}>
				<Img src={staticFile('shipspace-logo.png')} style={{width: 86, height: 86, objectFit: 'contain', opacity: fade(frame, 126, 145)}} />
				<div style={{opacity: fade(frame, 134, 152)}}>
					<div style={{fontFamily: FONT, fontSize: 64, fontWeight: 850, color: WHITE, letterSpacing: 0}}>SHIPSPACE</div>
					<div style={{fontFamily: FONT, fontSize: 25, fontWeight: 700, color: GREEN, marginTop: 10}}>Subscribe. Download. Start Shipping.</div>
				</div>
			</div>
		</AbsoluteFill>
	);
};

export const Promo: React.FC = () => {
	const frame = useCurrentFrame();
	const camera = `translate(${Math.sin(frame / 88) * 10}px, ${Math.cos(frame / 100) * 8}px) scale(${1 + frame / PROMO_DURATION * 0.018})`;
	const overallFade = interpolate(frame, [PROMO_DURATION - 8, PROMO_DURATION], [1, 0], {
		extrapolateLeft: 'clamp',
	});
	return (
		<AbsoluteFill style={{background: BG}}>
			<Background />
			<AbsoluteFill style={{transform: camera, opacity: overallFade}}>
				<Sequence durationInFrames={240}>
					<Opening duration={240} />
				</Sequence>
				<Sequence from={240} durationInFrames={240}>
					<Agents duration={240} />
				</Sequence>
				<Sequence from={480} durationInFrames={240}>
					<Parallel duration={240} />
				</Sequence>
				<Sequence from={720} durationInFrames={240}>
					<Workspace duration={240} />
				</Sequence>
				<Sequence from={960} durationInFrames={240}>
					<Knowledge duration={240} />
				</Sequence>
				<Sequence from={1200} durationInFrames={240}>
					<Execution duration={240} />
				</Sequence>
				<Sequence from={1440} durationInFrames={180}>
					<Ecosystem duration={180} />
				</Sequence>
				<Sequence from={1620} durationInFrames={180}>
					<Final />
				</Sequence>
			</AbsoluteFill>
			<Lens at={238} />
			<Lens at={478} color={GREEN} />
			<Lens at={718} />
			<Lens at={958} color={GREEN} />
			<Lens at={1198} />
			<Lens at={1438} color={GREEN} />
			<Noise />
		</AbsoluteFill>
	);
};
