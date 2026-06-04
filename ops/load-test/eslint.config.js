import base from '@graft/eslint-config';

// This is a CLI harness — console output is the whole point.
const configs = Array.isArray(base) ? base : [base];
export default [...configs, { rules: { 'no-console': 'off' } }];
