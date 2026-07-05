# Making Kagi Simpler, Smaller, and Easier to Customize

Date: July 5, 2026
Status: Draft proposal
Audience: Kagi engineers, designers, and frontend maintainers.

One sentence: Kagi can simplify its standard frontend output and make
functional Custom CSS safer by exposing stable semantic hooks for pages,
controls, options, states, and layout slots.

This does not assume Kagi should ship a sidebar. The sidebar is only the
motivating case study.

## Summary

The sampled Kagi search pages show concrete opportunities to simplify delivered
HTML and CSS while preserving the flexibility that makes Kagi customizable. The
same work would also make functional Custom CSS easier to author.

Functional Custom CSS means customization that changes layout, density,
ordering, visibility, and workflow surfaces while preserving Kagi-authored
behavior. It is broader than cosmetic theming, but it should not require users
to recreate search behavior in CSS.

Real-world Custom CSS examples show that users already do this. Community themes
compact results, hide widgets, demote AI-labeled results, recreate familiar
layouts, and improve low-vision readability. Many of those examples are forced
to target private selectors such as `.__sri-*`, `.sri-group`,
`.newsResultItem`, `.podcast_result`, `.quick-search-btn`, and `._0_*`.

The proposal is not "add a sidebar." The proposal is to make Kagi's own
frontend contracts more semantic and reusable:

- Identify page surfaces, modes, controls, options, and states with stable
  attributes.
- Share those contracts between JS-enhanced search and no-JS/basic search.
- Reduce repeated per-option URL and selector weight where normal HTML forms can
  preserve behavior.
- Expose layout variables so Kagi CSS and user CSS do not need to target private
  page internals.

This proposal allows breaking compatibility with existing private-selector
Custom CSS. The goal is a cleaner future contract, not preserving every
accidental selector dependency.

## Goals and Constraints

- Optimize Kagi's standard HTML/CSS output first, even if no Custom CSS is used.
- Keep at least Kagi's current browser support level for the main refactor.
- Preserve no-JS/basic search behavior as a first-class output path.
- Keep modern CSS enhancements optional and conservative.
- Avoid making popover, anchor positioning, or browser-imported top-level
  `await` core requirements.
- Treat Custom CSS as scoped to Kagi search and landing pages unless Kagi changes
  that product boundary. Kagi's current docs say Custom CSS does not apply to
  Settings pages.

There are two tiers:

- **Compatible refactor:** same browser support as current Kagi; works for both
  `/search` and `/html/search`.
- **Conservative modern enhancement:** optional use of well-supported features
  such as `:where()`, cascade layers, and size container queries.

## Measured Signals

Observed July 5, 2026 from a logged-in Kagi session with a neutral query. The
measurements used `no_css=1` to avoid saved Custom CSS changing the output.
Counts are sample-specific. They are not a full production bundle audit, but
they validate that the simplification hypothesis is worth pursuing.

For search, Kagi serves at least two outputs:

- JS-enhanced search: `/search?q=kagi+css+selectors&no_css=1`
- No-JS/basic search: `/html/search?q=kagi+css+selectors&no_css=1`

| Output path | HTML bytes | Elements | IDs | Class tokens | Filter panel bytes | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `/search` | 139,598 | 1,510 | 108 | 797 | 48,326 | JS-enhanced search output |
| `/html/search` | 174,312 | 1,966 | 355 | 1,273 | 48,598 | Basic/no-JS output with extra `_nojs` markup |

Both paths linked the same core CSS assets:

| CSS asset | Decoded bytes | Encoded body bytes | CSSOM `!important` declarations | ID references in selectors |
| --- | ---: | ---: | ---: | ---: |
| `search-layout.scss.css` | 94,182 | 16,743 | 72 | 66 |
| `main-search-results.scss.css` | 101,300 | 17,102 | 28 | 409 |
| `kagi_themes.scss.css` | 31,536 | 4,339 | 0 | 4 |
| `framework/main.scss.css` | 16,819 | 3,694 | 1 | 0 |
| `tooltip_new.scss.css` | 2,947 | 763 | 0 | 0 |

These stylesheet counts do not prove waste by themselves. Some specificity may
be intentional. They do show enough selector and state complexity that a
semantic component contract could reduce implementation cost and Custom CSS
fragility.

## Community Custom CSS Signals

Kagi's own Custom CSS material describes layout, spacing, visibility, fonts, and
colors as legitimate customization targets. The linked community examples show
that the demand is broader than color themes.

