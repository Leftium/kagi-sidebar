# Kagi Sidebar

Kagi Sidebar is an unofficial CSS-only customization for Kagi Custom CSS. It
moves the standard web search filters into a compact left sidebar on desktop for
both JS-enhanced and basic/no-JS web search, while preserving Kagi's native
search behavior, links, forms, dropdowns, and result rendering.

<img width="1103" height="748" alt="image" src="https://github.com/user-attachments/assets/3f9fa60f-6269-4cdb-af89-da00b632cc1b" />

## Install

Install instructions and the pasteable CSS live in `src/`:

https://github.com/Leftium/kagi-sidebar/tree/main/src

## Custom CSS Previewer

This repo includes a local previewer for testing Kagi Custom CSS against
captured Kagi search pages. It is useful when you want to iterate locally
instead of repeatedly saving changes in Kagi settings.

To preview your own Custom CSS:

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Add a CSS file directly under `previewer/custom-css/`, for example:

   ```text
   previewer/custom-css/my-kagi-css.css
   ```

3. Generate the local preview pages:

   ```sh
   pnpm generate
   ```

4. Open the previewer:

   ```sh
   pnpm dev
   ```

The picker opens at `http://127.0.0.1:5173/previewer/site/`. `src/kagi-sidebar.css`
is always included, and each file in `previewer/custom-css/` appears as another
CSS option.

Relevant files:

```text
src/                         distributable Kagi Sidebar CSS
previewer/captures/original/ redacted Kagi search captures
previewer/custom-css/        optional Custom CSS files to preview
previewer/site/              Vite picker for generated pages
previewer/tools/             capture and generation scripts
generated/                   reproducible preview output, ignored by git
```

Other useful commands:

```sh
pnpm check   # run cheap JavaScript syntax checks
pnpm format  # format tracked source files
```

## Kagi Semantic Hooks Proposal

While building the sidebar, I documented a maintainer-facing proposal for making
Kagi Custom CSS easier to write and maintain with semantic hooks and clearer
component anatomy.

Read the proposal:
[kagi-semantic-hooks-and-components.md](https://github.com/Leftium/kagi-sidebar/blob/main/proposal/kagi-semantic-hooks-and-components.md)

## License

MIT. See `LICENSE`.

## Historical Note

The older Kagi CSS/HTML optimization experiment moved to its own branch:
https://github.com/Leftium/kagi-sidebar/tree/kagi-css-html-optimization-experiment
