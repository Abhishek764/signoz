import { parseKeyInput } from '../QuerySearch/constants';

describe('parseKeyInput', () => {
	it('returns a bare name for empty input', () => {
		expect(parseKeyInput('')).toEqual({
			context: null,
			name: '',
			isContextScoped: false,
		});
	});

	it('returns a bare name when there is no dot', () => {
		expect(parseKeyInput('foo')).toEqual({
			context: null,
			name: 'foo',
			isContextScoped: false,
		});
	});

	it('treats a known context + dot as context-scoped', () => {
		expect(parseKeyInput('attribute.foo')).toEqual({
			context: 'attribute',
			name: 'foo',
			isContextScoped: true,
		});
	});

	it('treats a trailing dot after a known context as context-scoped with empty name', () => {
		expect(parseKeyInput('resource.')).toEqual({
			context: 'resource',
			name: '',
			isContextScoped: true,
		});
	});

	it('keeps multi-dot remainder intact', () => {
		expect(parseKeyInput('attribute.foo.bar')).toEqual({
			context: 'attribute',
			name: 'foo.bar',
			isContextScoped: true,
		});
	});

	it('treats an unknown head as a bare name', () => {
		expect(parseKeyInput('unknown.foo')).toEqual({
			context: null,
			name: 'unknown.foo',
			isContextScoped: false,
		});
	});

	it('normalizes input to lowercase', () => {
		expect(parseKeyInput('ATTRIBUTE.Foo')).toEqual({
			context: 'attribute',
			name: 'foo',
			isContextScoped: true,
		});
	});

	it('does not treat a leading dot as context-scoped', () => {
		expect(parseKeyInput('.foo')).toEqual({
			context: null,
			name: '.foo',
			isContextScoped: false,
		});
	});

	it.each(['resource', 'attribute', 'scope', 'span', 'log', 'body'])(
		'recognizes "%s" as a known context prefix',
		(ctx) => {
			expect(parseKeyInput(`${ctx}.x`)).toEqual({
				context: ctx,
				name: 'x',
				isContextScoped: true,
			});
		},
	);
});
