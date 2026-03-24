import { ReactNode } from 'react';
import { Tooltip, Typography } from 'antd';

import './DetailField.styles.scss';

export interface DetailFieldProps {
	label: string;
	value: ReactNode;
	direction?: 'row' | 'column';
	labelCase?: 'uppercase' | 'normal';
}

function DetailField({
	label,
	value,
	direction = 'column',
	labelCase = 'uppercase',
}: DetailFieldProps): JSX.Element {
	return (
		<div className={`detail-field detail-field--${direction}`}>
			<span className={`detail-field__label detail-field__label--${labelCase}`}>
				{label}
			</span>
			<div className="detail-field__value">
				{typeof value === 'string' ? (
					<Tooltip title={value}>
						<Typography.Text className="detail-field__value-text" ellipsis>
							{value}
						</Typography.Text>
					</Tooltip>
				) : (
					value
				)}
			</div>
		</div>
	);
}

export default DetailField;
