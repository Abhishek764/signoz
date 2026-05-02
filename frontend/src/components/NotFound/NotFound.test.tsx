import { describe, expect, it } from 'vitest';
import { render } from 'tests/test-utils';

import NotFound from './index';

describe('Not Found page test', () => {
	it('should render Not Found page without errors', () => {
		const { asFragment } = render(<NotFound />);
		expect(asFragment()).toMatchSnapshot();
	});
});
