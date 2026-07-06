# Kagi Sidebar

This repo centers on one usable artifact: a pasteable Kagi Custom CSS stylesheet
that moves web search filters into a compact desktop sidebar.

```text
src/        distributable Kagi Custom CSS
previewer/  local capture previewer for visual checks
proposal/   maintainer-facing Kagi HTML/CSS proposal drafts
specs/      sidebar notes and historical planning docs
generated/  reproducible preview output, ignored by git
```

The semantic-DOM proposal work is now background. The active path is maintaining
and testing the current Custom CSS sidebar against captured Kagi `/search` and
`/html/search` pages.

## Commands

Install dependencies with pnpm before running the previewer:

```sh
pnpm install
```

Useful commands:

```sh
pnpm generate # prepare generated preview pages
pnpm dev      # open the Vite previewer
pnpm check    # run cheap JavaScript syntax checks
pnpm format   # format tracked source files
```

`generated/` is disposable. Regenerate it when captures, Custom CSS files, or
previewer tools change.

## Main Files

- `src/kagi-sidebar.css` is the pasteable Kagi Custom CSS stylesheet.
- `specs/kagi-sidebar.md` documents the sidebar release scope and behavior.
- `previewer/` opens captured Kagi pages with `src/kagi-sidebar.css` or extra
  local Custom CSS files.
- `proposal/` keeps maintainer-facing proposal drafts for reference.

## License

MIT. See `LICENSE`.
