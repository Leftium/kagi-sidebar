# Fixture Lab

The fixture lab measures how real Kagi Custom CSS behaves across proposed Kagi
HTML variants.

```text
captures/original/      redacted source HTML captures
css-corpus/original/    Custom CSS as authored for today's Kagi DOM
css-corpus/semantic/    rewrites that target proposed semantic hooks
tools/                  generators and selector audits
site/                   Vite picker for generated pages and reports
```

Generated output is written to the repo-level `generated/` directory. Keep
captures, corpus files, and tools tracked; keep generated pages and screenshots
out of git unless a small curated table is copied into prose.

Run the picker with:

```sh
pnpm dev
```

Vite serves the repo root so generated pages and corpus CSS can be loaded by
path. The picker opens at `http://127.0.0.1:5173/`.

## Current Slice

This slice tracks the local sidebar CSS as the first corpus sample and two
redacted source captures:

- `captures/original/search.html`: settled JS-enhanced `/search` DOM.
- `captures/original/html-search.html`: basic `/html/search` DOM.

`pnpm generate` now emits original, backwards-compatible, and optimized HTML
variants plus capture-specific matrix pages. Each HTML variant also gets a
no-CSS baseline page so native Kagi rendering can be compared against Custom CSS
output. `pnpm audit-css` reports selector matches across those generated
variants. The audit also records CSS size, line count, selector count, distinct
private Kagi hooks, structural selectors, and `:has()` usage.

The sidebar corpus includes:

- `css-corpus/original/sidebar.css`: the current distributable sidebar CSS.
- `css-corpus/semantic/sidebar.css`: a semantic rewrite targeting proposed
  `data-kagi-*` filter hooks.

The optimized HTML variant currently simplifies the filter shell and Region
selector. Public CSS corpus expansion and screenshot automation are still
pending.

Generated pages rewrite Kagi root-relative stylesheet and image asset URLs to
`https://kagi.com/...` so matrix pages render under Vite. Source captures stay
redacted evidence; local-viewing rewrites happen in generated output.
