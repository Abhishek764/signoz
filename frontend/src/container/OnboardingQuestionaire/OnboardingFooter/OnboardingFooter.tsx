import { Dot } from 'lucide-react';

import './OnboardingFooter.styles.scss';
// hippa.svg and soc2.svg do not exist in src/assets — suppressed until assets are added
/* eslint-disable rulesdir/no-unsupported-asset-pattern */
const hippaUrl = '/logos/hippa.svg';
const soc2Url = '/logos/soc2.svg';
/* eslint-enable rulesdir/no-unsupported-asset-pattern */

export function OnboardingFooter(): JSX.Element {
	return (
		<section className="footer-main-container">
			<div className="footer-container">
				<a
					href="https://trust.signoz.io/"
					target="_blank"
					className="footer-content"
					rel="noreferrer"
				>
					<img src={hippaUrl} alt="HIPPA" className="footer-logo" />
					<span className="footer-text">HIPPA</span>
				</a>
				<Dot size={24} color="#2C3140" />
				<a
					href="https://trust.signoz.io/"
					target="_blank"
					className="footer-content"
					rel="noreferrer"
				>
					<img src={soc2Url} alt="SOC2" className="footer-logo" />
					<span className="footer-text">SOC2</span>
				</a>
			</div>
		</section>
	);
}
