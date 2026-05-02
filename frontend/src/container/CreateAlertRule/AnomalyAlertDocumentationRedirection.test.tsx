import ROUTES from 'constants/routes';
import * as usePrefillAlertConditions from 'container/FormAlertRules/usePrefillAlertConditions';
import CreateAlertPage from 'pages/CreateAlert';
import { act, fireEvent, render } from 'tests/test-utils';
import { AlertTypes } from 'types/api/alerts/alertTypes';
import type { Mock } from 'vitest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

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

let mockWindowOpen: Mock;

describe('Anomaly Alert Documentation Redirection', () => {
	beforeAll(() => {
		mockWindowOpen = vi.fn();
		window.open = mockWindowOpen;
	});

	it('should handle anomaly alert documentation redirection correctly', () => {
		const { getByRole } = render(
			<CreateAlertPage />,
			{},
			{
				initialRoute: `${ROUTES.ALERTS_NEW}?ruleType=anomaly_rule`,
			},
		);

		const alertType = AlertTypes.ANOMALY_BASED_ALERT;

		act(() => {
			fireEvent.click(
				getByRole('button', {
					name: /alert setup guide/i,
				}),
			);
		});

		expect(mockWindowOpen).toHaveBeenCalledWith(
			ALERT_TYPE_URL_MAP[alertType].creation,
			'_blank',
		);
	}, 15_000);
});
