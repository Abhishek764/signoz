/**
 * V2 — "Minimal Line"
 * Single-weight stroke outline of a bear face. No fills, no visor details.
 * The red accent is a single horizontal stroke across where eyes would be.
 * Ultra-clean, works at any size, pairs well with monochrome UIs.
 */

interface Props { size?: number; className?: string }

export default function AIAssistantIconV2({ size = 24, className }: Props): JSX.Element {
	return (
		<svg width={size} height={size} viewBox="0 0 32 32" fill="none"
			xmlns="http://www.w3.org/2000/svg" className={className}
			aria-label="AI Assistant" role="img">

			{/* Ears */}
			<path d="M8 13.5 C8 8 5 6 5 11 C5 14 7 15.5 9.5 15.5"
				stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
			<path d="M24 13.5 C24 8 27 6 27 11 C27 14 25 15.5 22.5 15.5"
				stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />

			{/* Head */}
			<rect x="7" y="12" width="18" height="15" rx="7"
				stroke="currentColor" strokeWidth="1.5" fill="none" />

			{/* Eye bar — SigNoz red accent */}
			<line x1="10" y1="18" x2="22" y2="18"
				stroke="#E8432D" strokeWidth="2.5" strokeLinecap="round" />

			{/* Left eye dot */}
			<circle cx="12" cy="18" r="1" fill="#E8432D" />
			{/* Right eye dot */}
			<circle cx="20" cy="18" r="1" fill="#E8432D" />

			{/* Nose */}
			<ellipse cx="16" cy="23.5" rx="1.6" ry="1"
				stroke="currentColor" strokeWidth="1.2" fill="none" />
		</svg>
	);
}
