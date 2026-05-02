import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from 'tests/test-utils';

import { pipelineMockData } from '../mocks/pipeline';
import PipelineExpandView from '../PipelineListsView/PipelineExpandView';

beforeAll(() => {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: vi.fn().mockImplementation((query) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
});

describe('PipelinePage', () => {
	it('should render PipelineExpandView section', () => {
		const { asFragment } = render(
			<PipelineExpandView
				handleAlert={vi.fn()}
				setActionType={vi.fn()}
				processorEditAction={vi.fn()}
				isActionMode="viewing-mode"
				setShowSaveButton={vi.fn()}
				expandedPipelineData={pipelineMockData[0]}
				setExpandedPipelineData={vi.fn()}
				prevPipelineData={pipelineMockData}
			/>,
		);
		expect(asFragment()).toMatchSnapshot();
	});
});
