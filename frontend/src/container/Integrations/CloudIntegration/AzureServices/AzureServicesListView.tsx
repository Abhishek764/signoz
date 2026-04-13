import type { CloudintegrationtypesServiceMetadataDTO } from 'api/generated/services/sigNoz.schemas';
import cx from 'classnames';

interface AzureServicesListViewProps {
	selectedService: CloudintegrationtypesServiceMetadataDTO | null;
	enabledServices: CloudintegrationtypesServiceMetadataDTO[];
	notEnabledServices: CloudintegrationtypesServiceMetadataDTO[];
	onSelectService: (service: CloudintegrationtypesServiceMetadataDTO) => void;
}

export default function AzureServicesListView({
	selectedService,
	enabledServices,
	notEnabledServices,
	onSelectService,
}: AzureServicesListViewProps): JSX.Element {
	const isEnabledServicesEmpty = enabledServices.length === 0;
	const isNotEnabledServicesEmpty = notEnabledServices.length === 0;

	const renderServiceItem = (
		service: CloudintegrationtypesServiceMetadataDTO,
	): JSX.Element => {
		return (
			<div
				className={cx('azure-services-list-view-sidebar-content-item', {
					active: service.id === selectedService?.id,
				})}
				key={service.id}
				onClick={(): void => onSelectService(service)}
			>
				<img
					src={service.icon}
					alt={service.title}
					className="azure-services-list-view-sidebar-content-item-icon"
				/>
				<div className="azure-services-list-view-sidebar-content-item-title">
					{service.title}
				</div>
			</div>
		);
	};

	return (
		<div className="azure-services-list-view">
			<div className="azure-services-list-view-sidebar">
				<div className="azure-services-list-view-sidebar-content">
					<div className="azure-services-enabled">
						<div className="azure-services-list-view-sidebar-content-header">
							Enabled
						</div>
						{enabledServices.map((service) => renderServiceItem(service))}

						{isEnabledServicesEmpty && (
							<div className="azure-services-list-view-sidebar-content-item-empty-message">
								No enabled services
							</div>
						)}
					</div>

					{!isNotEnabledServicesEmpty && (
						<div className="azure-services-not-enabled">
							<div className="azure-services-list-view-sidebar-content-header">
								Not Enabled
							</div>
							{notEnabledServices.map((service) => renderServiceItem(service))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
