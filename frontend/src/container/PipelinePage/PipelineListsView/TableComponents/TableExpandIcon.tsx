import React from 'react';
import { ChevronDown, ChevronRight } from '@signozhq/icons';
import { PipelineData } from 'types/api/pipeline/def';
import { Flex } from 'antd';

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
		return (
			<Flex align="center" justify="center">
				<ChevronDown size="2xl" onClick={handleOnExpand} />
			</Flex>
		);
	}
	return (
		<Flex align="center" justify="center">
			<ChevronRight size="2xl" onClick={handleOnExpand} />
		</Flex>
	);
}

interface TableExpandIconProps {
	expanded: boolean;
	onExpand: (record: PipelineData, e: React.MouseEvent<HTMLElement>) => void;
	record: PipelineData;
}

export default TableExpandIcon;
