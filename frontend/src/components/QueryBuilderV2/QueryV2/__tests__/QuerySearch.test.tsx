import { EditorView } from '@uiw/react-codemirror';
import * as getKeySuggestionsModule from 'api/querySuggestions/getKeySuggestions';
import * as getValueSuggestionsModule from 'api/querySuggestions/getValueSuggestion';
import { initialQueriesMap } from 'constants/queryBuilder';
import { fireEvent, render, userEvent, waitFor } from 'tests/test-utils';
import { DataTypes } from 'types/api/queryBuilder/queryAutocompleteResponse';
import { DataSource } from 'types/common/queryBuilder';
import type { MockedFunction, MockInstance } from 'vitest';
import {
	beforeAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';

import QuerySearch from '../QuerySearch/QuerySearch';

const CM_EDITOR_SELECTOR = '.cm-editor .cm-content';

// Mock DOM APIs that CodeMirror needs
beforeAll(() => {
	const mockRect: DOMRect = {
		width: 100,
		height: 20,
		top: 0,
		left: 0,
		right: 100,
		bottom: 20,
		x: 0,
		y: 0,
		toJSON: (): DOMRect => mockRect,
	} as DOMRect;

	const createMockRange = (): Range => {
		let startContainer: Node = document.createTextNode('');
		let endContainer: Node = document.createTextNode('');
		let startOffset = 0;
		let endOffset = 0;

		const mockRange = {
			getClientRects: (): DOMRectList =>
				({
					length: 1,
					item: (index: number): DOMRect | null => (index === 0 ? mockRect : null),
					0: mockRect,
					*[Symbol.iterator](): Generator<DOMRect> {
						yield mockRect;
					},
				}) as unknown as DOMRectList,
			getBoundingClientRect: (): DOMRect => mockRect,
			setStart: (node: Node, offset: number): void => {
				startContainer = node;
				startOffset = offset;
			},
			setEnd: (node: Node, offset: number): void => {
				endContainer = node;
				endOffset = offset;
			},
			get startContainer(): Node {
				return startContainer;
			},
			get endContainer(): Node {
				return endContainer;
			},
			get startOffset(): number {
				return startOffset;
			},
			get endOffset(): number {
				return endOffset;
			},
			get collapsed(): boolean {
				return startContainer === endContainer && startOffset === endOffset;
			},
			commonAncestorContainer: document.body,
		};
		return mockRange as unknown as Range;
	};

	document.createRange = (): Range => createMockRange();
	Element.prototype.getBoundingClientRect = (): DOMRect => mockRect;
});

vi.mock('hooks/useDarkMode', () => ({
	useIsDarkMode: (): boolean => false,
}));

vi.mock('hooks/useSafeNavigate', () => ({
	useSafeNavigate: (): { safeNavigate: ReturnType<typeof vi.fn> } => ({
		safeNavigate: vi.fn(),
	}),
}));

vi.mock('providers/Dashboard/store/useDashboardStore', () => ({
	useDashboardStore: (): { dashboardData: undefined } => ({
		dashboardData: undefined,
	}),
}));

vi.mock('hooks/queryBuilder/useQueryBuilder', () => {
	const handleRunQuery = vi.fn();
	return {
		__esModule: true,
		useQueryBuilder: (): { handleRunQuery: () => void } => ({ handleRunQuery }),
		handleRunQuery,
	};
});

const SAMPLE_KEY_TYPING = 'http.';
const SAMPLE_VALUE_TYPING_INCOMPLETE = "service.name = '";
const SAMPLE_STATUS_QUERY = "http.status_code = '200'";

describe('QuerySearch (Integration with Real CodeMirror)', () => {
	let getKeySuggestionsSpy: MockInstance;
	let getValueSuggestionsSpy: MockInstance;

	beforeEach(() => {
		vi.useRealTimers();
		getKeySuggestionsSpy = vi
			.spyOn(getKeySuggestionsModule, 'getKeySuggestions')
			.mockResolvedValue({
				data: {
					data: { keys: {} as Record<string, unknown[]> },
				},
			} as Awaited<ReturnType<typeof getKeySuggestionsModule.getKeySuggestions>>);
		getValueSuggestionsSpy = vi
			.spyOn(getValueSuggestionsModule, 'getValueSuggestions')
			.mockResolvedValue({
				data: {
					data: { values: { stringValues: [], numberValues: [] } },
				},
			} as unknown as Awaited<
				ReturnType<typeof getValueSuggestionsModule.getValueSuggestions>
			>);
	});

	afterEach(() => {
		getKeySuggestionsSpy.mockRestore();
		getValueSuggestionsSpy.mockRestore();
	});

	it('renders with placeholder', () => {
		render(
			<QuerySearch
				onChange={vi.fn() as MockedFunction<(v: string) => void>}
				queryData={initialQueriesMap.logs.builder.queryData[0]}
				dataSource={DataSource.LOGS}
			/>,
		);

		const editorContainer = document.querySelector('.query-where-clause-editor');
		expect(editorContainer).toBeInTheDocument();
	});

	it('fetches key suggestions when typing a key (debounced)', async () => {
		render(
			<QuerySearch
				onChange={vi.fn() as MockedFunction<(v: string) => void>}
				queryData={initialQueriesMap.logs.builder.queryData[0]}
				dataSource={DataSource.LOGS}
			/>,
		);

		await waitFor(() => {
			const editor = document.querySelector(CM_EDITOR_SELECTOR);
			expect(editor).toBeInTheDocument();
		});

		const editor = document.querySelector(CM_EDITOR_SELECTOR) as HTMLElement;

		await userEvent.click(editor);
		await userEvent.type(editor, SAMPLE_KEY_TYPING);

		await waitFor(() => expect(getKeySuggestionsSpy).toHaveBeenCalled(), {
			timeout: 2000,
		});
	});

	it('fetches value suggestions when editing value context', async () => {
		render(
			<QuerySearch
				onChange={vi.fn() as MockedFunction<(v: string) => void>}
				queryData={initialQueriesMap.logs.builder.queryData[0]}
				dataSource={DataSource.LOGS}
			/>,
		);

		await waitFor(() => {
			const editor = document.querySelector(CM_EDITOR_SELECTOR);
			expect(editor).toBeInTheDocument();
		});

		const editor = document.querySelector(CM_EDITOR_SELECTOR) as HTMLElement;
		await userEvent.click(editor);
		await userEvent.type(editor, SAMPLE_VALUE_TYPING_INCOMPLETE);

		await waitFor(() => expect(getValueSuggestionsSpy).toHaveBeenCalled(), {
			timeout: 2000,
		});
	});

	it('fetches key suggestions on mount for LOGS', async () => {
		render(
			<QuerySearch
				onChange={vi.fn() as MockedFunction<(v: string) => void>}
				queryData={initialQueriesMap.logs.builder.queryData[0]}
				dataSource={DataSource.LOGS}
			/>,
		);

		await waitFor(() => expect(getKeySuggestionsSpy).toHaveBeenCalled(), {
			timeout: 2000,
		});

		const lastArgs = getKeySuggestionsSpy.mock.calls[
			getKeySuggestionsSpy.mock.calls.length - 1
		]?.[0] as { signal: unknown; searchText: string };
		expect(lastArgs).toMatchObject({ signal: DataSource.LOGS, searchText: '' });
	});

	it('calls provided onRun on Mod-Enter', async () => {
		const onRun = vi.fn() as MockedFunction<(q: string) => void>;

		render(
			<QuerySearch
				onChange={vi.fn() as MockedFunction<(v: string) => void>}
				queryData={initialQueriesMap.logs.builder.queryData[0]}
				dataSource={DataSource.LOGS}
				onRun={onRun}
			/>,
		);

		await waitFor(() => {
			const editor = document.querySelector(CM_EDITOR_SELECTOR);
			expect(editor).toBeInTheDocument();
		});

		const editor = document.querySelector(CM_EDITOR_SELECTOR) as HTMLElement;
		await userEvent.click(editor);
		await userEvent.type(editor, SAMPLE_STATUS_QUERY);

		const modKey = navigator.platform.includes('Mac') ? 'metaKey' : 'ctrlKey';
		fireEvent.keyDown(editor, {
			key: 'Enter',
			code: 'Enter',
			[modKey]: true,
			keyCode: 13,
		});

		await waitFor(() => expect(onRun).toHaveBeenCalled(), { timeout: 2000 });
	});

	it('initializes CodeMirror with expression from queryData.filter.expression on mount', async () => {
		const testExpression =
			"http.status_code >= 500 AND service.name = 'frontend'";
		const queryDataWithExpression = {
			...initialQueriesMap.logs.builder.queryData[0],
			filter: {
				expression: testExpression,
			},
		};

		render(
			<QuerySearch
				onChange={vi.fn() as MockedFunction<(v: string) => void>}
				queryData={queryDataWithExpression}
				dataSource={DataSource.LOGS}
			/>,
		);

		await waitFor(
			() => {
				const editorContent = document.querySelector(
					CM_EDITOR_SELECTOR,
				) as HTMLElement;
				expect(editorContent).toBeInTheDocument();
				const textContent = editorContent.textContent || '';
				expect(textContent).toContain('http.status_code');
				expect(textContent).toContain('service.name');
			},
			{ timeout: 3000 },
		);
	});

	it('handles queryData.filter.expression changes without triggering onChange', async () => {
		const dispatchSpy = vi.spyOn(EditorView.prototype, 'dispatch');
		const initialExpression = "service.name = 'frontend'";
		const updatedExpression = "service.name = 'backend'";

		const onChange = vi.fn() as MockedFunction<(v: string) => void>;

		const initialQueryData = {
			...initialQueriesMap.logs.builder.queryData[0],
			filter: {
				expression: initialExpression,
			},
		};

		const { rerender } = render(
			<QuerySearch
				onChange={onChange}
				queryData={initialQueryData}
				dataSource={DataSource.LOGS}
			/>,
		);

		await waitFor(
			() => {
				const editorContent = document.querySelector(
					CM_EDITOR_SELECTOR,
				) as HTMLElement;
				expect(editorContent).toBeInTheDocument();
				const textContent = editorContent.textContent || '';
				expect(textContent).toBe(initialExpression);
			},
			{ timeout: 3000 },
		);

		const updatedQueryData = {
			...initialQueryData,
			filter: {
				expression: updatedExpression,
			},
		};

		rerender(
			<QuerySearch
				onChange={onChange}
				queryData={updatedQueryData}
				dataSource={DataSource.LOGS}
			/>,
		);

		await waitFor(() => {
			expect(dispatchSpy).toHaveBeenCalled();
			expect(onChange).not.toHaveBeenCalled();
		});

		dispatchSpy.mockRestore();
	});

	it('fetches key suggestions for metrics even without aggregateAttribute.key when showFilterSuggestionsWithoutMetric is true', async () => {
		const queryData = {
			...initialQueriesMap.metrics.builder.queryData[0],
			aggregateAttribute: {
				key: '',
				dataType: DataTypes.String,
				type: 'string',
			},
		};

		render(
			<QuerySearch
				onChange={vi.fn()}
				queryData={queryData}
				dataSource={DataSource.METRICS}
				showFilterSuggestionsWithoutMetric
			/>,
		);

		await waitFor(() => expect(getKeySuggestionsSpy).toHaveBeenCalled(), {
			timeout: 2000,
		});
	});
});
