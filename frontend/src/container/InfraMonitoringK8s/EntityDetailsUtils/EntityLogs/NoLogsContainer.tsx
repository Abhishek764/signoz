import { Color } from '@signozhq/design-tokens';
import { InfraMonitoringEntity } from 'container/InfraMonitoringK8s/constants';
import { Ghost } from 'lucide-react';

import styles from './entityLogs.module.scss';

export default function NoLogsContainer({
	category,
}: {
	category: InfraMonitoringEntity;
}): React.ReactElement {
	return (
		<div className={styles.noLogsFound}>
			<p>
				<Ghost size={24} color={Color.BG_AMBER_500} />
				{`No logs found for this ${category} in the selected time range.`}
			</p>
		</div>
	);
}