Observed use cases include:

- Density and spacing changes across Search, Home, News, Podcasts, and mobile.
- Familiar layouts, such as recreating a Google-like results page.
- Accessibility and low-vision readability changes: higher contrast, larger
  type, stronger focus outlines, heavier link styling, and more spacing around
  interactive controls.
- Decluttering: hiding quick search, answer boxes, web archive widgets, favicons,
  URL path pieces, image metadata, video descriptions, and AI-related UI.
- Result classification: visually demoting AI-labeled results without hiding the
  result entirely.
- Full visual themes that restyle result cards, widgets, dropdowns, search
  inputs, and Assistant surfaces.

These examples mostly break into two groups:

1. Theme-token work that is already reasonably simple. Color variables, broad
   font choices, and whole-page typography rules may not get much shorter from a
   markup refactor.
2. Product-concept work that is fragile today. Styling "result title", "URL",
   "snippet", "quick answer", "AI-labeled result", "podcast result", or "search
   options" often requires private selector piles and `!important`.

The second group is the opportunity. The detailed cases are in
[Appendix: Real-World Kagi Custom CSS Cases](./appendix-real-world-kagi-custom-css.md).

## Case Study: Search Filters

Search filters are the measured case study, not the full scope. They are useful
because Kagi already exposes enough markup for a CSS-only sidebar to work on
JS-enhanced desktop web search, but the customization depends on private
selectors.

Observed filter structure:

| Mode | Path | Filter structure | Notes |
| --- | --- | --- | --- |
| Web | `/search` | `#sidebarForm` inside `._0_filters-panel` | Lens, Region, Order, Time, Options, Advanced, Clear |
| Images | `/images` | Same filter wrapper | Size, Color, License, Image Types, Aspect, Time, AI Images |
| Videos | `/videos` | Same filter wrapper | Order, Time, Duration, Resolution, Source, AI Videos, Clear |
| News | `/news` | Same filter wrapper | Order, Region, Time, Clear |
| Podcasts | `/podcasts` | Same filter wrapper | Order, Clear |
| Maps | `/maps` | Separate app surface | Redirects to `/maps/search`; no `#sidebarForm`/filter panel observed |

The shared filter wrapper is a good foundation. The gap is that the reusable
concept is not expressed as stable semantics.

## Findings

1. Result mode is inferred from implementation details.

   The initial sidebar CSS gated web-search-only styling with:

   ```css
   body:has(header nav a.n_se.--active)
   ```

   This couples layout CSS to navigation markup. It is also not a reliable
   public mode contract: sampled News and Podcasts links both used `n_ne`.

   The no-JS path confirms the problem. `/html/search` still has `#sidebarForm`
   and the main dropdown IDs, and it loads Custom CSS when `no_css=1` is absent,
   but it does not expose the same active `header nav` selector.

   The local stylesheet now uses:

   ```css
   body:has(#sidebarForm #dd_toggle_options)
   ```

   That makes the sidebar work on both `/search` and `/html/search`, but it is
   still a private implementation hook. A stable mode or filter contract would
   avoid choosing between a nav class and a dropdown ID.

2. Similar filter concepts use different implementation IDs.

   Web search uses `#dd_toggle_dr` for Time and `#dd_toggle_options` for
   Matching. Other modes use different IDs for similar concepts, such as
   `#dd_toggle_freshness` for Time/Freshness.

3. Active state is useful but not normalized.

   Filter options can expose active state through
   `.inner-label[aria-current="true"]`. A consistent `aria-current` or
   documented `data-kagi-active` contract across option types would be safer.

4. Closed dropdown content is present but hard to repurpose.

   Dropdown contents are in the DOM, which makes CSS-only customization
   possible. However, closed lists are hidden through `position`, `visibility`,
   fixed heights, `max-height`, and `overflow`, so alternate layouts must undo
   private internals.

5. Layout customization targets page internals.

   Moving controls into a sidebar currently requires shifting `header.app-header`,
   `.top-panel-box`, and `#_0_app_content`.

