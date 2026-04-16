import React from 'react';
import type { MenuProps } from 'antd';
import { Dropdown } from 'antd';

import './ActionMenu.styles.scss';

export interface ActionMenuItem {
	key: string;
	label: React.ReactNode;
	icon?: React.ReactNode;
	disabled?: boolean;
	onClick: () => void;
}

interface ActionMenuProps {
	items: ActionMenuItem[];
	trigger?: ('click' | 'hover' | 'contextMenu')[];
	placement?:
		| 'bottomLeft'
		| 'bottomRight'
		| 'topLeft'
		| 'topRight'
		| 'bottom'
		| 'top';
	children: React.ReactNode;
}

function ActionMenu({
	items,
	trigger = ['click'],
	placement = 'bottomLeft',
	children,
}: ActionMenuProps): JSX.Element {
	const menuItems: MenuProps['items'] = items.map((item) => ({
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
			rootClassName="action-menu"
			menu={{
				items: menuItems,
				onClick: (e): void => {
					e.domEvent.stopPropagation();
				},
			}}
			trigger={trigger}
			placement={placement}
		>
			{children}
		</Dropdown>
	);
}

export default ActionMenu;
