import reactConfig from '@teakflow/eslint-config/react';

export default [
  {
    ignores: ['dev-dist/**', 'dist/**', 'node_modules/**'],
  },
  ...reactConfig,
];
