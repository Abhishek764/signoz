/**
 * AIAssistantIcon — SigNoz AI Assistant icon (V2 — Minimal Line).
 *
 * Single-weight stroke outline of a bear face. Inherits `currentColor` so it
 * adapts to any dark/light context automatically. The only hard-coded color is
 * the SigNoz red (#E8432D) eye bar — one bold accent, nothing else.
 */

interface AIAssistantIconProps {
	size?: number;
	className?: string;
}

export default function AIAssistantIcon({
	size = 24,
	className,
}: AIAssistantIconProps): JSX.Element {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 32 32"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-label="AI Assistant"
			role="img"
		>
			{/* Ears */}
			<path
				d="M8 13.5 C8 8 5 6 5 11 C5 14 7 15.5 9.5 15.5"
				stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
			/>
			<path
				d="M24 13.5 C24 8 27 6 27 11 C27 14 25 15.5 22.5 15.5"
				stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
			/>

			{/* Head */}
			<rect x="7" y="12" width="18" height="15" rx="7"
				stroke="currentColor" strokeWidth="1.5" fill="none" />

			{/* Eye bar — SigNoz red, the only accent */}
			<line x1="10" y1="18" x2="22" y2="18"
				stroke="#E8432D" strokeWidth="2.5" strokeLinecap="round" />
			<circle cx="12" cy="18" r="1" fill="#E8432D" />
			<circle cx="20" cy="18" r="1" fill="#E8432D" />

			{/* Nose */}
			<ellipse cx="16" cy="23.5" rx="1.6" ry="1"
				stroke="currentColor" strokeWidth="1.2" fill="none" />
		</svg>
	);
}
