import { useCallback, useMemo } from 'react';
import { JSONTree, KeyPath } from 'react-json-tree';
import { Copy, Ellipsis, Pin, PinOff } from '@signozhq/icons';
import { Input } from '@signozhq/input';
import type { MenuProps } from 'antd';
// TODO: Replace antd Dropdown with @signozhq/ui component when moving to design library
import { Dropdown } from 'antd';
import { useIsDarkMode } from 'hooks/useDarkMode';

import { darkTheme, lightTheme, themeExtension } from './constants';
import usePinnedFields from './hooks/usePinnedFields';
import useSearchFilter, { filterTree } from './hooks/useSearchFilter';
import {
	copyToClipboard,
	keyPathToDisplayString,
	keyPathToForward,
	serializeKeyPath,
} from './utils';

import './PrettyView.styles.scss';

export interface FieldContext {
	fieldKey: string;
	fieldKeyPath: (string | number)[];
	fieldValue: unknown;
	isNested: boolean;
}

export interface PrettyViewAction {
	key: string;
	label: React.ReactNode;
	icon?: React.ReactNode;
	onClick: (context: FieldContext) => void;
}

export interface PrettyViewProps {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	data: Record<string, any>;
	actions?: PrettyViewAction[];
	searchable?: boolean;
	showPinned?: boolean;
	drawerKey?: string;
}

function PrettyView({
	data,
	actions,
	searchable = true,
	showPinned = false,
	drawerKey = 'default',
}: PrettyViewProps): JSX.Element {
	const isDarkMode = useIsDarkMode();
	const { searchQuery, setSearchQuery, filteredData } = useSearchFilter(data);
	const {
		isPinned,
		togglePin,
		pinnedEntries,
		pinnedData,
		displayKeyToForwardPath,
	} = usePinnedFields(data, drawerKey);

	const filteredPinnedData = useMemo(() => {
		const trimmed = searchQuery.trim();
		if (!trimmed) {
			return pinnedData;
		}
		return filterTree(pinnedData, trimmed) || {};
	}, [pinnedData, searchQuery]);

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
		): boolean => level < 5,
		[],
	);

	const buildMenuItems = useCallback(
		(context: FieldContext): MenuProps['items'] => {
			// todo: drive dropdown through config.
			const copyItem = {
				key: 'copy',
				label: 'Copy',
				icon: <Copy size={12} />,
				onClick: (): void => {
					copyToClipboard(context.fieldValue);
				},
			};

			const items: NonNullable<MenuProps['items']> = [copyItem];

			// Pin action only for leaf nodes
			if (!context.isNested) {
				// Resolve the correct forward path — pinned tree uses display keys
				// which don't match the original serialized path
				const resolvedPath =
					displayKeyToForwardPath[context.fieldKey] || context.fieldKeyPath;
				const serialized = serializeKeyPath(resolvedPath);
				const pinned = isPinned(serialized);

				items.push({
					key: 'pin',
					label: pinned ? 'Unpin field' : 'Pin field',
					icon: pinned ? <PinOff size={12} /> : <Pin size={12} />,
					onClick: (): void => {
						togglePin(resolvedPath);
					},
				});
			}

			if (actions && actions.length > 0) {
				//todo: why this divider?
				items.push({ type: 'divider' as const, key: 'divider' });
				actions.forEach((action) => {
					items.push({
						key: action.key,
						label: action.label,
						icon: action.icon,
						onClick: (): void => {
							action.onClick(context);
						},
					});
				});
			}

			return items;
		},
		[actions, isPinned, togglePin, displayKeyToForwardPath],
	);

	const renderWithActions = useCallback(
		({
			content,
			fieldKey,
			fieldKeyPath,
			value,
			isNested,
		}: {
			content: React.ReactNode;
			fieldKey: string;
			fieldKeyPath: (string | number)[];
			value: unknown;
			isNested: boolean;
		}): React.ReactNode => {
			const context: FieldContext = {
				fieldKey,
				fieldKeyPath,
				fieldValue: value,
				isNested,
			};
			const menuItems = buildMenuItems(context);
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
			nodeData: unknown,
			itemType: React.ReactNode,
			itemString: string,
			keyPath: KeyPath,
		): React.ReactNode => {
			const forwardPath = keyPathToForward(keyPath);
			return renderWithActions({
				content: (
					<>
						{itemType} {itemString}
					</>
				),
				fieldKey: keyPathToDisplayString(keyPath),
				fieldKeyPath: forwardPath,
				value: nodeData,
				isNested: true,
			});
		},
		[renderWithActions],
	);

	const valueRenderer = useCallback(
		(
			valueAsString: unknown,
			value: unknown,
			...keyPath: KeyPath
		): React.ReactNode => {
			const forwardPath = keyPathToForward(keyPath);
			return renderWithActions({
				content: String(valueAsString),
				fieldKey: keyPathToDisplayString(keyPath),
				fieldKeyPath: forwardPath,
				value,
				isNested: typeof value === 'object' && value !== null,
			});
		},
		[renderWithActions],
	);

	const pinnedLabelRenderer = useCallback(
		(keyPath: KeyPath): React.ReactNode => {
			const displayKey = String(keyPath[0]);
			const entry = pinnedEntries.find((e) => e.displayKey === displayKey);
			return (
				<span className="pretty-view__pinned-label">
					<Pin
						size={12}
						className="pretty-view__pinned-icon"
						onClick={(): void => {
							if (entry) {
								togglePin(entry.forwardPath);
							}
						}}
					/>
					<span>{displayKey}</span>
				</span>
			);
		},
		[togglePin, pinnedEntries],
	);

	return (
		<div className="pretty-view">
			{searchable && (
				<Input
					className="pretty-view__search-input"
					type="text"
					placeholder="Search for a field..."
					value={searchQuery}
					onChange={(e): void => setSearchQuery(e.target.value)}
				/>
			)}

			{showPinned && Object.keys(filteredPinnedData).length > 0 && (
				<div className="pretty-view__pinned">
					<div className="pretty-view__pinned-header">PINNED ITEMS</div>
					<JSONTree
						key={`pinned-${searchQuery}`}
						data={filteredPinnedData}
						theme={theme}
						invertTheme={false}
						hideRoot
						shouldExpandNodeInitially={shouldExpandNodeInitially}
						valueRenderer={valueRenderer}
						getItemString={getItemString}
						labelRenderer={pinnedLabelRenderer}
					/>
				</div>
			)}

			<JSONTree
				key={searchQuery}
				data={filteredData}
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
