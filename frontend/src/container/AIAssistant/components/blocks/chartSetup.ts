/**
 * Registers all Chart.js components that the AI assistant blocks need.
 * Import this module once (via blocks/index.ts) — safe to import multiple times.
 */
import {
	ArcElement,
	BarElement,
	CategoryScale,
	Chart as ChartJS,
	Filler,
	Legend,
	LinearScale,
	LineElement,
	PointElement,
	TimeScale,
	Title,
	Tooltip,
} from 'chart.js';

ChartJS.register(
	CategoryScale,
	LinearScale,
	TimeScale,
	BarElement,
	PointElement,
	LineElement,
	ArcElement,
	Filler,
	Title,
	Tooltip,
	Legend,
);

// ─── Colour palette (SigNoz brand colours as explicit hex) ───────────────────

export const CHART_PALETTE = [
	'#4E74F8', // robin   (blue primary)
	'#2DB699', // aquamarine
	'#F5A623', // amber
	'#F05944', // cherry  (red)
	'#06B6D4', // aqua    (cyan)
	'#F97316', // sienna  (orange)
	'#8B5CF6', // violet
	'#EC4899', // sakura  (pink)
];

export const CHART_PALETTE_ALPHA = CHART_PALETTE.map((c) => `${c}33`); // 20% opacity fills

// ─── Theme helpers ────────────────────────────────────────────────────────────

function isDark(): boolean {
	return document.body.classList.contains('dark');
}

export function getChartTheme(): {
	gridColor: string;
	tickColor: string;
	legendColor: string;
	tooltipBg: string;
	tooltipText: string;
} {
	const dark = isDark();
	return {
		gridColor: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
		tickColor: dark ? '#8c9bb5' : '#6b7280',
		legendColor: dark ? '#c0cbe0' : '#374151',
		tooltipBg: dark ? '#1a1f2e' : '#ffffff',
		tooltipText: dark ? '#e2e8f0' : '#111827',
	};
}
