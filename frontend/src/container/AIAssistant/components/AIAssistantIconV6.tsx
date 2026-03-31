/**
 * V6 — "Square Panda / Futuristic"
 *
 * Design:
 *  - Square-ish head (low border-radius) — geometric, not organic
 *  - Two square black ear patches clipped to top corners — unmistakably panda
 *  - Wide HUD visor bar across the eye zone (dark glass + red LED pupils)
 *  - Subtle scanline texture on the visor
 *  - Small square muzzle patch with dot nose
 *  - Circuit-trace accent lines on the cheeks
 *  - SigNoz red (#E8432D) used only for the glowing eyes — sharp focal point
 *  - Dark steel palette for the robot elements (#1A1C22, #2C2F38)
 *  - Works equally on dark and light backgrounds
 */

interface Props { size?: number; className?: string }

export default function AIAssistantIconV6({ size = 24, className }: Props): JSX.Element {
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
			{/* ── Ear patches — square black blocks at top-left & top-right ── */}
			<rect x="3"  y="3"  width="8" height="8" rx="1.5" fill="#1A1C22" />
			<rect x="21" y="3"  width="8" height="8" rx="1.5" fill="#1A1C22" />
			{/* Ear inner highlight edge */}
			<rect x="4"  y="4"  width="6" height="6" rx="1"   fill="#252830" />
			<rect x="22" y="4"  width="6" height="6" rx="1"   fill="#252830" />

			{/* ── Main head — square with tight radius ──────────────────────── */}
			<rect x="4" y="7" width="24" height="22" rx="3" fill="#F0EEE9" />

			{/* ── HUD visor bar (dark glass strip across eye zone) ───────────── */}
			<rect x="5" y="13" width="22" height="8" rx="1.5" fill="#1A1C22" />

			{/* Visor inner tint */}
			<rect x="5.5" y="13.5" width="21" height="7" rx="1" fill="#212430" />

			{/* Visor top edge highlight (glass sheen) */}
			<rect x="5.5" y="13.5" width="21" height="1" rx="0.5"
				fill="#FFFFFF" opacity="0.07" />

			{/* Scanline texture — subtle horizontal lines */}
			{[15.2, 16.5, 17.8].map((y) => (
				<line key={y} x1="6" y1={y} x2="26" y2={y}
					stroke="#FFFFFF" strokeWidth="0.3" opacity="0.04" />
			))}

			{/* ── Left LED eye ───────────────────────────────────────────────── */}
			{/* Outer glow */}
			<rect x="8.5" y="14.8" width="5" height="5" rx="1"
				fill="#E8432D" opacity="0.15" />
			{/* Eye body */}
			<rect x="9.5" y="15.5" width="3" height="3.5" rx="0.8" fill="#E8432D" />
			{/* Specular */}
			<rect x="9.8" y="15.8" width="1" height="0.8" rx="0.3"
				fill="#FFFFFF" opacity="0.55" />

			{/* ── Right LED eye ──────────────────────────────────────────────── */}
			<rect x="18.5" y="14.8" width="5" height="5" rx="1"
				fill="#E8432D" opacity="0.15" />
			<rect x="19.5" y="15.5" width="3" height="3.5" rx="0.8" fill="#E8432D" />
			<rect x="19.8" y="15.8" width="1" height="0.8" rx="0.3"
				fill="#FFFFFF" opacity="0.55" />

			{/* ── Visor corner brackets (HUD frame detail) ───────────────────── */}
			{/* top-left */}
			<path d="M6.5 15 L6.5 13.5 L8 13.5"
				stroke="#E8432D" strokeWidth="0.7" strokeLinecap="square" opacity="0.6" />
			{/* top-right */}
			<path d="M25.5 15 L25.5 13.5 L24 13.5"
				stroke="#E8432D" strokeWidth="0.7" strokeLinecap="square" opacity="0.6" />
			{/* bottom-left */}
			<path d="M6.5 19 L6.5 20.5 L8 20.5"
				stroke="#E8432D" strokeWidth="0.7" strokeLinecap="square" opacity="0.6" />
			{/* bottom-right */}
			<path d="M25.5 19 L25.5 20.5 L24 20.5"
				stroke="#E8432D" strokeWidth="0.7" strokeLinecap="square" opacity="0.6" />

			{/* ── Circuit trace — left cheek ─────────────────────────────────── */}
			<path d="M5.5 12 H8 V10.5"
				stroke="#C8C4BA" strokeWidth="0.6" strokeLinecap="round"
				strokeLinejoin="round" fill="none" opacity="0.5" />
			<circle cx="8" cy="10.5" r="0.5" fill="#C8C4BA" opacity="0.5" />

			{/* ── Circuit trace — right cheek ────────────────────────────────── */}
			<path d="M26.5 12 H24 V10.5"
				stroke="#C8C4BA" strokeWidth="0.6" strokeLinecap="round"
				strokeLinejoin="round" fill="none" opacity="0.5" />
			<circle cx="24" cy="10.5" r="0.5" fill="#C8C4BA" opacity="0.5" />

			{/* ── Muzzle patch (square, slightly raised) ────────────────────── */}
			<rect x="11.5" y="22" width="9" height="5.5" rx="1.5" fill="#E5E2D8" />

			{/* Nose — small square dot */}
			<rect x="14.5" y="23.2" width="3" height="2" rx="0.8" fill="#2A2A2A" />

			{/* Mouth — flat line smile */}
			<path d="M13.5 26 Q16 27.5 18.5 26"
				stroke="#2A2A2A" strokeWidth="0.8" strokeLinecap="round" fill="none" />
		</svg>
	);
}