6. Some option lists repeat substantial URL data.

   On the sampled `/html/search` output, the Region filter contained 259 option
   links and measured 42,097 bytes by itself. The `href` attributes accounted
   for 12,192 bytes.

   | Region option shape | Approximate bytes | Difference from current |
   | --- | ---: | ---: |
   | Current dropdown link markup | 42,097 | baseline |
   | Submit-button list inside one GET form | 17,232 | -24,865 |
   | Native `<select name="r">` options | 11,276 | -30,821 |

   The `<select>` shape is smallest, but it changes the UI more. A submit-button
   list can preserve a list-like control while avoiding repeated full URLs.

## Compatible Refactor

The main recommendation is a semantic contract shared by Kagi's own CSS,
JS-enhanced search, no-JS search, and Custom CSS.

Example shape:

```html
<body data-kagi-surface="search" data-kagi-result-mode="web">
  <nav data-kagi-result-nav>
    <a data-kagi-result-mode-link="web" aria-current="page">All</a>
    <a data-kagi-result-mode-link="images">Images</a>
  </nav>

  <section data-kagi-filter-panel data-layout="inline">
    <form action="/html/search" method="get" data-kagi-filter-form>
      <input type="hidden" name="q" value="kagi css selectors">

      <section
        data-kagi-filter="time"
        data-kagi-filter-kind="single-select"
        data-kagi-promotable="true"
      >
        <button data-kagi-filter-trigger aria-expanded="false">Time</button>
        <div data-kagi-filter-options data-state="closed">
          <button
            type="submit"
            name="dr"
            value=""
            data-kagi-filter-option
            aria-current="true"
          >
            All
          </button>
        </div>
      </section>
    </form>
  </section>
</body>
```

Recommended hooks:

- Page: `data-kagi-surface`, `data-kagi-result-mode`, optional `data-kagi-js`.
- Navigation: `data-kagi-result-nav`, `data-kagi-result-mode-link`.
- Filters: `data-kagi-filter-panel`, `data-kagi-filter-form`,
  `data-kagi-filter`, `data-kagi-filter-kind`.
- Controls: `data-kagi-filter-trigger`, `data-kagi-filter-options`,
  `data-kagi-filter-option`, `data-kagi-promotable`.
- Results: `data-kagi-result`, `data-kagi-result-type`,
  `data-kagi-result-title-link`, `data-kagi-result-url`,
  `data-kagi-result-snippet`, `data-kagi-result-actions`,
  `data-kagi-ai-label`.
- Widgets and actions: `data-kagi-widget`, `data-kagi-action`.
- State: `aria-current`, `aria-expanded`, and/or `data-state="open|closed"`.

Mode-specific labels, query parameters, and server behavior can remain
product-authored. Custom CSS should not need to parse visible text or
reverse-engineer IDs to know that a control is a time filter, region filter, or
clear action. The same principle should apply to result titles, snippets,
widgets, AI labels, and mode-specific result types.

Where no-JS behavior matters, standard GET forms should be the baseline and JS
should enhance them. This keeps behavior inspectable, reduces repeated URLs, and
lets `/search` and `/html/search` share the same semantic contract.

## Layout Variables

Expose variables for page-level layout slots:

```css
:root {
  --kagi-search-controls-inline-size: 0px;
  --kagi-search-controls-offset-inline-start: 0px;
  --kagi-search-content-offset-inline-start: 0px;
  --kagi-app-header-offset-inline-start: 0px;
  --kagi-search-controls-z-index: 53;
  --kagi-search-controls-max-block-size: none;
}
```

Kagi can keep the default horizontal toolbar while allowing controlled
experimentation:

```css
@media (min-width: 1100px) {
  body[data-kagi-surface="search"][data-kagi-result-mode="web"] {
    --kagi-search-controls-inline-size: 168px;
    --kagi-search-content-offset-inline-start: 214px;
  }
}
```

## Expected Impact

The current sidebar Custom CSS works on both JS-enhanced and basic/no-JS web
search, but its size shows the selector burden created by the lack of semantic
hooks:

- 18,265 bytes.
- 474 lines.
- 131 `:has()` uses.
- 54 `!important` overrides.
- 54 `.dd-list` references.
- 37 `:not(:checked)` references.
- 8 hard-coded Kagi IDs for the main web-search implementation.

Estimated Custom CSS reduction if the visual design stays roughly the same:

| Kagi hook level | Expected custom CSS size | Reduction | Why |
| --- | ---: | ---: | --- |
| Stable mode/filter attributes only | 13-15 KB | 15-25% | Removes fragile mode and ID selectors |
| Attributes plus dropdown state/list hooks | 8-11 KB | 40-55% | Removes most hidden-list reversal and many `!important`s |
| Attributes plus dropdown hooks plus layout variables | 3-5 KB | 70-83% | Custom CSS mainly sets order, width, and visual style |
| Native Kagi sidebar placement option | 0.5-2 KB | 90%+ | Custom CSS becomes preference styling |

