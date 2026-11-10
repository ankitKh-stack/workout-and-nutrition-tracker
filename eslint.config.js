// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // React Compiler rules: the compiler is not turned on in this app, so code that reads
    // refs during render is fine today. Turn these back on before enabling the compiler.
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/use-memo': 'off',
      // False alarm: AndroidImportance is exported by expo-notifications (the typecheck agrees).
      'import/namespace': 'off',
    },
  },
]);
