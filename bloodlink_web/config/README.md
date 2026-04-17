# Web Config Directory

Centralized configuration files for `bloodlink_web`.

## Folders

- `vite/` - Vite config source.
- `eslint/` - ESLint config source.
- `typescript/` - TypeScript project configs.

## Root Entry Files

These root files delegate to this folder:

- `vite.config.ts` -> `config/vite/vite.config.ts`
- `eslint.config.js` -> `config/eslint/eslint.config.js`
- `tsconfig.json` -> references configs under `config/typescript/`
