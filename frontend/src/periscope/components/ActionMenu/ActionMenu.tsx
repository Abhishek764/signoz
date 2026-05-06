import React from 'react';
import { Dropdown } from '@signozhq/ui';

export interface ActionMenuItem {
	key: string;
	label: React.ReactNode;
	icon?: React.ReactNode;
	disabled?: boolean;
	onClick: () => void;
}

interface ActionMenuProps {
	items: ActionMenuItem[];
	children: React.ReactNode;
}

function ActionMenu({ items, children }: ActionMenuProps): JSX.Element {
	const menuItems = items.map((item) => ({
		key: item.key,
		label: item.label,
		icon: item.icon,
		disabled: item.disabled,
		onClick: (): void => {
			item.onClick();
		},
	}));

	return (
		<Dropdown
			menu={{ items: menuItems }}
			align="start"
			style={{ zIndex: 1000 }}
			// onClick on the dropdown content is forwarded to the underlying div via ...props
			// but is not in the public type. Stop click bubbling so item clicks don't reach
			// clickable ancestors of the trigger through the React tree.
			// @ts-expect-error see comment above
			onClick={(e: React.MouseEvent): void => e.stopPropagation()}
		>
			{children}
		</Dropdown>
	);
}

export default ActionMenu;
