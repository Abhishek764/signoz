import { PencilLine } from '@signozhq/icons';
import { iconStyle, smallIconStyle } from '../../config';

function EditAction({
	isPipelineAction,
	editAction,
}: EditActionProps): JSX.Element {
	if (isPipelineAction) {
		return <PencilLine size="lg" style={iconStyle} onClick={editAction} />;
	}
	return (
		<span key="edit-action">
			<PencilLine size="lg" style={smallIconStyle} onClick={editAction} />
		</span>
	);
}

export interface EditActionProps {
	isPipelineAction: boolean;
	editAction: VoidFunction;
}
export default EditAction;
