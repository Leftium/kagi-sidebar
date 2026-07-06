# Fixture Lab

The fixture lab measures how real Kagi Custom CSS behaves across proposed Kagi
HTML/CSS bundles.

```text
captures/original/      redacted source HTML captures
css-corpus/original/    Custom CSS as authored for today's Kagi DOM
css-corpus/semantic/    rewrites that target proposed semantic hooks
kagi-authored-css/      lab-owned CSS for proposed Kagi bundle variants
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
- `captures/original/search.domain-info.json`: domain-info metadata captured
  from Kagi's real `provider:domain_info` runtime event for the rendered search
  result domains.
- `captures/original/html-search.html`: basic `/html/search` DOM.

`pnpm generate` now emits original, backwards-compatible, and optimized bundle
HTML plus capture-specific matrix pages. A bundle owns the generated HTML
variant and the Kagi-authored CSS variant. Custom CSS remains a separate matrix
option. Script tags are preserved when a source capture includes them, and
root-relative script URLs are rewritten to `https://kagi.com/...` for local
viewing under Vite. The current `/search` capture predates that rule and has no
script tags, so generated enhanced pages infer Kagi's public `k_sea.js` and
`k_serp.js` URLs from the captured asset revision. Each bundle also gets a
no-CSS baseline page so native Kagi rendering can be compared against Custom CSS
output.

Enhanced `/search` pages replay the frozen `search.domain-info.json` payload at
runtime. That keeps fixture generation offline while still letting Kagi's real
popover code populate shield metadata for the rendered result domains. Refresh
the sidecar with `pnpm capture-domain-info` when recapturing `search.html`.

`pnpm audit-css` reports selector matches across those generated bundles. The
audit also records source bytes, deterministic minified bytes, line count,
selector count, distinct private Kagi hooks, structural selectors, and `:has()`
usage. Size comparisons use minified bytes so readable local CSS is not compared
against minified served CSS.

`pnpm check-js-popovers` runs the JS-specific interaction check. It serves the
generated matrix pages, loads the Kagi runtime on enhanced `/search` pages,
clicks each unique rendered result shield domain plus the first three-dot result
menu, and writes `generated/reports/js-popovers.json` plus screenshots under
`generated/screenshots/js-popovers/`. This check is intentionally separate from
the selector audit because opened popovers depend on runtime handlers, geometry,
state classes, and transitions.

The sidebar corpus includes:

- `css-corpus/original/sidebar.css`: the current distributable sidebar CSS.
- `css-corpus/semantic/sidebar.css`: a semantic rewrite targeting proposed
  `data-kagi-*` filter hooks.
- `kagi-authored-css/optimized/search-controls.css`: lab-owned optimized Kagi
  CSS for the optimized search-control bundle.

The optimized bundle currently simplifies the filter shell plus Matching, Time,
Region, and Sort controls. Public CSS corpus expansion and screenshot
automation are still pending.

Generated pages rewrite Kagi root-relative stylesheet and image asset URLs to
`https://kagi.com/...` so matrix pages render under Vite. Source captures stay
redacted evidence; local-viewing rewrites happen in generated output.
