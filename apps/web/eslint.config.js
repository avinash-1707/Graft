import react from '@graft/eslint-config/react';

export default [
  { ignores: ['next-env.d.ts', '.next/**', 'next.config.ts'] },
  ...react,
];
