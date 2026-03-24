import { ReactNode } from 'react';
import { Button } from '@signozhq/button';
import { X } from '@signozhq/icons';

import './DetailsHeader.styles.scss';

export interface HeaderAction {
	key: string;
	component: ReactNode; // check later if we can use direct btn itself or not.
}

export interface DetailsHeaderProps {
	title: string;
	onClose: () => void;
	actions?: HeaderAction[];
}

function DetailsHeader({
	title,
	onClose,
	actions,
}: DetailsHeaderProps): JSX.Element {
	return (
		<div className="details-header">
			<Button
				variant="ghost"
				size="icon"
				color="secondary"
				onClick={onClose}
				aria-label="Close"
				className="details-header__icon-btn"
			>
				<X size={14} />
			</Button>

			<span className="details-header__title">{title}</span>

			{actions && (
				<div className="details-header__actions">
					{actions.map((action) => (
						<div key={action.key}>{action.component}</div>
					))}
				</div>
			)}
		</div>
	);
}

export default DetailsHeader;
