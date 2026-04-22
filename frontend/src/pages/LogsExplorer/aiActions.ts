/**
 * AI Assistant page-action factories for the Logs Explorer.
 *
 * Each factory closes over live page state/callbacks so that `execute()`
 * always operates on the current query. The page component instantiates these
 * with `useMemo` and passes them to `usePageActions`.
 *
 * IMPORTANT: filters are driven by the URL param `compositeQuery`, not by
 * React state alone. To make filter changes visible in the WHERE clause UI,
 * we must call `redirectWithQueryBuilderData(updatedQuery)` which syncs the
 * URL and triggers the component to re-read and display the new filters.
 * Calling only `handleSetQueryData` updates React state but not the URL,
 * so the query builder UI never reflects the change.
 */

import {
	ActionResult,
	PageAction,
} from 'container/AIAssistant/pageActions/types';
import { BaseAutocompleteData } from 'types/api/queryBuilder/queryAutocompleteResponse';
import {
	IBuilderQuery,
	Query,
	TagFilterItem,
} from 'types/api/queryBuilder/queryBuilderData';
import { v4 as uuidv4 } from 'uuid';

// ─── Shared param shape emitted by the AI ─────────────────────────────────────

interface AIFilter {
	key: string;
	op: string;
	value: string;
}

interface RunQueryParams {
	filters: AIFilter[];
}

interface AddFilterParams {
	key: string;
	op: string;
	value: string;
}

interface ChangeViewParams {
	view: 'list' | 'timeseries' | 'table';
}

interface SaveViewParams {
	name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function aiFilterToTagFilterItem(f: AIFilter): TagFilterItem {
	const key: BaseAutocompleteData = {
		key: f.key,
		type: null,
		dataType: undefined,
	};
	return { id: uuidv4(), key, op: f.op, value: f.value };
}

/** Return a new Query with the first builder queryData entry replaced. */
function replaceFirstQueryData(query: Query, updated: IBuilderQuery): Query {
	const queryData = [...query.builder.queryData];
	queryData[0] = updated;
	return {
		...query,
		builder: { ...query.builder, queryData },
	};
}

// ─── Deps types ───────────────────────────────────────────────────────────────

interface FilterDeps {
	currentQuery: Query;
	redirectWithQueryBuilderData: (query: Query) => void;
}

// ─── Action factories ─────────────────────────────────────────────────────────

/**
 * Replace all active filters and navigate to the updated query URL
 * (which makes the WHERE clause reflect the new filters and triggers a re-run).
 */
export function logsRunQueryAction(
	deps: FilterDeps,
): PageAction<RunQueryParams> {
	return {
		id: 'logs.runQuery',
		description: 'Replace the active log filters and re-run the query',
		parameters: {
			type: 'object',
			properties: {
				filters: {
					type: 'array',
					description: 'Replacement filter list',
					items: {
						type: 'object',
						properties: {
							key: {
								type: 'string',
								description: 'Attribute key, e.g. severity_text',
							},
							op: {
								type: 'string',
								enum: ['=', '!=', 'IN', 'NOT_IN', 'CONTAINS', 'NOT_CONTAINS'],
							},
							value: { type: 'string' },
						},
						required: ['key', 'op', 'value'],
					},
				},
			},
			required: ['filters'],
		},
		autoApply: true,
		execute: async ({ filters }): Promise<ActionResult> => {
			const baseQuery = deps.currentQuery.builder.queryData[0];
			if (!baseQuery) {
				throw new Error('No active query found in Logs Explorer.');
			}

			const tagItems = filters.map(aiFilterToTagFilterItem);
			const updatedBuilderQuery: IBuilderQuery = {
				...baseQuery,
				filters: { items: tagItems, op: 'AND' },
			};

			deps.redirectWithQueryBuilderData(
				replaceFirstQueryData(deps.currentQuery, updatedBuilderQuery),
			);

			return {
				summary: `Query updated with ${filters.length} filter(s) and re-run.`,
			};
		},
		getContext: (): Record<string, unknown> => ({
			filters:
				deps.currentQuery.builder.queryData[0]?.filters?.items?.map(
					(f: TagFilterItem) => ({
						key: f.key?.key,
						op: f.op,
						value: f.value,
					}),
				) ?? [],
		}),
	};
}

/**
 * Append a single filter to the existing query and navigate to the updated URL.
 */
export function logsAddFilterAction(
	deps: FilterDeps,
): PageAction<AddFilterParams> {
	return {
		id: 'logs.addFilter',
		description: 'Add a single filter to the current log query and re-run',
		parameters: {
			type: 'object',
			properties: {
				key: {
					type: 'string',
					description: 'Attribute key, e.g. severity_text',
				},
				op: {
					type: 'string',
					enum: ['=', '!=', 'IN', 'NOT_IN', 'CONTAINS', 'NOT_CONTAINS'],
				},
				value: { type: 'string' },
			},
			required: ['key', 'op', 'value'],
		},
		autoApply: true,
		execute: async ({ key, op, value }): Promise<ActionResult> => {
			const baseQuery = deps.currentQuery.builder.queryData[0];
			if (!baseQuery) {
				throw new Error('No active query found in Logs Explorer.');
			}

			const existing = baseQuery.filters?.items ?? [];
			const newItem = aiFilterToTagFilterItem({ key, op, value });
			const updatedBuilderQuery: IBuilderQuery = {
				...baseQuery,
				filters: { items: [...existing, newItem], op: 'AND' },
			};

			deps.redirectWithQueryBuilderData(
				replaceFirstQueryData(deps.currentQuery, updatedBuilderQuery),
			);

			return { summary: `Filter added: ${key} ${op} "${value}". Query re-run.` };
		},
	};
}

/**
 * Switch the explorer between list / timeseries / table views.
 */
export function logsChangeViewAction(deps: {
	onChangeView: (view: 'list' | 'timeseries' | 'table') => void;
}): PageAction<ChangeViewParams> {
	return {
		id: 'logs.changeView',
		description:
			'Switch the Logs Explorer between list, timeseries, and table views',
		parameters: {
			type: 'object',
			properties: {
				view: {
					type: 'string',
					enum: ['list', 'timeseries', 'table'],
					description: 'The panel view to switch to',
				},
			},
			required: ['view'],
		},
		execute: async ({ view }): Promise<ActionResult> => {
			deps.onChangeView(view);
			return { summary: `Switched to the "${view}" view.` };
		},
	};
}

/**
 * Save the current query as a named view (stub — wires to real API when available).
 */
export function logsSaveViewAction(deps: {
	onSaveView: (name: string) => Promise<void>;
}): PageAction<SaveViewParams> {
	return {
		id: 'logs.saveView',
		description: 'Save the current log query as a named view',
		parameters: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'Name for the saved view' },
			},
			required: ['name'],
		},
		execute: async ({ name }): Promise<ActionResult> => {
			await deps.onSaveView(name);
			return { summary: `View "${name}" saved.` };
		},
	};
}
