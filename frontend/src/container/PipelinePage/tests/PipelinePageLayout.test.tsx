import { beforeAll, describe, expect, it, vi } from 'vitest';

import { render } from 'tests/test-utils';
import { Pipeline } from 'types/api/pipeline/def';
import { v4 } from 'uuid';

import PipelinePageLayout from '../Layouts/Pipeline';

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

describe('PipelinePage container test', () => {
	it('should render PipelinePageLayout section', () => {
		const pipelinedata: Pipeline = {
			active: true,
			createdBy: 'admin',
			deployResult: 'random_data',
			deployStatus: 'random_data',
			disabled: false,
			elementType: 'random_data',
			history: [],
			id: v4(),
			is_valid: true,
			lastConf: 'random_data',
			lastHash: 'random_data',
			pipelines: [],
			version: 1,
		};

		const refetchPipelineLists = vi.fn();

		const { asFragment } = render(
			<PipelinePageLayout
				pipelineData={pipelinedata}
				refetchPipelineLists={refetchPipelineLists}
			/>,
		);
		expect(asFragment()).toMatchSnapshot();
	});
});
