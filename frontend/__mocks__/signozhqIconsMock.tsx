import React from 'react';

const IconMock = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
	(props, ref) => <svg ref={ref} {...props} />,
);
IconMock.displayName = 'IconMock';

// Re-export IconMock as every possible named export via module.exports proxy
// so that any `import { SomeIcon } from '@signozhq/icons'` resolves to a valid component.
const moduleExports = new Proxy(
	{ __esModule: true, default: IconMock },
	{
		get(target, prop) {
			if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
			return IconMock;
		},
	},
);

module.exports = moduleExports;
