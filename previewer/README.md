# Previewer

The previewer opens redacted Kagi search captures with local Custom CSS files.
It exists for quick visual checks of the sidebar release against both Kagi
renderers:

```text
captures/original/  redacted Kagi HTML captures
custom-css/         optional extra Custom CSS files to preview
site/               Vite picker for generated pages
tools/              capture and generation scripts
```

`src/kagi-sidebar.css` is always included as the primary Custom CSS file. Any
`.css` file placed directly in `previewer/custom-css/` is added as another
picker option.

Generated output is written to the repo-level `generated/` directory and is not
tracked.

## Workflow

Generate preview pages:

```sh
pnpm generate
```

Open the picker:

```sh
pnpm dev
```

Vite serves the repo root. The picker opens at `http://127.0.0.1:5173/` and
redirects to `previewer/site/`.

## Captures

The current inputs are:

- `captures/original/search.html`: JS-enhanced `/search` DOM.
- `captures/original/search.domain-info.json`: frozen domain-info runtime
  payload for rendered result domains.
- `captures/original/html-search.html`: basic `/html/search` DOM.

Generated pages rewrite Kagi root-relative stylesheet, script, and image URLs to
`https://kagi.com/...` so they can render locally. For older scriptless
`/search` captures, the generator infers Kagi's public runtime script URLs from
the captured asset revision and replays the frozen domain-info sidecar.

Refresh the domain-info sidecar after recapturing `search.html`:

```sh
pnpm capture-domain-info
```

That command needs a browser session that can load Kagi search results. It is
separate from `pnpm generate` because it uses live Kagi runtime behavior.

## Generated Shape

`pnpm generate` writes:

```text
generated/pages/                 capture x Custom CSS pages
generated/previewer/manifest.json
generated/reports/generation-summary.json
```

There are no HTML variants, CSS variants, or no-CSS baseline pages. The only
reported size metric is the Custom CSS character count against Kagi's 40,000
character limit.
