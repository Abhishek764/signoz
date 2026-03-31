/**
 * V5 — "App Badge"
 * Bear face inside a rounded-square badge — like a product app icon.
 * Dark background with off-white bear + red visor. The badge shape is the
 * primary container, making it ideal for navigation icons, splash screens, or
 * anywhere a "product logo" weight is needed (vs. a utility icon).
 */

interface Props { size?: number; className?: string }

export default function AIAssistantIconV5({ size = 24, className }: Props): JSX.Element {
	return (
		<svg width={size} height={size} viewBox="0 0 32 32" fill="none"
			xmlns="http://www.w3.org/2000/svg" className={className}
			aria-label="AI Assistant" role="img">

			{/* Badge background */}
			<rect x="1" y="1" width="30" height="30" rx="8" fill="#1B1B1F" />

			{/* Subtle inner glow ring on badge */}
			<rect x="1" y="1" width="30" height="30" rx="8"
				stroke="#E8432D" strokeWidth="0.6" opacity="0.35" fill="none" />

			{/* Ears */}
			<path d="M9.5 14 C9.5 10.5 7 9 7 12.5 C7 14.5 8.5 15.5 10.5 15.5"
				fill="#E8E6E1" />
			<path d="M22.5 14 C22.5 10.5 25 9 25 12.5 C25 14.5 23.5 15.5 21.5 15.5"
				fill="#E8E6E1" />

			{/* Head */}
			<rect x="9" y="13" width="14" height="12" rx="6" fill="#E8E6E1" />

			{/* Visor */}
			<rect x="10" y="16" width="12" height="4.5" rx="2.25" fill="#E8432D" />

			{/* Visor highlight / glint */}
			<rect x="11" y="16.8" width="4" height="1" rx="0.5"
				fill="#FFFFFF" opacity="0.35" />

			{/* Centre visor dot (pupil-like) */}
			<circle cx="16" cy="18.25" r="1" fill="#FFFFFF" opacity="0.9" />

			{/* Nose */}
			<ellipse cx="16" cy="22.5" rx="1.4" ry="0.9" fill="#C2BDB5" />
		</svg>
	);
}
