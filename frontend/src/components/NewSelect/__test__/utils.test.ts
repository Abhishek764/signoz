import { filterOptionsBySearch } from '../utils';

describe('filterOptionsBySearch', () => {
	it('returns all options when searchText is empty', () => {
		const options = [
			{ label: 'Option 1', value: 'option1' },
			{ label: 'Option 2', value: 'option2' },
		];
		expect(filterOptionsBySearch(options, '')).toEqual(options);
		expect(filterOptionsBySearch(options, '   ')).toEqual(options);
	});

	it('filters top-level options by string label', () => {
		const options = [
			{ label: 'Apple', value: 'apple' },
			{ label: 'Banana', value: 'banana' },
			{ label: 'Apricot', value: 'apricot' },
		];
		const result = filterOptionsBySearch(options, 'ap');
		expect(result).toEqual([
			{ label: 'Apple', value: 'apple' },
			{ label: 'Apricot', value: 'apricot' },
		]);
	});

	it('does not crash when top-level label is a number', () => {
		const options = [
			{ label: (42 as unknown) as string, value: 'forty-two' },
			{ label: 'hello', value: 'hello' },
		];
		expect(() => filterOptionsBySearch(options, '42')).not.toThrow();
		const result = filterOptionsBySearch(options, '42');
		expect(result).toEqual([{ label: 42, value: 'forty-two' }]);
	});

	it('does not crash when top-level label is undefined', () => {
		const options = [
			{ label: (undefined as unknown) as string, value: 'no-label' },
			{ label: 'valid', value: 'valid' },
		];
		expect(() => filterOptionsBySearch(options, 'und')).not.toThrow();
	});

	it('filters grouped options by string sub-label', () => {
		const options = [
			{
				label: 'Group 1',
				options: [
					{ label: 'Alpha', value: 'alpha' },
					{ label: 'Beta', value: 'beta' },
				],
			},
		];
		const result = filterOptionsBySearch(options, 'alp');
		expect(result).toHaveLength(1);
		expect((result[0] as any).options).toEqual([
			{ label: 'Alpha', value: 'alpha' },
		]);
	});

	it('does not crash when a grouped sub-option label is a number', () => {
		const options = [
			{
				label: 'Group 1',
				options: [
					{ label: (99 as unknown) as string, value: 'ninety-nine' },
					{ label: 'text', value: 'text' },
				],
			},
		];
		expect(() => filterOptionsBySearch(options, '99')).not.toThrow();
		const result = filterOptionsBySearch(options, '99');
		expect((result[0] as any).options).toEqual([
			{ label: 99, value: 'ninety-nine' },
		]);
	});

	it('excludes groups where no sub-options match', () => {
		const options = [
			{
				label: 'Group 1',
				options: [{ label: 'Alpha', value: 'alpha' }],
			},
			{
				label: 'Group 2',
				options: [{ label: 'Beta', value: 'beta' }],
			},
		];
		const result = filterOptionsBySearch(options, 'alp');
		expect(result).toHaveLength(1);
		expect((result[0] as any).options[0].label).toBe('Alpha');
	});

	it('is case-insensitive', () => {
		const options = [{ label: 'UPPERCASE', value: 'upper' }];
		expect(filterOptionsBySearch(options, 'uppercase')).toHaveLength(1);
		expect(filterOptionsBySearch(options, 'UPPERCASE')).toHaveLength(1);
		expect(filterOptionsBySearch(options, 'UpPeR')).toHaveLength(1);
	});
});