The standard-output savings are separate from Custom CSS savings. The sampled
Region filter alone shows that semantic form-oriented markup can remove tens of
kilobytes from one repeated option list while preserving no-JS behavior.

## Generalization Beyond Search Filters

The same approach can apply to other Kagi page areas:

- Result cards: stable hooks for title, URL, snippet, actions, ranking controls,
  and metadata.
- Navigation: stable surface and mode identity independent of visual nav
  structure.
- Search and landing widgets: stable hooks for quick answers, related searches,
  web archive, image/video/news/podcast modules, weather, dictionary, and other
  optional result-page modules.
- Side panels and page slots: stable region roles and layout variables.
- Modals and popovers: normalized trigger, panel, state, and close hooks.
- Search inputs and quick actions: stable hooks for search boxes, submit buttons,
  quick search, summarize, discuss, and other repeated actions.

The goal is not to turn every private class into a public API. The goal is to
publish a small set of semantic contracts where users reasonably want to change
layout, density, visibility, or workflow. Settings pages are intentionally not
included here because Custom CSS does not apply to Settings pages today.

## Migration Path

Some existing Custom CSS would break if Kagi removed private selectors as part of
the refactor. That is acceptable only if the migration path is explicit.

Recommended path:

1. Add new `data-kagi-*` hooks to the current markup before removing old classes
   or IDs.
2. Publish a selector mapping from common private selectors to semantic hooks.
3. Keep a short-term compatibility shim for the most common old selectors when
   that does not require preserving the old DOM shape.
4. Test representative community themes against current fixtures and rewritten
   fixtures.
5. Offer a best-effort migration tool for safe selector rewrites. Flag structural
   selectors such as `:nth-child`, sibling hacks, deep SVG paths, and private
   layout IDs for manual review.

Full backward compatibility is not realistic if Kagi simplifies the HTML. The
safer goal is additive hooks first, a documented deprecation window, and a
mechanical path for common selectors.

## Priority Proposal

P0: Add stable page, result-mode, and filter-identity hooks.

P1: Make `/search` and `/html/search` share the same semantic contract.

P2: Add dropdown state hooks that are safe for CSS customization.

P3: Reduce repeated action URLs where standard forms can preserve behavior.

P4: Add layout variables or a documented filter-panel placement contract.

P5: Publish a Custom CSS migration map and test it against representative
community examples.

## Acceptance Criteria

- Kagi's standard output is measurably smaller or simpler for representative
  pages, before applying any Custom CSS.
- `/search` and `/html/search` expose the same semantic page, mode, control, and
  state hooks.
- Common controls such as Time, Region, Order, and Clear can be styled by
  product concept instead of private IDs.
- Active option styling works with one selector across modes.
- Alternate filter placement does not require overriding private closed-dropdown
  positioning rules.
- Sidebar or compact-toolbar experiments can reserve space through layout
  variables rather than targeting header and content internals.
- Common result, widget, search-input, and quick-action customizations can be
  written against semantic hooks instead of private classes.
- Existing Custom CSS breakage is measured against a representative sample and
  documented with a migration map.

## Suggested Next POC

1. Capture sanitized fixtures for `/search` and `/html/search` with a neutral
   query and `no_css=1`.
2. Rewrite only the search filter shell into a compatible semantic form-based
   component.
3. Recreate Kagi's current horizontal layout and the sidebar layout against the
   rewritten shell.
4. Measure HTML bytes, CSS bytes, gzip/Brotli sizes, selector count,
   `!important` count, ID selector count, and no-JS behavior.
5. Run representative community Custom CSS against current and rewritten
   fixtures. Classify what still works, what can be migrated mechanically, and
   what needs manual review.
6. Repeat for Images, Videos, News, and Podcasts only after Web search proves
   the pattern.

## References

- Kagi Custom CSS settings: https://kagi.com/settings/custom_css
- Real-world Custom CSS cases: ./appendix-real-world-kagi-custom-css.md
- MDN `:where()`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/%3Awhere
- MDN `@layer`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40layer
- MDN container queries: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries
- web.dev Baseline overview: https://web.dev/baseline
