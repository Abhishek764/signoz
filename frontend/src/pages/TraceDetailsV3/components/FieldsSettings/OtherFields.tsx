import { useMemo } from 'react';
import { Button, Skeleton } from 'antd';
import OverlayScrollbar from 'components/OverlayScrollbar/OverlayScrollbar';
import { REACT_QUERY_KEY } from 'constants/reactQueryKeys';
import { useGetAggregateKeys } from 'hooks/queryBuilder/useGetAggregateKeys';
import { DataSource } from 'types/common/queryBuilder';

interface OtherFieldsProps {
	dataSource: DataSource;
	debouncedInputValue: string;
	addedFields: string[];
	onAdd: (key: string) => void;
	isAtLimit: boolean;
}

function OtherFields({
	dataSource,
	debouncedInputValue,
	addedFields,
	onAdd,
	isAtLimit,
}: OtherFieldsProps): JSX.Element {
	// API call to get available attribute keys
	const { data, isFetching } = useGetAggregateKeys(
		{
			searchText: debouncedInputValue,
			dataSource,
			aggregateOperator: 'noop',
			aggregateAttribute: '',
			tagType: '',
		},
		{
			queryKey: [
				REACT_QUERY_KEY.GET_OTHER_FILTERS,
				'preview-fields',
				debouncedInputValue,
			],
			enabled: true,
		},
	);

	// Filter out already-added fields, match on .key from API response objects
	const otherFields = useMemo(() => {
		const attributes = data?.payload?.attributeKeys || [];
		const addedSet = new Set(addedFields);
		return attributes.filter((attr) => !addedSet.has(attr.key));
	}, [data, addedFields]);

	if (isFetching) {
		return (
			<div className="fs-section fs-other">
				<div className="fs-section-header">OTHER FIELDS</div>
				<div className="fs-other-list">
					{Array.from({ length: 5 }).map((_, i) => (
						// eslint-disable-next-line react/no-array-index-key
						<Skeleton.Input active size="small" key={i} />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="fs-section fs-other">
			<div className="fs-section-header">OTHER FIELDS</div>
			<div className="fs-other-list">
				<OverlayScrollbar>
					<>
						{otherFields.length === 0 ? (
							<div className="fs-no-values">No values found</div>
						) : (
							otherFields.map((attr) => (
								<div key={attr.key} className="fs-field-item other-field-item">
									<span className="fs-field-key">{attr.key}</span>
									{!isAtLimit && (
										<Button
											className="add-field-btn periscope-btn"
											size="small"
											onClick={(): void => onAdd(attr.key)}
										>
											Add
										</Button>
									)}
								</div>
							))
						)}
						{isAtLimit && <div className="fs-limit-hint">Maximum 10 fields</div>}
					</>
				</OverlayScrollbar>
			</div>
		</div>
	);
}

export default OtherFields;
