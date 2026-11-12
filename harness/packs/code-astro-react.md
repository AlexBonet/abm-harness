# Pack: code-astro-react

> **Summary:** how the code checks read Astro and React projects. Installed when `astro.config.*` or `astro`/`react` in `package.json` is detected, or with `--packs code-astro-react`.

## What the checks use

- Sources: `ts`, `tsx`, `js`, `jsx`, `mjs`, `astro` outside `node_modules/`, `dist/`, `build/`; tests: `*.test.*`, `*.spec.*`, `test/`, `tests/`, `__tests__/`.
- Domain folder: any folder named `domain`; forbidden imports: `react`, `react-dom`, `astro`, `@astrojs/*`, `next`, `@supabase/*`, `firebase*`.
- Comments: `//`, `/* */`, `<!-- -->`, `{/* */}`; allowed: `@ts-`, `eslint-`, `prettier-ignore`, `biome-ignore`.
- `any`: `: any`, `as any`, `<any>`, `any[]`.
- UI text: JSX text between tags and `alt`, `title`, `placeholder`, `aria-label` literals.
- Signatures: top-level `function name(params)`, exported or not.

## Verify command

- `pnpm test` plus `pnpm build` and the project's linter.
