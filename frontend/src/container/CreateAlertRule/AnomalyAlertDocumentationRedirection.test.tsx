import ROUTES from 'constants/routes';
import * as usePrefillAlertConditions from 'container/FormAlertRules/usePrefillAlertConditions';
import CreateAlertPage from 'pages/CreateAlert';
import { act, fireEvent, render, screen } from 'tests/test-utils';
import { AlertTypes } from 'types/api/alerts/alertTypes';
import type { MockInstance } from 'vitest';
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';

import { ALERT_TYPE_URL_MAP } from './constants';

vi.mock('uplot', () => {
	const paths = {
		spline: vi.fn(),
		bars: vi.fn(),
	};
	const UplotConstructor: any = vi.fn(() => ({
		paths,
	}));
	UplotConstructor.paths = paths;
	return { default: UplotConstructor };
});

vi.mock('container/FormAlertRules/ChartPreview', () => ({
	__esModule: true,
	default: (): null => null,
}));

vi.mock('container/MetricsExplorer/Explorer/utils', async () => {
	const actual = await vi.importActual<
		typeof import('container/MetricsExplorer/Explorer/utils')
	>('container/MetricsExplorer/Explorer/utils');
	return {
		...actual,
		useGetMetrics: (): {
			metrics: never[];
			isLoading: boolean;
			isError: boolean;
		} => ({
			metrics: [],
			isLoading: false,
			isError: false,
		}),
	};
});

vi.mock('hooks/useSafeNavigate', () => ({
	useSafeNavigate: (): any => ({
		safeNavigate: vi.fn(),
	}),
}));
vi
	.spyOn(usePrefillAlertConditions, 'usePrefillAlertConditions')
	.mockReturnValue({
		matchType: '3',
		op: '1',
		target: 100,
		targetUnit: 'rpm',
	});

let windowOpenSpy: MockInstance;

describe('Anomaly Alert Documentation Redirection', () => {
	beforeAll(() => {
		windowOpenSpy = vi
			.spyOn(window, 'open')
			.mockImplementation((): Window | null => null);
	});

	afterAll(() => {
		windowOpenSpy.mockRestore();
	});

	beforeEach(() => {
		windowOpenSpy.mockClear();
	});

	it('should handle anomaly alert documentation redirection correctly', async () => {
		render(
			<CreateAlertPage />,
			{},
			{
				initialRoute: `${ROUTES.ALERTS_NEW}?ruleType=anomaly_rule`,
			},
		);

		const button = await screen.findByRole('button', {
			name: /alert setup guide/i,
		});

		act(() => {
			fireEvent.click(button);
		});

		const alertType = AlertTypes.ANOMALY_BASED_ALERT;

		expect(windowOpenSpy).toHaveBeenCalledWith(
			ALERT_TYPE_URL_MAP[alertType].creation,
			'_blank',
		);
	}, 30_000);
});
