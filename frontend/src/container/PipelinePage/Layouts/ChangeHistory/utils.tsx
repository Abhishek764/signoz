import { Spin } from 'antd';
import { CircleAlert, CircleCheck, CircleMinus, CircleX, Loader } from '@signozhq/icons';

export function getDeploymentStage(value: string): string {
	switch (value) {
		case 'in_progress':
			return 'In Progress';
		case 'deployed':
			return 'Deployed';
		case 'dirty':
			return 'Dirty';
		case 'failed':
			return 'Failed';
		case 'unknown':
			return 'Unknown';
		default:
			return '';
	}
}

export function getDeploymentStageIcon(value: string): JSX.Element {
	switch (value) {
		case 'in_progress':
			return (
				<Spin indicator={<Loader style={{ fontSize: 15 }} className="animate-spin" />} />
			);
		case 'deployed':
			return <CircleCheck />;
		case 'dirty':
			return <CircleAlert />;
		case 'failed':
			return <CircleX />;
		case 'unknown':
			return <CircleMinus />;
		default:
			return <span />;
	}
}
