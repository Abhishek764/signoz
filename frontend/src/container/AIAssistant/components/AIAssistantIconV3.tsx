/**
 * V3 — "Eye Lens"
 * Leans into the SigNoz eye logo. The AI icon is a stylised eye inside a
 * bear-shaped pill. The pupil is the SigNoz red circle; radiating scan-lines
 * suggest "observability + intelligence".
 * No animal details — purely abstract / brand-first.
 */

interface Props { size?: number; className?: string }

export default function AIAssistantIconV3({ size = 24, className }: Props): JSX.Element {
	return (
		<svg width={size} height={size} viewBox="0 0 32 32" fill="none"
			xmlns="http://www.w3.org/2000/svg" className={className}
			aria-label="AI Assistant" role="img">

			{/* Ear bumps at top */}
			<ellipse cx="10" cy="10.5" rx="3.5" ry="3" fill="#F0EEE9" />
			<ellipse cx="22" cy="10.5" rx="3.5" ry="3" fill="#F0EEE9" />

			{/* Head / body */}
			<rect x="6" y="11" width="20" height="16" rx="8" fill="#F0EEE9" />

			{/* Outer eye ring */}
			<ellipse cx="16" cy="19" rx="7" ry="4.5"
				stroke="#C9C5BD" strokeWidth="1" fill="none" />

			{/* Iris */}
			<circle cx="16" cy="19" r="3" fill="#E8432D" opacity="0.15" />
			<circle cx="16" cy="19" r="3"
				stroke="#E8432D" strokeWidth="1" fill="none" />

			{/* Pupil */}
			<circle cx="16" cy="19" r="1.4" fill="#E8432D" />

			{/* Scan lines */}
			<line x1="9.5" y1="19" x2="11.5" y2="19"
				stroke="#E8432D" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
			<line x1="20.5" y1="19" x2="22.5" y2="19"
				stroke="#E8432D" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
			<line x1="16" y1="14.5" x2="16" y2="15.5"
				stroke="#E8432D" strokeWidth="0.8" strokeLinecap="round" opacity="0.4" />
			<line x1="16" y1="22.5" x2="16" y2="23.5"
				stroke="#E8432D" strokeWidth="0.8" strokeLinecap="round" opacity="0.4" />
		</svg>
	);
}
