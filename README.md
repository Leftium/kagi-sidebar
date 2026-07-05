# Kagi Sidebar

This repo now has three responsibilities:

```text
sidebar/      distributable Kagi Custom CSS
proposal/     maintainer-facing Kagi HTML/CSS optimization proposal
fixture-lab/  source files and tools for compatibility fixtures
generated/    reproducible lab output, ignored by git
```

The sidebar CSS remains the usable artifact. The fixture lab exists to test a
future Kagi HTML contract against real Custom CSS instead of hand-written toy
examples.

## Commands

Install dependencies with pnpm before running the lab:

```bash
pnpm install
```

Useful commands:

```bash
pnpm dev       # open the Vite fixture picker
pnpm generate  # prepare generated lab output
pnpm audit-css # inspect selector usage in the CSS corpus
pnpm format    # format tracked source files
pnpm check     # run deterministic non-browser lab checks
```

`generated/` is disposable. Regenerate it when captures, CSS corpus files, or
tools change.

## Main Files

- `sidebar/kagi-sidebar.css` is the pasteable Kagi Custom CSS stylesheet.
- `specs/kagi-sidebar.md` documents the sidebar release scope and behavior.
- `proposal/making-kagi-simpler-smaller-easier-to-customize.md` is the Kagi
  frontend simplification proposal draft.
- `specs/kagi-html-css-optimization-lab.md` is the active implementation plan
  for the fixture lab.

## License

MIT. See `LICENSE`.
