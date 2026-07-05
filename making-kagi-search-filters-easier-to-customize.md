# Making Kagi Search Filters Easier to Customize with CSS

Superseded by
[`making-kagi-simpler-smaller-easier-to-customize.md`](./making-kagi-simpler-smaller-easier-to-customize.md).
This narrower draft is kept as historical context and may not reflect the latest
stylesheet details.

Audience: Kagi engineers, designers, and frontend maintainers.

## Summary

Kagi already exposes enough search filter markup for a CSS-only sidebar
customization to work on desktop web search. The current markup is close, but it
is not yet a stable customization contract: custom CSS has to infer result mode
from nav classes, target implementation-specific dropdown IDs, and override
closed dropdown internals that were not designed to be rendered inline.

The most useful refactor would not require Kagi to ship a sidebar itself. It
would add stable, semantic HTML attributes and CSS variables around the existing
filter system so users can safely restyle filter placement without depending on
private classes or mode-specific IDs.

## Observed Structure

Observed July 3, 2026 with `no_css=1` and a neutral query.

| Mode | Path | Filter structure | Notes |
| --- | --- | --- | --- |
| Web | `/search` | `#sidebarForm` inside `._0_filters-panel` | Lens, Region, Order, Time, Options, Advanced, Clear |
| Images | `/images` | Same filter wrapper | Adds single-click filters plus Size, Color, License, Image Types, Aspect, Time, AI Images |
| Videos | `/videos` | Same filter wrapper | Order, Time, Duration, Resolution, Source, AI Videos, Clear |
| News | `/news` | Same filter wrapper | Order, Region, Time, Clear |
| Podcasts | `/podcasts` | Same filter wrapper | Order, Clear |
| Maps | `/maps` | Redirects to `/maps/search` | Separate app surface; no `#sidebarForm`/filter panel observed |

The shared filter wrapper is a strong foundation for cross-mode customization.
The main gap is that the reusable concept is not expressed as stable semantics.

## Current Pain Points

1. Result mode is inferred from nav classes.

   The current CSS gates web-search-only styling with:

   ```css
   body:has(header nav a.n_se.--active)
   ```

   This is fragile for two reasons: it couples layout CSS to navigation
   implementation details, and mode classes are not unique enough for a public
   customization contract. For example, News and Podcasts both used `n_ne` in
   the sampled markup.

2. Filter identity is encoded in implementation IDs.

   Web search uses IDs such as `#dd_toggle_dr` for Time and
   `#dd_toggle_options` for Matching. Other modes use different IDs for similar
   concepts, such as `#dd_toggle_freshness` for Time/Freshness. Custom CSS has
   to know these IDs and their per-mode meanings.

3. Closed dropdown content exists in the DOM but is hard to promote.

   This is the key reason a CSS-only sidebar is possible. However, closed lists
   are hidden through a mix of `position: absolute`, `visibility: hidden`, fixed
   heights, and `overflow: hidden`. Sidebar CSS has to reverse those internals
   with many targeted overrides.

4. Layout offsets require targeting page internals.

   Moving the filter panel to a sidebar requires shifting the header, top panel,
   and result content. Today that means targeting selectors such as
   `header.app-header`, `.top-panel-box`, and `#_0_app_content`.

5. Active state is available but not normalized.

   Filter options can expose active state through `.inner-label[aria-current]`,
   which is useful. A stable `data-kagi-active` or consistent `aria-current`
   contract across every option type would make customization safer.

## Recommended Markup Hooks

Add stable attributes that describe Kagi's UI concepts without committing to a
specific visual layout.

```html
<body data-kagi-surface="search" data-kagi-result-mode="web">
  <nav data-kagi-result-nav>
    <a data-kagi-result-mode-link="web" aria-current="page">All</a>
    <a data-kagi-result-mode-link="images">Images</a>
  </nav>

  <section data-kagi-filter-panel data-layout="inline">
    <form data-kagi-filter-form>
      <div
        class="filter-item"
        data-kagi-filter="time"
        data-kagi-filter-kind="single-select"
        data-kagi-promotable="true"
      >
        <button data-kagi-filter-trigger aria-expanded="false">Time</button>
        <div data-kagi-filter-options data-state="closed">
          <a data-kagi-filter-option data-value="all" aria-current="true">All</a>
          <a data-kagi-filter-option data-value="past-week">Past Week</a>
        </div>
      </div>
    </form>
  </section>
</body>
```

Recommended attributes:

- `data-kagi-surface="search"` on the root search surface.
- `data-kagi-result-mode="web|images|videos|news|podcasts"` on `body` or the
  app root.
- `data-kagi-filter-panel` on the filter panel wrapper.
- `data-kagi-filter-form` on the filter control form.
- `data-kagi-filter="region|order|time|matching|lens|size|color|license|duration|source|ai|clear"`.
- `data-kagi-filter-kind="single-select|multi-select|toggle|action|link"`.
- `data-kagi-filter-trigger` on the visible trigger.
- `data-kagi-filter-options` on the option list/popup.
- `data-state="open|closed"` or consistent `aria-expanded` state hooks.
- `data-kagi-filter-option` and `aria-current="true"` on active options.

