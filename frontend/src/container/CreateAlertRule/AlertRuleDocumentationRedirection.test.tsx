import ROUTES from 'constants/routes';
import * as usePrefillAlertConditions from 'container/FormAlertRules/usePrefillAlertConditions';
import AlertTypeSelectionPage from 'pages/AlertTypeSelection';
import CreateAlertPage from 'pages/CreateAlert';
import { act, fireEvent, render, screen } from 'tests/test-utils';
import { AlertTypes } from 'types/api/alerts/alertTypes';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ALERT_TYPE_TO_TITLE, ALERT_TYPE_URL_MAP } from './constants';

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

vi.mock('hooks/queryBuilder/useShareBuilderUrl', () => ({
	useShareBuilderUrl: (): void => {},
}));

vi.mock('api/common/logEvent', () => ({
	default: vi.fn().mockResolvedValue({ statusCode: 200 }),
}));

vi
	.spyOn(usePrefillAlertConditions, 'usePrefillAlertConditions')
	.mockReturnValue({
		matchType: '3',
		op: '1',
		target: 100,
		targetUnit: 'rpm',
	});

const mockWindowOpen = vi.fn();

beforeAll(() => {
	window.open = mockWindowOpen;
});

window.ResizeObserver =
	window.ResizeObserver ||
	vi.fn().mockImplementation(() => ({
		disconnect: vi.fn(),
		observe: vi.fn(),
		unobserve: vi.fn(),
	}));

function findLinkForAlertType(
	links: HTMLElement[],
	alertType: AlertTypes,
): HTMLElement {
	const link = links.find(
		(el) =>
			el.closest('[data-testid]')?.getAttribute('data-testid') ===
			`alert-type-card-${alertType}`,
	);
	expect(link).toBeTruthy();
	return link as HTMLElement;
}

function clickLinkAndVerifyRedirect(
	link: HTMLElement,
	expectedUrl: string,
): void {
	fireEvent.click(link);
	expect(mockWindowOpen).toHaveBeenCalledWith(expectedUrl, '_blank');
}
describe('Alert rule documentation redirection', () => {
	let renderResult: ReturnType<typeof render>;

	beforeEach(() => {
		act(() => {
			renderResult = render(
				<AlertTypeSelectionPage />,
				{},
				{
					initialRoute: ROUTES.ALERT_TYPE_SELECTION,
				},
			);
		});
	});

	it('should render alert type cards', () => {
		const { getByText, getAllByText } = renderResult;

		// Check for the heading
		expect(getByText('choose_alert_type')).toBeInTheDocument();

		// Check for alert type titles and descriptions
		Object.values(AlertTypes).forEach((alertType) => {
			const title = ALERT_TYPE_TO_TITLE[alertType];
			expect(getByText(title)).toBeInTheDocument();
			expect(getByText(`${title}_desc`)).toBeInTheDocument();
		});

		const clickHereLinks = getAllByText(
			'Click here to see how to create a sample alert.',
		);

		expect(clickHereLinks).toHaveLength(5);
	});

	it('should redirect to correct documentation for each alert type', () => {
		const { getAllByText } = renderResult;

		const clickHereLinks = getAllByText(
			'Click here to see how to create a sample alert.',
		);
		const alertTypeCount = Object.keys(AlertTypes).length;

		expect(clickHereLinks).toHaveLength(alertTypeCount);

		Object.values(AlertTypes).forEach((alertType) => {
			const linkForAlertType = findLinkForAlertType(clickHereLinks, alertType);
			const expectedUrl = ALERT_TYPE_URL_MAP[alertType];

			clickLinkAndVerifyRedirect(linkForAlertType, expectedUrl.selection);
		});

		expect(mockWindowOpen).toHaveBeenCalledTimes(alertTypeCount);
	});
});

describe('Create alert page redirection', () => {
	beforeEach(() => {
		mockWindowOpen.mockClear();
	});

	Object.values(AlertTypes)
		.filter((type) => type !== AlertTypes.ANOMALY_BASED_ALERT)
		.forEach((alertType) => {
			it(`should redirect to create alert page for ${alertType} and "Check an example alert" should redirect to the correct documentation`, async () => {
				render(
					<CreateAlertPage />,
					{},
					{
						initialRoute: `${ROUTES.ALERTS_NEW}?alertType=${alertType}&showClassicCreateAlertsPage=true`,
					},
				);

				const guideButton = await screen.findByRole('button', {
					name: /alert setup guide/i,
				});

				act(() => {
					fireEvent.click(guideButton);
				});

				expect(mockWindowOpen).toHaveBeenCalledWith(
					ALERT_TYPE_URL_MAP[alertType].creation,
					'_blank',
				);
			}, 30_000);
		});
});
