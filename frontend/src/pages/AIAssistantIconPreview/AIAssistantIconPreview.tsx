/**
 * AI Assistant Icon Sign-off Preview
 * Route: /ai-assistant-icon-preview  (dev only)
 *
 * Shows all icon variants at multiple sizes on both dark and light backgrounds
 * so the design can be reviewed and approved before shipping.
 */

import AIAssistantIconV1 from 'container/AIAssistant/components/AIAssistantIcon';
import AIAssistantIconV2 from 'container/AIAssistant/components/AIAssistantIconV2';
import AIAssistantIconV3 from 'container/AIAssistant/components/AIAssistantIconV3';
import AIAssistantIconV4 from 'container/AIAssistant/components/AIAssistantIconV4';
import AIAssistantIconV5 from 'container/AIAssistant/components/AIAssistantIconV5';
import AIAssistantIconV6 from 'container/AIAssistant/components/AIAssistantIconV6';

import './AIAssistantIconPreview.scss';

interface Variant {
	id: string;
	label: string;
	tagline: string;
	Component: React.ComponentType<{ size?: number; className?: string }>;
}

const VARIANTS: Variant[] = [
	{
		id: 'v1',
		label: 'V1 — Circuit Visor',
		tagline:
			'Bear face with filled visor + circuit-trace nodes. Current implementation.',
		Component: AIAssistantIconV1,
	},
	{
		id: 'v2',
		label: 'V2 — Minimal Line',
		tagline:
			'Single-weight stroke outline. Inherits currentColor. Most versatile for theming.',
		Component: AIAssistantIconV2,
	},
	{
		id: 'v3',
		label: 'V3 — Eye Lens',
		tagline: 'SigNoz eye motif inside bear silhouette. Strongest brand tie-in.',
		Component: AIAssistantIconV3,
	},
	{
		id: 'v4',
		label: 'V4 — Neural Spark',
		tagline: 'Bear head + 6-point neural asterisk. Most expressive / energetic.',
		Component: AIAssistantIconV4,
	},
	{
		id: 'v5',
		label: 'V5 — App Badge',
		tagline:
			'Dark-bg rounded-square badge. Best for product logo / nav-item contexts.',
		Component: AIAssistantIconV5,
	},
	{
		id: 'v6',
		label: 'V6 — Panda Bot ⭐',
		tagline:
			'Square geometric panda. Black ear patches at top corners, full-width HUD visor with red LED eyes, circuit traces, muzzle patch.',
		Component: AIAssistantIconV6,
	},
];

const SIZES = [16, 20, 24, 32, 48, 64];

export default function AIAssistantIconPreview(): JSX.Element {
	return (
		<div className="icon-preview">
			<header className="icon-preview__header">
				<h1 className="icon-preview__title">AI Assistant Icon — Sign-off Review</h1>
				<p className="icon-preview__subtitle">
					5 design directions · {SIZES.length} sizes each · dark + light backgrounds
				</p>
			</header>

			{VARIANTS.map(({ id, label, tagline, Component }) => (
				<section key={id} className="icon-preview__variant">
					<div className="icon-preview__variant-meta">
						<h2 className="icon-preview__variant-label">{label}</h2>
						<p className="icon-preview__variant-tagline">{tagline}</p>
					</div>

					<div className="icon-preview__surfaces">
						{/* ── Dark surface ── */}
						<div className="icon-preview__surface icon-preview__surface--dark">
							<span className="icon-preview__surface-label">Dark</span>
							<div className="icon-preview__size-row">
								{SIZES.map((s) => (
									<div key={s} className="icon-preview__size-cell">
										<Component size={s} />
										<span className="icon-preview__size-label">{s}</span>
									</div>
								))}
							</div>
						</div>

						{/* ── Light surface ── */}
						<div className="icon-preview__surface icon-preview__surface--light">
							<span className="icon-preview__surface-label">Light</span>
							<div className="icon-preview__size-row">
								{SIZES.map((s) => (
									<div key={s} className="icon-preview__size-cell">
										<Component size={s} />
										<span className="icon-preview__size-label">{s}</span>
									</div>
								))}
							</div>
						</div>

						{/* ── In context: header button ── */}
						<div className="icon-preview__surface icon-preview__surface--dark">
							<span className="icon-preview__surface-label">
								In context — header button
							</span>
							<div className="icon-preview__context-row">
								<button type="button" className="icon-preview__mock-btn">
									<Component size={18} />
								</button>
								<div className="icon-preview__mock-panel-title">
									<Component size={18} />
									<span>AI Assistant</span>
								</div>
							</div>
						</div>
					</div>
				</section>
			))}

			{/* ── Quick comparison strip ── */}
			<section className="icon-preview__compare">
				<h2 className="icon-preview__variant-label">Side-by-side at 32px (dark)</h2>
				<div className="icon-preview__surface icon-preview__surface--dark">
					<div className="icon-preview__compare-row">
						{VARIANTS.map(({ id, label, Component }) => (
							<div key={id} className="icon-preview__compare-cell">
								<Component size={32} />
								<span className="icon-preview__compare-badge">{id.toUpperCase()}</span>
								<span className="icon-preview__compare-name">
									{label.split('—')[1]?.trim()}
								</span>
							</div>
						))}
					</div>
				</div>
			</section>
		</div>
	);
}
