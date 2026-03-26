import { useCallback, useMemo } from 'react';
import { JSONTree, KeyPath } from 'react-json-tree';
import { Copy, Ellipsis } from '@signozhq/icons';
import { toast } from '@signozhq/sonner';
import type { MenuProps } from 'antd';
// TODO: Replace antd Dropdown with @signozhq/ui DropdownMenu when moving to design library
import { Dropdown } from 'antd';
import { useIsDarkMode } from 'hooks/useDarkMode';

import './PrettyView.styles.scss';

// Dark theme — SigNoz design palette
const darkTheme = {
	scheme: 'signoz-dark',
	author: 'signoz',
	base00: 'transparent',
	base01: '#161922',
	base02: '#1d212d',
	base03: '#62687C',
	base04: '#ADB4C2',
	base05: '#ADB4C2',
	base06: '#ADB4C2',
	base07: '#ADB4C2',
	base08: '#EA6D71',
	base09: '#7CEDBD',
	base0A: '#7CEDBD',
	base0B: '#ADB4C2',
	base0C: '#23C4F8',
	base0D: '#95ACFB',
	base0E: '#95ACFB',
	base0F: '#AD7F58',
};

// Light theme
const lightTheme = {
	scheme: 'signoz-light',
	author: 'signoz',
	base00: 'transparent',
	base01: '#F9F9FB',
	base02: '#EFF0F3',
	base03: '#80828D',
	base04: '#62636C',
	base05: '#62636C',
	base06: '#62636C',
	base07: '#1E1F24',
	base08: '#E5484D',
	base09: '#168757',
	base0A: '#168757',
	base0B: '#62636C',
	base0C: '#157594',
	base0D: '#2F48A0',
	base0E: '#2F48A0',
	base0F: '#684C35',
};

const themeExtension = {
	value: ({
		style,
	}: {
		style: Record<string, unknown>;
	}): { style: Record<string, unknown>; className: string } => ({
		style: { ...style },
		className: 'pretty-view__row',
	}),
	nestedNode: ({
		style,
	}: {
		style: Record<string, unknown>;
	}): { style: Record<string, unknown>; className: string } => ({
		style: { ...style },
		className: 'pretty-view__nested-row',
	}),
};

export interface PrettyViewAction {
	key: string;
	label: React.ReactNode;
	icon?: React.ReactNode;
}

export interface PrettyViewProps {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: Record<string, any>;
	actions?: PrettyViewAction[];
	onAction?: (
		action: string,
		fieldKey: string,
		fieldValue: unknown,
		isNested: boolean,
	) => void;
}

function copyToClipboard(value: unknown): void {
	const text =
		typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
	navigator.clipboard.writeText(text);
	toast.success('Copied to clipboard', {
		richColors: true,
		position: 'top-right',
	});
}

function PrettyView({ data, actions, onAction }: PrettyViewProps): JSX.Element {
	const isDarkMode = useIsDarkMode();

	const theme = useMemo(
		() => ({
			extend: isDarkMode ? darkTheme : lightTheme,
			...themeExtension,
		}),
		[isDarkMode],
	);

	const shouldExpandNodeInitially = useCallback(
		(
			_keyPath: readonly (string | number)[],
			_data: unknown,
			level: number,
		): boolean => level < 2,
		[],
	);

	const buildMenuItems = useCallback(
		(fieldKey: string, value: unknown, isNested: boolean): MenuProps['items'] => {
			const copyItem = {
				key: 'copy',
				label: 'Copy',
				icon: <Copy size={12} />,
				onClick: (): void => {
					copyToClipboard(value);
					onAction?.('copy', fieldKey, value, isNested);
				},
			};

			if (!actions || actions.length === 0) {
				return [copyItem];
			}

			const consumerItems = actions.map((item) => ({
				key: item.key,
				label: item.label,
				icon: item.icon,
				onClick: (): void => {
					onAction?.(item.key, fieldKey, value, isNested);
				},
			}));

			return [
				copyItem,
				{ type: 'divider' as const, key: 'divider' },
				...consumerItems,
			];
		},
		[actions, onAction],
	);

	const renderWithActions = useCallback(
		({
			content,
			fieldKey,
			value,
			isNested,
		}: {
			content: React.ReactNode;
			fieldKey: string;
			value: unknown;
			isNested: boolean;
		}): React.ReactNode => {
			const menuItems = buildMenuItems(fieldKey, value, isNested);
			return (
				<span className="pretty-view__value-row">
					<span>{content}</span>
					<Dropdown
						menu={{
							items: menuItems,
							onClick: (e): void => {
								e.domEvent.stopPropagation();
							},
						}}
						trigger={['click']}
						placement="bottomLeft"
						getPopupContainer={(trigger): HTMLElement =>
							trigger.parentElement || document.body
						}
					>
						<span
							className="pretty-view__actions"
							onClick={(e): void => e.stopPropagation()}
							role="button"
							tabIndex={0}
						>
							<Ellipsis size={12} />
						</span>
					</Dropdown>
				</span>
			);
		},
		[buildMenuItems],
	);

	const getItemString = useCallback(
		(
			_nodeType: string,
			data: unknown,
			itemType: React.ReactNode,
			itemString: string,
			keyPath: KeyPath,
		): React.ReactNode =>
			renderWithActions({
				content: (
					<>
						{itemType} {itemString}
					</>
				),
				fieldKey: String(keyPath[0]),
				value: data,
				isNested: true,
			}),
		[renderWithActions],
	);

	const valueRenderer = useCallback(
		(
			valueAsString: unknown,
			value: unknown,
			...keyPath: KeyPath
		): React.ReactNode =>
			renderWithActions({
				content: String(valueAsString),
				fieldKey: String(keyPath[0]),
				value,
				isNested: typeof value === 'object' && value !== null,
			}),
		[renderWithActions],
	);

	return (
		<div className="pretty-view">
			<JSONTree
				data={data}
				theme={theme}
				invertTheme={false}
				hideRoot
				shouldExpandNodeInitially={shouldExpandNodeInitially}
				valueRenderer={valueRenderer}
				getItemString={getItemString}
			/>
		</div>
	);
}

export default PrettyView;

//  Remaining for PrettyView:
//   1. Pinned items — localStorage persistence, pin/unpin action in dropdown, "PINNED ITEMS" section at top showing pinned key:value rows
//   2. Search — input bar with match count + prev/next navigation, highlights matching keys/values in tree
//  2a. actions should have there own onCLick instead of using the generic onAction callback, to avoid confusion with pinned items and search which also have "actions"
// 2b. move to constants code that can be moved
//   3. JSON view — Monaco Editor mode (separate component but related)
//   4. View mode switcher — Pretty/JSON toggle toolbar above the content
