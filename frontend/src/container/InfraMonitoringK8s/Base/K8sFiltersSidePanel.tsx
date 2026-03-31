import { useEffect, useRef, useState } from 'react';
import { Button, Input } from 'antd';
import { GripVertical, TableColumnsSplit, X } from 'lucide-react';

import { K8sCategory } from '../constants';
import {
	useInfraMonitoringTableColumnsForPage,
	useInfraMonitoringTableColumnsStore,
} from './useInfraMonitoringTableColumnsStore';

import './K8sFiltersSidePanel.styles.scss';

function K8sFiltersSidePanel({
	onClose,
	entity,
}: {
	onClose: () => void;
	entity: K8sCategory;
}): JSX.Element {
	const addColumn = useInfraMonitoringTableColumnsStore(
		(state) => state.addColumn,
	);
	const removeColumn = useInfraMonitoringTableColumnsStore(
		(state) => state.removeColumn,
	);

	const [columns, columnsHidden] = useInfraMonitoringTableColumnsForPage(entity);

	const [searchValue, setSearchValue] = useState('');
	const sidePanelRef = useRef<HTMLDivElement>(null);

	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
		setSearchValue(e.target.value);
	};

	useEffect(() => {
		if (sidePanelRef.current) {
			sidePanelRef.current.focus();
		}
	}, [searchValue]);

	// Close side panel when clicking outside of it
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent): void => {
			if (
				sidePanelRef.current &&
				!sidePanelRef.current.contains(event.target as Node)
			) {
				onClose();
			}
		};

		document.addEventListener('mousedown', handleClickOutside);

		return (): void => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [onClose]);

	return (
		<div className="k8s-filters-side-panel-container">
			<div className="k8s-filters-side-panel" ref={sidePanelRef}>
				<div className="k8s-filters-side-panel-header">
					<span className="k8s-filters-side-panel-header-title">
						<TableColumnsSplit size={16} /> Columns
					</span>

					<Button
						className="periscope-btn ghost"
						icon={<X size={14} strokeWidth={1.5} onClick={onClose} />}
					/>
				</div>

				<div className="k8s-filters-side-panel-body">
					<div className="k8s-filters-side-panel-body-header">
						<Input
							autoFocus
							className="periscope-input borderless"
							placeholder="Search for a column ..."
							value={searchValue}
							onChange={handleSearchChange}
						/>
					</div>

					<div className="k8s-filters-side-panel-body-content">
						<div className="added-columns">
							<div className="filter-columns-title">Added Columns</div>

							<div className="added-columns-list">
								{columns
									.filter((column) => !columnsHidden.includes(column.id))
									.filter((column) =>
										column.label.toLowerCase().includes(searchValue.toLowerCase()),
									)
									.map((column) => (
										<div className="added-column-item" key={column.value}>
											<div className="added-column-item-content">
												<GripVertical size={16} /> {column.label}
											</div>

											{column.canBeHidden && (
												<X
													size={14}
													strokeWidth={1.5}
													onClick={(): void => removeColumn(entity, column.id)}
												/>
											)}
										</div>
									))}
							</div>
						</div>

						<div className="horizontal-divider" />

						<div className="available-columns">
							<div className="filter-columns-title">Other Columns</div>

							<div className="available-columns-list">
								{columns
									.filter((column) => columnsHidden.includes(column.id))
									.filter((column) =>
										column.label.toLowerCase().includes(searchValue.toLowerCase()),
									)
									.map((column) => (
										<div
											className="available-column-item"
											key={column.value}
											onClick={(): void => addColumn(entity, column.id)}
										>
											<div className="available-column-item-content">
												<GripVertical size={16} /> {column.label}
											</div>
										</div>
									))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default K8sFiltersSidePanel;
