# Kagi Sidebar

Kagi Sidebar is an unofficial CSS-only customization for Kagi Custom CSS. It
moves the standard web search filters into a compact left sidebar on desktop for
both JS-enhanced and basic/no-JS web search, while preserving Kagi's native
search behavior, links, forms, dropdowns, and result rendering.

<img width="1103" height="748" alt="image" src="https://github.com/user-attachments/assets/3f9fa60f-6269-4cdb-af89-da00b632cc1b" />

## Install

1. Open Kagi Custom CSS settings:
   https://kagi.com/settings/custom_css
2. Paste the contents of `kagi-sidebar.css`.
3. Save, then open a Kagi web search result page.

If the saved CSS needs to be bypassed, add `no_css=1` to a Kagi URL:

```text
https://kagi.com/search?q=test&no_css=1
```

## Support Scope

This release targets desktop Kagi web search only:

- Supported: standard Kagi web/all search result pages at `1100px` and wider,
  including `/search` and `/html/search`.
- Fallback: below `1100px`, Kagi's native horizontal filter toolbar remains.
- Out of scope: Images, Videos, News, Podcasts, Maps, Assistant, settings pages,
  and mobile/narrow layouts.

The stylesheet uses modern CSS, including `:has()`, and depends on Kagi's
current search filter markup. Kagi markup changes may require stylesheet updates.

## Verification

After installing, check:

- Desktop JS-enhanced and no-JS web search show the left sidebar.
- Narrow viewports and unsupported modes keep Kagi's native toolbar.
- Matching, Time, Region, Sort, Lens, Advanced, and Clear keep their native
  behavior.
- Active filters are visible, long Region labels clip cleanly, and light/dark
  themes remain legible.

## Project Files

- `kagi-sidebar.css` - pasteable Kagi Custom CSS stylesheet.
- `../specs/kagi-sidebar.md` - release scope, behavior, and implementation
  notes.
- `../proposal/making-kagi-simpler-smaller-easier-to-customize.md` -
  maintainer-facing Kagi frontend simplification and Custom CSS hook proposal.
- `../previewer/` - local previewer for testing Custom CSS against captured
  Kagi search pages.

## License

MIT. See `../LICENSE`.
