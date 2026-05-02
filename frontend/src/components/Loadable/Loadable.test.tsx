import React, { ComponentType, Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	render,
	screen,
	waitForElementToBeRemoved,
} from '@testing-library/react';

import Loadable from './index';

vi.mock('react', async (importOriginal) => {
	const actual = await importOriginal<typeof import('react')>();
	const lazy = vi.fn(actual.lazy);

	return {
		...actual,
		lazy,
	};
});

// Sample component to be loaded lazily
function SampleComponent(): JSX.Element {
	return <div>Sample Component</div>;
}

const loadSampleComponent = (): Promise<{
	default: ComponentType;
}> =>
	new Promise<{ default: ComponentType }>((resolve) => {
		setTimeout(() => {
			resolve({ default: SampleComponent });
		}, 500);
	});

describe('Loadable', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should render the lazily loaded component', async () => {
		const LoadableSampleComponent = Loadable(loadSampleComponent);

		const { container } = render(
			<Suspense fallback={<div>Loading...</div>}>
				<LoadableSampleComponent />
			</Suspense>,
		);

		expect(screen.getByText('Loading...')).toBeInTheDocument();
		await waitForElementToBeRemoved(() => screen.queryByText('Loading...'));

		expect(container.querySelector('div')).toHaveTextContent('Sample Component');
	});

	it('should call lazy with the provided import path', () => {
		const reactLazySpy = vi.mocked(React.lazy);
		Loadable(loadSampleComponent);

		expect(reactLazySpy).toHaveBeenCalledTimes(1);
		expect(reactLazySpy).toHaveBeenCalledWith(expect.any(Function));
	});
});
