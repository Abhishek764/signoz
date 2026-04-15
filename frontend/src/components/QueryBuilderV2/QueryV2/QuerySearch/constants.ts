// Field-context prefixes recognized by the backend filter parser.
// Typing one of these followed by `.` (e.g. `attribute.`) scopes
// suggestions to keys defined in that context.
export const CONTEXT_PREFIXES = [
	'resource',
	'attribute',
	'scope',
	'span',
	'log',
	'body',
] as const;

export type ContextPrefix = typeof CONTEXT_PREFIXES[number];

export interface ParsedKeyInput {
	context: ContextPrefix | null;
	name: string;
	isContextScoped: boolean;
}

// Parse user input from the filter-expression key autocomplete into
// `{context, name, isContextScoped}`. The input is "context-scoped" when it
// has the `<known_context>.<rest>` shape — that's the user's signal that
// they want results limited to that context.
export function parseKeyInput(raw: string): ParsedKeyInput {
	const lower = (raw || '').toLowerCase();
	const dotIdx = lower.indexOf('.');
	if (dotIdx > 0) {
		const head = lower.slice(0, dotIdx) as ContextPrefix;
		if ((CONTEXT_PREFIXES as readonly string[]).includes(head)) {
			return {
				context: head,
				name: lower.slice(dotIdx + 1),
				isContextScoped: true,
			};
		}
	}
	return { context: null, name: lower, isContextScoped: false };
}

export const queryExamples = [
	{
		label: 'Basic Query',
		query: "status = 'error'",
		description: 'Find all errors',
	},
	{
		label: 'Multiple Conditions',
		query: "status = 'error' AND service = 'frontend'",
		description: 'Find errors from frontend service',
	},
	{
		label: 'IN Operator',
		query: "status IN ['error', 'warning']",
		description: 'Find items with specific statuses',
	},
	{
		label: 'Function Usage',
		query: "HAS(service, 'frontend')",
		description: 'Use HAS function',
	},
	{
		label: 'Numeric Comparison',
		query: 'duration > 1000',
		description: 'Find items with duration greater than 1000ms',
	},
	{
		label: 'Range Query',
		query: 'duration BETWEEN 100 AND 1000',
		description: 'Find items with duration between 100ms and 1000ms',
	},
	{
		label: 'Pattern Matching',
		query: "service LIKE 'front%'",
		description: 'Find services starting with "front"',
	},
	{
		label: 'Complex Conditions',
		query: "(status = 'error' OR status = 'warning') AND service = 'frontend'",
		description: 'Find errors or warnings from frontend service',
	},
	{
		label: 'Multiple Functions',
		query: "HAS(service, 'frontend') AND HAS(status, 'error')",
		description: 'Use multiple HAS functions',
	},
	{
		label: 'NOT Operator',
		query: "NOT status = 'success'",
		description: 'Find items that are not successful',
	},
	{
		label: 'Array Contains',
		query: "tags CONTAINS 'production'",
		description: 'Find items with production tag',
	},
	{
		label: 'Regex Pattern',
		query: "service REGEXP '^prod-.*'",
		description: 'Find services matching regex pattern',
	},
	{
		label: 'Null Check',
		query: 'error IS NULL',
		description: 'Find items without errors',
	},
	{
		label: 'Multiple Attributes',
		query:
			"service = 'frontend' AND environment = 'production' AND status = 'error'",
		description: 'Find production frontend errors',
	},
	{
		label: 'Nested Conditions',
		query:
			"(service = 'frontend' OR service = 'backend') AND (status = 'error' OR status = 'warning')",
		description: 'Find errors or warnings from frontend or backend',
	},
];
