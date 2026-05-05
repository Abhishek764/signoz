import React from 'react';
import { ChevronDown, ChevronRight } from '@signozhq/icons';
import { PipelineData } from 'types/api/pipeline/def';

function TableExpandIcon({
	expanded,
	onExpand,
	record,
}: TableExpandIconProps): JSX.Element {
	const handleOnExpand = (
		e: React.MouseEvent<SVGSVGElement, MouseEvent>,
	): void => {
		onExpand(record, e as unknown as React.MouseEvent<HTMLElement, MouseEvent>);
	};

	if (expanded) {
		return <ChevronDown onClick={handleOnExpand} />;
	}
	return <ChevronRight onClick={handleOnExpand} />;
}

interface TableExpandIconProps {
	expanded: boolean;
	onExpand: (record: PipelineData, e: React.MouseEvent<HTMLElement>) => void;
	record: PipelineData;
}

export default TableExpandIcon;
