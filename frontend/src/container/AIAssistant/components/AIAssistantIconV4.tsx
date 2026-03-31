/**
 * V4 — "Neural Spark"
 * Bear head with a glowing 6-point neural spark / asterisk replacing the
 * goggle. Conveys AI energy and intelligence. The spark is SigNoz red with
 * a soft outer glow ring. More expressive, slightly playful.
 */

interface Props { size?: number; className?: string }

export default function AIAssistantIconV4({ size = 24, className }: Props): JSX.Element {
	// Spark line helper — draws one arm of the asterisk from centre
	const arm = (angleDeg: number, r1: number, r2: number): string => {
		const rad = (angleDeg * Math.PI) / 180;
		const x1 = 16 + r1 * Math.cos(rad);
		const y1 = 18 + r1 * Math.sin(rad);
		const x2 = 16 + r2 * Math.cos(rad);
		const y2 = 18 + r2 * Math.sin(rad);
		return `M${x1} ${y1} L${x2} ${y2}`;
	};

	const angles = [0, 30, 60, 90, 120, 150]; // 6 arms × 2 directions = full star

	return (
		<svg width={size} height={size} viewBox="0 0 32 32" fill="none"
			xmlns="http://www.w3.org/2000/svg" className={className}
			aria-label="AI Assistant" role="img">

			{/* Ears */}
			<path d="M7 13 C7 8 4 6 4 11 C4 14 6.5 15 9 15"
				fill="#F0EEE9" />
			<path d="M25 13 C25 8 28 6 28 11 C28 14 25.5 15 23 15"
				fill="#F0EEE9" />

			{/* Head */}
			<rect x="6" y="11" width="20" height="16" rx="8" fill="#F0EEE9" />

			{/* Glow halo */}
			<circle cx="16" cy="18" r="5.5" fill="#E8432D" opacity="0.08" />
			<circle cx="16" cy="18" r="4"   fill="#E8432D" opacity="0.10" />

			{/* Spark arms */}
			{angles.map((a) => (
				<path key={a} d={arm(a, 1.5, 4.8)}
					stroke="#E8432D" strokeWidth="1.4" strokeLinecap="round" />
			))}

			{/* Centre dot */}
			<circle cx="16" cy="18" r="1.6" fill="#E8432D" />

			{/* Nose */}
			<ellipse cx="16" cy="24.5" rx="1.6" ry="1" fill="#C9C5BD" />
		</svg>
	);
}
