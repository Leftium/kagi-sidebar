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

## Current Slice

This scaffold tracks the local sidebar CSS as the first corpus sample. The HTML
capture pipeline and semantic sidebar rewrite come next.
