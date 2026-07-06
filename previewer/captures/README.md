# Captures

Store redacted Kagi HTML captures here.

Rules:

- Commit source captures only after credential redaction.
- Keep original captures separate from generated preview pages.
- Prefer neutral search queries.
- Do not store tokenized Kagi URLs.
- For JS-enhanced `/search` captures, keep script tags when runtime interactions
  need to be tested; redact credentials without converting the capture into a
  scriptless DOM snapshot.
- Keep the matching `*.domain-info.json` sidecar with JS-enhanced `/search`
  captures when shield popovers need to be tested. The sidecar stores Kagi's
  real domain-info payload for the rendered result domains, with token-like
  favicon proxy URLs omitted.
- The generator can infer public Kagi runtime script URLs for older scriptless
  `/search` captures, but fresh captures should keep the source script tags.

Refresh the domain-info sidecar after recapturing `search.html`:

```sh
pnpm capture-domain-info
```

The command needs a browser session that can load Kagi search results. It does
not run during `pnpm generate`; generation replays the frozen sidecar offline.
Use `KAGI_CAPTURE_USER_DATA_DIR=/path/to/playwright-profile` or
`--user-data-dir /path/to/playwright-profile` when the fresh browser context is
not already signed in. Add `--headed` if you need to inspect that profile while
recapturing.

The first expected files are:

```text
original/search.html
original/search.domain-info.json
original/html-search.html
```

Current captures:

- `original/search.html` is the settled JS-enhanced `/search` DOM for a neutral
  `kagi css selectors` query.
- `original/search.domain-info.json` is the matching Kagi domain-info payload
  for the rendered result domains.
- `original/html-search.html` is the basic `/html/search` DOM for the same
  query.
