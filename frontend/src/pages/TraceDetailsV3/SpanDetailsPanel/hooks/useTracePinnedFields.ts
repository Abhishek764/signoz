import { useCallback, useMemo } from 'react';
import { useMutation } from 'react-query';
import updateUserPreferenceAPI from 'api/v1/user/preferences/name/update';
import { USER_PREFERENCES } from 'constants/userPreferences';
import { useAppContext } from 'providers/App/App';

interface UseTracePinnedFieldsReturn {
	value: string[];
	onChange: (next: string[]) => void;
}

function tryParseJSONArray(s: string): boolean {
	try {
		return Array.isArray(JSON.parse(s));
	} catch {
		return false;
	}
}

/**
 * Reads/writes V3 trace-details pinned attributes from the user-preference
 * `span_details_pinned_attributes` (cross-device sync). Drops legacy V2-format
 * entries from the rendered set so PrettyView never tries to render an
 * un-parseable path while the migration is in flight.
 *
 * Migration of V2 → V3 format is handled separately by
 * `useMigratePinnedAttributes`.
 */
export function useTracePinnedFields(): UseTracePinnedFieldsReturn {
	const { userPreferences, updateUserPreferenceInContext } = useAppContext();
	const { mutate } = useMutation(updateUserPreferenceAPI);

	const value = useMemo<string[]>(() => {
		const pref = userPreferences?.find(
			(p) => p.name === USER_PREFERENCES.SPAN_DETAILS_PINNED_ATTRIBUTES,
		);
		const arr = (pref?.value as string[] | undefined) ?? [];
		return arr.filter(tryParseJSONArray);
	}, [userPreferences]);

	const onChange = useCallback(
		(next: string[]) => {
			const existing = userPreferences?.find(
				(p) => p.name === USER_PREFERENCES.SPAN_DETAILS_PINNED_ATTRIBUTES,
			);
			if (existing) {
				updateUserPreferenceInContext({ ...existing, value: next });
			}
			mutate({
				name: USER_PREFERENCES.SPAN_DETAILS_PINNED_ATTRIBUTES,
				value: next,
			});
		},
		[userPreferences, updateUserPreferenceInContext, mutate],
	);

	return { value, onChange };
}
