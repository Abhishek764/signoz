import { useCallback, useMemo } from 'react';
import { JSONTree, KeyPath } from 'react-json-tree';
import { Copy, Ellipsis } from '@signozhq/icons';
import { Input } from '@signozhq/input';
import type { MenuProps } from 'antd';
// TODO: Replace antd Dropdown with @signozhq/ui DropdownMenu when moving to design library
import { Dropdown } from 'antd';
import { useIsDarkMode } from 'hooks/useDarkMode';

import { darkTheme, lightTheme, themeExtension } from './constants';
import useSearchFilter from './hooks/useSearchFilter';
import { copyToClipboard } from './utils';

import './PrettyView.styles.scss';

export interface FieldContext {
	fieldKey: string;
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
}

function PrettyView({
	data,
	actions,
	searchable = true,
}: PrettyViewProps): JSX.Element {
	const isDarkMode = useIsDarkMode();
	const { searchQuery, setSearchQuery, filteredData } = useSearchFilter(data);

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
			const copyItem = {
				key: 'copy',
				label: 'Copy',
				icon: <Copy size={12} />,
				onClick: (): void => {
					copyToClipboard(context.fieldValue);
				},
			};

			if (!actions || actions.length === 0) {
				return [copyItem];
			}

			const consumerItems = actions.map((action) => ({
				key: action.key,
				label: action.label,
				icon: action.icon,
				onClick: (): void => {
					action.onClick(context);
				},
			}));

			return [
				copyItem,
				{ type: 'divider' as const, key: 'divider' },
				...consumerItems,
			];
		},
		[actions],
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
			const context: FieldContext = { fieldKey, fieldValue: value, isNested };
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
		): React.ReactNode =>
			renderWithActions({
				content: (
					<>
						{itemType} {itemString}
					</>
				),
				fieldKey: String(keyPath[0]),
				value: nodeData,
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
			{searchable && (
				<Input
					className="pretty-view__search-input"
					type="text"
					placeholder="Search for a field..."
					value={searchQuery}
					onChange={(e): void => setSearchQuery(e.target.value)}
				/>
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

//  Remaining for PrettyView:
//   1. Pinned items — localStorage persistence, pin/unpin action in dropdown, "PINNED ITEMS" section at top
//   2. JSON view — Monaco Editor mode (separate component but related)
//   3. View mode switcher — Pretty/JSON toggle toolbar above the content
