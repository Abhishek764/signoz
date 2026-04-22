import { useMemo } from 'react';
import type { MenuItem } from '@signozhq/ui';
import { Button, Dropdown } from '@signozhq/ui';
import { Ellipsis } from 'lucide-react';

interface TraceOptionsMenuProps {
	showTraceDetails: boolean;
	onToggleTraceDetails: () => void;
}

function TraceOptionsMenu({
	showTraceDetails,
	onToggleTraceDetails,
}: TraceOptionsMenuProps): JSX.Element {
	const menuItems: MenuItem[] = useMemo(
		() => [
			{
				key: 'toggle-trace-details',
				label: showTraceDetails ? 'Hide trace details' : 'Show trace details',
				onClick: onToggleTraceDetails,
			},
			{
				key: 'colour-by',
				label: 'Colour by',
				children: [
					{ key: 'colour-service', label: 'Service' },
					{ key: 'colour-host', label: 'Host' },
					{ key: 'colour-domain', label: 'Domain' },
				],
			},
		],
		[showTraceDetails, onToggleTraceDetails],
	);

	return (
		<Dropdown menu={{ items: menuItems }}>
			<Button variant="solid" color="secondary" size="sm">
				<Ellipsis size={14} />
			</Button>
		</Dropdown>
	);
}

export default TraceOptionsMenu;
