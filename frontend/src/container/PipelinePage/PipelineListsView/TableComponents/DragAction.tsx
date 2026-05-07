import { HolderOutlined } from '@ant-design/icons';
import { Switch } from '@signozhq/ui';

import { holdIconStyle } from '../config';
import { LastActionColumn } from '../styles';

function DragAction({ isEnabled, onChange }: DragActionProps): JSX.Element {
	return (
		<LastActionColumn>
			<Switch defaultValue={isEnabled} onChange={onChange} />
			<HolderOutlined style={holdIconStyle} />
		</LastActionColumn>
	);
}

interface DragActionProps {
	isEnabled: boolean;
	onChange: (checked: boolean) => void;
}

export default DragAction;
