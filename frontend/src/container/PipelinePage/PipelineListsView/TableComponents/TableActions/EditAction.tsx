
import { Pencil } from '@signozhq/icons';
import { iconStyle, smallIconStyle } from '../../config';

function EditAction({
	isPipelineAction,
	editAction,
}: EditActionProps): JSX.Element {
	if (isPipelineAction) {
		return <Pencil style={iconStyle} onClick={editAction} />;
	}
	return (
		<span key="edit-action">
			<Pencil style={smallIconStyle} onClick={editAction} />
		</span>
	);
}

export interface EditActionProps {
	isPipelineAction: boolean;
	editAction: VoidFunction;
}
export default EditAction;
