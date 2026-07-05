# Captures

Store redacted Kagi HTML captures here.

Rules:

- Commit source captures only after credential redaction.
- Keep original captures separate from generated variants.
- Prefer neutral search queries.
- Do not store tokenized Kagi URLs.

The first expected files are:

```text
original/search.html
original/html-search.html
```

Current captures:

- `original/search.html` is the settled JS-enhanced `/search` DOM for a neutral
  `kagi css selectors` query.
- `original/html-search.html` is the basic `/html/search` DOM for the same
  query.
