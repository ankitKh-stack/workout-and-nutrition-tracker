// Loaded before the tests (see the "test" script in package.json) so app code
// can run in plain Node: it resolves the "@/" path alias to src/ and swaps
// expo-crypto, a native module, for Node's own crypto.
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';

const src = new URL('../src/', import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'expo-crypto') return { url: 'node:crypto', shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src);
      for (const ext of ['.ts', '.tsx']) {
        const file = new URL(base.href + ext);
        if (existsSync(file)) return { url: file.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