These hooks would let custom CSS target concepts rather than private IDs:

```css
body[data-kagi-result-mode="web"] [data-kagi-filter="time"] [data-kagi-filter-options] {
  display: block;
}
```

## Recommended CSS Hooks

Expose layout variables for the filter panel and result content. The goal is to
avoid users overriding Kagi internals just to reserve sidebar space.

```css
:root {
  --kagi-filter-panel-placement: inline;
  --kagi-filter-sidebar-width: 0px;
  --kagi-filter-sidebar-left: 0px;
  --kagi-filter-sidebar-top: auto;
  --kagi-search-content-offset-inline-start: 0px;
}
```

Kagi could then support a documented customization shape:

```css
@media (min-width: 1100px) {
  body[data-kagi-result-mode="web"] {
    --kagi-filter-panel-placement: sidebar;
    --kagi-filter-sidebar-width: 168px;
    --kagi-search-content-offset-inline-start: 214px;
  }
}
```

If Kagi does not want to implement placement logic, it could still expose stable
wrapper classes and variables:

- `--kagi-app-header-offset-inline-start`
- `--kagi-search-results-offset-inline-start`
- `--kagi-filter-panel-z-index`
- `--kagi-filter-panel-max-block-size`
- `--kagi-filter-option-active-color`
- `--kagi-filter-option-active-background`

## Designer-Relevant Notes

These hooks do not force a sidebar into Kagi's product UI. They preserve native
behavior while letting users experiment with density, grouping, and placement.

The design-sensitive part is naming and grouping. Filters should have stable
semantic identities even when labels differ across modes. For example, Web
`Time`, Images `Time`, Videos `Time`, and News `Time` can all share
`data-kagi-filter="time"` even if the underlying query parameter or dropdown ID
differs.

Mode-specific labels can still remain product-authored. Custom CSS should not
need to parse visible text or reverse-engineer IDs to understand that a control
is a time filter, region filter, or clear action.

## Estimated CSS Size Reduction

Current `kagi-sidebar.css` after cleanup:

- 17,711 bytes.
- 475 lines.
- About 118 selector entries.
- 131 `:has()` uses.
- 54 `!important` overrides.
- 54 `.dd-list` references.
- 37 `:not(:checked)` references.
- 8 hard-coded Kagi IDs for the main web-search implementation.

The estimate below assumes the current visual design stays roughly the same.
The byte savings would come from removing inference and override code, not from
minification.

| Kagi hook level | Expected custom CSS size | Reduction | Why |
| --- | ---: | ---: | --- |
| Stable mode/filter attributes only | 13-15 KB | 15-25% | Removes the most fragile mode and ID selectors, but still requires dropdown and layout overrides |
| Attributes plus dropdown state/list hooks | 8-11 KB | 40-55% | Removes most hidden-list reversal, many `:checked`/`:not(:checked)` selectors, and many `!important`s |
| Attributes plus dropdown hooks plus layout variables | 3-5 KB | 70-83% | Custom CSS mainly sets order, promoted options, width, and visual style |
| Native Kagi sidebar placement option | 0.5-2 KB | 90%+ | Custom CSS becomes preference styling rather than layout surgery |

The strongest near-term return is not byte reduction alone. It is reducing
fragility enough that the same customization can be extended to Images, Videos,
News, and Podcasts without writing a separate ID map and dropdown-reset block
for each mode.

## Priority Proposal

P0: Add stable result-mode and filter-identity hooks.

- Root: `data-kagi-surface` and `data-kagi-result-mode`.
- Filters: `data-kagi-filter` and `data-kagi-filter-kind`.
- Options: `data-kagi-filter-option` plus consistent active state.

P1: Add dropdown state hooks that are safe for CSS customization.

- Use consistent `aria-expanded` and/or `data-state`.
- Add a stable options wrapper.
- Avoid requiring users to override hidden closed-state internals to display
  selected lists inline.

P2: Add layout variables or a documented filter-panel placement contract.

- Let custom CSS reserve sidebar space through variables.
- Keep native inline behavior as the default.
- Allow custom placement without targeting header/content internals.

## Acceptance Criteria for the Hooks

A custom CSS author should be able to:

- Select a result mode without inspecting nav implementation classes.
- Select a filter by semantic role across multiple result modes.
- Style active filter options with a single selector.
- Promote selected dropdown options into an inline/sidebar list without
  overriding private closed-dropdown positioning rules.
- Reserve sidebar space without targeting Kagi header and content internals.
- Extend the same stylesheet from Web to Images/Videos/News/Podcasts by adding
  mode-specific ordering and visibility rules, not by reverse-engineering each
  mode's IDs.

For users testing custom CSS today, the relevant settings page is:

```text
https://kagi.com/settings/custom_css
```
