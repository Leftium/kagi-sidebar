# Kagi Semantic DOM Contract

Date: July 6, 2026
Status: Draft contract
Audience: Kagi engineers, designers, frontend maintainers, and Custom CSS authors.

One sentence: Kagi web search can expose stable semantic hooks, semantic
component structure, and native layout modes for page identity, controls,
filters, results, widgets, actions, and state while preserving no-JS behavior.

This document is the implementation contract behind
`making-kagi-simpler-smaller-easier-to-customize.md`. The proposal explains why
the contract is useful. This file names the DOM hooks the fixture lab should
prove.

## Scope

Initial scope:

- Web search result pages: `/search` and `/html/search`.
- The full search results page, not only the filter toolbar.
- Page identity, navigation, search forms, filters, result lists, result cards,
  widgets, action menus, popovers, and layout slots.
- Both JS-enhanced and basic/no-JS output.

Deferred scope:

- Images, Videos, News, Podcasts, Maps, Assistant, and Settings pages.
- Non-search product surfaces unless Kagi decides Custom CSS should cover them.
- Pixel-perfect sidebar behavior. The sidebar is a proving case, not the
  product contract.

## Contract Layers

The proposal has three layers because migration safety, component
simplification, and layout placement are different jobs.

| Layer | What it means | Where it belongs |
| --- | --- | --- |
| Semantic hooks | Stable `data-kagi-*` attributes identify product concepts on today's DOM. | Backwards-compatible markup. |
| Semantic component structure | Markup and Kagi-authored CSS own component anatomy such as trigger, preview, popover, list, option, search, section, and action. | Optimized/breaking markup. |
| Native layout modes | Kagi exposes supported placements such as horizontal toolbar or sidebar through attributes, variables, or settings. | Kagi product behavior, optionally styled by Custom CSS. |

The fixture lab still uses two generated compatibility levels:

| Level                | What changes                                                     | Compatibility promise                                                     |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Backwards-compatible | Adds stable `data-kagi-*` hooks to the current DOM.              | Existing private-selector Custom CSS should keep matching.                |
| Optimized            | Rewrites private structure into semantic HTML and form controls. | Old private selectors may break; no-JS search behavior must keep working. |

The backwards-compatible level proves that Kagi can add hooks before removing
old structure. The optimized level proves the payoff after Kagi is allowed to
change that structure. A semantic sidebar stylesheet should target optimized
component structure, not the backwards-compatible DOM, unless the lab is
explicitly testing a diagnostic bridge.

## Invariants

These rules apply to both levels.

- Product concepts get stable attributes. Generated classes, generated IDs,
  SVG paths, visible text, and child indexes are not public API.
- Hooks identify concepts; they do not by themselves change component behavior.
  If Kagi wants Custom CSS authors to move a component safely, the component
  contract must expose the relevant structure or Kagi must provide a native
  layout mode.
- No-JS behavior stays first-class. A user must be able to search, change
  filters, open result links, and use server-backed actions without JavaScript.
- Standard HTML wins where it can carry behavior: `form`, `input`, `button`,
  `a`, `details`, `summary`, `dialog`, `aria-current`, `aria-expanded`,
  `hidden`, `disabled`, and `open`.
- JavaScript may enhance controls, but it should not be required to discover
  what a control means.
- Custom CSS targets concepts and states, not Kagi's private implementation.
- Unknown contract values must be tolerated. New result types, widgets, and
  actions should not break generic styling.

## Extension Rules

Kagi search results change over time, so the contract must make new features
cheap to add.

Use these rules before adding a new hook:

1. If the element is a page region, expose a layout slot.
2. If it is a repeated result-like item, expose a result or card hook.
3. If it is a module around results, expose a widget hook.
4. If it performs an action, expose an action hook.
5. If it opens a popup, expose trigger, panel, and state hooks.
6. If it is purely internal implementation, do not expose it.

Values should be lower-kebab-case and product-authored:

```html
<section data-kagi-widget="related-searches">...</section>
<article data-kagi-result data-kagi-result-type="organic">...</article>
<button data-kagi-action="summarize">Quick Summary</button>
```

Consumers must treat values as open sets:

```css
/* Good: generic result styling survives new result types. */
[data-kagi-result] {
  margin-block: 0 18px;
}

/* Fine: targeted styling for one known type. */
[data-kagi-result-type="forum"] [data-kagi-result-title-link] {
  font-weight: 650;
}

/* Avoid: exhaustive assumptions that fail when Kagi adds a new type. */
[data-kagi-result-type="organic"],
[data-kagi-result-type="forum"],
[data-kagi-result-type="news"] {
  /* This misses future result types. */
}
```

## Page Contract

The page root identifies the product surface, result mode, render path, and
contract family.

```html
<body
  data-kagi-contract="search-dom-v0"
  data-kagi-surface="search"
  data-kagi-result-mode="web"
  data-kagi-renderer="enhanced"
>
  ...
</body>
```

Recommended attributes:

| Attribute               | Owner  | Example values                    | Purpose                                           |
| ----------------------- | ------ | --------------------------------- | ------------------------------------------------- |
| `data-kagi-contract`    | `body` | `search-dom-v0`                   | Names the contract family used by the page.       |
| `data-kagi-surface`     | `body` | `search`, `home`                  | Identifies the product surface.                   |
| `data-kagi-result-mode` | `body` | `web`, `images`, `videos`, `news` | Identifies the active result mode.                |
| `data-kagi-renderer`    | `body` | `enhanced`, `basic`               | Distinguishes JS-enhanced and basic/no-JS output. |

The sidebar POC should target:

```css
body[data-kagi-surface="search"][data-kagi-result-mode="web"] {
  /* Web search only. */
}
```

## Layout Contract

Kagi should expose layout slots and variables so Custom CSS can move or reserve
space without targeting private page internals.

```html
<header data-kagi-layout-slot="app-header">...</header>
<main data-kagi-layout-slot="result-page">
  <section data-kagi-layout-slot="search-controls" data-kagi-filter-panel>
    ...
  </section>
  <section data-kagi-layout-slot="result-list" data-kagi-results>...</section>
</main>
```

Recommended slots:

| Slot              | Purpose                               |
| ----------------- | ------------------------------------- |
| `app-header`      | Persistent Kagi app header.           |
| `search-header`   | Query input and mode navigation area. |
| `search-controls` | Filter panel or toolbar.              |
| `result-page`     | Main search results page container.   |
| `result-list`     | Ordered result stream.                |
| `side-panel`      | Optional side content when present.   |

Recommended variables:

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

Kagi's own CSS should consume these variables. Custom CSS can then request a
sidebar by setting variables instead of rewriting header and result padding.

## Navigation Contract

Result-mode navigation should expose the nav container and each mode link.

```html
<nav data-kagi-result-nav>
  <a data-kagi-result-mode-link="web" aria-current="page" href="/search?q=test">
    All
  </a>
  <a data-kagi-result-mode-link="images" href="/images?q=test">Images</a>
</nav>
```

Rules:

- Use `aria-current="page"` for the active result mode.
- Link text can change without changing the mode value.
- Mode values are open-ended. Custom CSS should handle unknown mode links as
  normal navigation items.

## Search Form Contract

The main query form should expose the form, input, and submit controls.

```html
<form data-kagi-search-form action="/search" method="get" role="search">
  <input
    data-kagi-search-input
    type="search"
    name="q"
    value="kagi css selectors"
  />
  <button data-kagi-search-submit type="submit">Search</button>
</form>
```

Recommended hooks:

| Hook                      | Purpose                                                      |
| ------------------------- | ------------------------------------------------------------ |
| `data-kagi-search-form`   | Main query form.                                             |
| `data-kagi-search-input`  | User query input.                                            |
| `data-kagi-search-submit` | Query submit control.                                        |
| `data-kagi-search-action` | Secondary search action, such as voice or clear, if present. |

## Filter Contract

Filters are ordinary GET controls first. Kagi may enhance them with richer
client behavior, but the submitted state should be visible in standard form
fields, button names, button values, or links.

In backwards-compatible markup, these hooks may be added to the current
dropdown DOM as identifiers only. In optimized markup, they should describe the
actual component anatomy. For a Region filter, that means the trigger, recent
preview, search field, scrollable list, option rows, active state, clear action,
and popover sizing are part of the contract rather than side effects of private
dropdown markup.

```html
<section data-kagi-filter-panel data-kagi-layout-slot="search-controls">
  <form data-kagi-filter-form action="/search" method="get">
    <input type="hidden" name="q" value="kagi css selectors" />

    <section
      data-kagi-filter="time"
      data-kagi-filter-kind="single-select"
      data-kagi-promotable="true"
    >
      <details data-kagi-filter-menu>
        <summary data-kagi-filter-trigger aria-expanded="false">Time</summary>

        <div data-kagi-filter-options>
          <button
            type="submit"
            name="dr"
            value=""
            data-kagi-filter-option
            aria-current="true"
          >
            All
          </button>
          <button type="submit" name="dr" value="2" data-kagi-filter-option>
            Past Week
          </button>
        </div>
      </details>
    </section>
  </form>
</section>
```

Filter hooks:

| Hook                       | Owner                     | Purpose                                                                           |
| -------------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| `data-kagi-filter-panel`   | Filter panel container    | The whole control surface.                                                        |
| `data-kagi-filter-form`    | Form                      | Shared GET state for filter submissions.                                          |
| `data-kagi-filter`         | Filter group              | Stable product identity, such as `time`, `region`, `sort`, `matching`, or `lens`. |
| `data-kagi-filter-kind`    | Filter group              | Interaction model, such as `single-select`, `multi-select`, `range`, or `action`. |
| `data-kagi-filter-menu`    | Disclosure wrapper        | Popup/disclosure owner when the filter has one.                                   |
| `data-kagi-filter-trigger` | Button, label, or summary | Visible control that opens or identifies the filter.                              |
| `data-kagi-filter-options` | Options container         | Full option set.                                                                  |
| `data-kagi-filter-preview` | Preview container         | Promoted subset visible outside the popup.                                        |
| `data-kagi-filter-option`  | Link or form control      | Selectable option.                                                                |
| `data-kagi-filter-section` | Option subgroup           | Subsections such as sort field and sort direction.                                |
| `data-kagi-filter-search`  | Search input              | Local filter search, such as region search.                                       |
| `data-kagi-promotable`     | Filter group              | Marks filters whose options can be promoted into compact layouts.                 |

State rules:

- Selected options use `aria-current="true"` when the selection behaves like a
  navigation state.
- Toggles use real checkbox, button, or form state where possible.
- Popup state should use native `details[open]`, `aria-expanded`, and/or
  `data-state="open|closed"` when Kagi can keep that value synchronized.
- Hidden options use `hidden` when they should not participate in layout or
  accessibility.

Optimized filter requirement:

```txt
Every filter option must either:
  submit a GET form,
  navigate with an href,
  or be an enhanced control with a no-JS fallback.
```

## Results Contract

Every result-like item should have a result owner and stable sub-hooks for the
parts users commonly style.

```html
<article data-kagi-result data-kagi-result-type="organic">
  <h3 data-kagi-result-title>
    <a data-kagi-result-title-link href="https://example.com">
      Example result
    </a>
  </h3>

  <a data-kagi-result-url href="https://example.com"> example.com/path </a>

  <p data-kagi-result-snippet>Result description text.</p>

  <div data-kagi-result-metadata>...</div>

  <div data-kagi-result-actions>
    <button data-kagi-action="summarize">Quick Summary</button>
  </div>
</article>
```

Result hooks:

| Hook                            | Purpose                                                |
| ------------------------------- | ------------------------------------------------------ |
| `data-kagi-results`             | The result stream container.                           |
| `data-kagi-result`              | One result-like item.                                  |
| `data-kagi-result-type`         | Open-ended result type.                                |
| `data-kagi-result-title`        | Title wrapper.                                         |
| `data-kagi-result-title-link`   | Primary result link.                                   |
| `data-kagi-result-url`          | Displayed URL or source path.                          |
| `data-kagi-result-snippet`      | Description or snippet text.                           |
| `data-kagi-result-metadata`     | Dates, source details, and auxiliary metadata.         |
| `data-kagi-result-actions`      | Actions associated with the result.                    |
| `data-kagi-result-rank-control` | Ranking or personalization controls.                   |
| `data-kagi-ai-label`            | Label marking AI-generated or AI-related result state. |

Result type values are open-ended. Suggested initial values:

```txt
organic
group
forum
news
video
image
podcast
documentation
code
discussion
answer
```

Kagi does not need to classify every result perfectly at first. The important
part is that generic result styling can use `[data-kagi-result]`, while specific
modules can opt into more precise values over time.

## Widget Contract

Widgets are result-page modules that are not a single ordinary result. Examples
include quick answers, related searches, grouped modules, weather, dictionary,
image packs, video packs, or future Kagi features.

```html
<section data-kagi-widget="quick-answer">
  <header data-kagi-widget-header>
    <h2 data-kagi-widget-title>Quick Answer</h2>
  </header>
  <div data-kagi-widget-body>...</div>
  <div data-kagi-widget-actions>...</div>
</section>
```

Widget hooks:

| Hook                       | Purpose                     |
| -------------------------- | --------------------------- |
| `data-kagi-widget`         | Open-ended widget identity. |
| `data-kagi-widget-header`  | Widget heading area.        |
| `data-kagi-widget-title`   | Widget title.               |
| `data-kagi-widget-body`    | Main widget content.        |
| `data-kagi-widget-actions` | Widget-level actions.       |

New features should usually start as widgets unless they are clearly one result
item or one action.

## Action Contract

Actions should expose what they do, independent of whether the control is an
anchor, button, menu item, or form submit.

CSS should scope action styling by container or explicit action value. A broad
`[data-kagi-action]` selector is too coarse because the same contract covers
sidebar buttons, result menu items, ranking badges, and future result controls.

```html
<button data-kagi-action="summarize" type="button">Quick Summary</button>
<a data-kagi-action="web-archive" href="https://web.archive.org/...">
  Open page in Web Archive
</a>
<button data-kagi-action="rank-raise" name="rank" value="raise" type="submit">
  Raise
</button>
```

Suggested initial action values:

```txt
advanced-search
clear-filters
summarize
discuss
web-archive
more-from-site
remove-site
rank-raise
rank-lower
rank-block
rank-pin
open
copy
share
```

Rules:

- Use `a[href]` for navigation.
- Use `button[type="submit"]` inside GET or POST forms for server-backed
  actions.
- Use `button[type="button"]` for JS-only enhancements only when a no-JS path is
  not needed or is present elsewhere.
- Add action values over time instead of exposing private menu classes.

## Popover Contract

Menus, dropdowns, and popovers should expose the same conceptual parts even if
Kagi uses different internal implementations.

```html
<details data-kagi-popover data-kagi-action-menu>
  <summary data-kagi-popover-trigger aria-expanded="false">More</summary>
  <div data-kagi-popover-panel>
    <a data-kagi-action="more-from-site" href="/search?...">More results</a>
  </div>
</details>
```

Popover hooks:

| Hook                        | Purpose                       |
| --------------------------- | ----------------------------- |
| `data-kagi-popover`         | Disclosure or popup owner.    |
| `data-kagi-popover-trigger` | Control that opens the popup. |
| `data-kagi-popover-panel`   | Popup content.                |
| `data-kagi-action-menu`     | Popup is an action menu.      |

State can be expressed with `details[open]`, `aria-expanded`, `popover`,
`data-state`, or the browser primitive Kagi chooses. Custom CSS should not need
to know whether the old implementation used checkbox toggles or private
positioning classes.

## Optimized Web Search Example

This is not a complete page. It shows how the pieces fit together.

```html
<body
  data-kagi-contract="search-dom-v0"
  data-kagi-surface="search"
  data-kagi-result-mode="web"
  data-kagi-renderer="basic"
>
  <header data-kagi-layout-slot="app-header">
    <form
      data-kagi-search-form
      action="/html/search"
      method="get"
      role="search"
    >
      <input
        data-kagi-search-input
        type="search"
        name="q"
        value="kagi css selectors"
      />
      <button data-kagi-search-submit type="submit">Search</button>
    </form>

    <nav data-kagi-result-nav>
      <a
        data-kagi-result-mode-link="web"
        aria-current="page"
        href="/html/search?q=kagi+css+selectors"
        >All</a
      >
      <a data-kagi-result-mode-link="images" href="/images?q=kagi+css+selectors"
        >Images</a
      >
    </nav>
  </header>

  <main data-kagi-layout-slot="result-page">
    <section data-kagi-filter-panel data-kagi-layout-slot="search-controls">
      <form data-kagi-filter-form action="/html/search" method="get">
        <input type="hidden" name="q" value="kagi css selectors" />
        <section
          data-kagi-filter="matching"
          data-kagi-filter-kind="multi-select"
        >
          <button
            type="submit"
            name="verbatim"
            value="1"
            data-kagi-filter-option
          >
            Verbatim
          </button>
          <button
            type="submit"
            name="personalized"
            value="0"
            data-kagi-filter-option
            aria-current="true"
          >
            Personalized
          </button>
        </section>
      </form>
    </section>

    <section data-kagi-results data-kagi-layout-slot="result-list">
      <article data-kagi-result data-kagi-result-type="organic">
        <h3 data-kagi-result-title>
          <a data-kagi-result-title-link href="https://example.com">Example</a>
        </h3>
        <a data-kagi-result-url href="https://example.com">example.com</a>
        <p data-kagi-result-snippet>Snippet text.</p>
        <div data-kagi-result-actions>
          <a data-kagi-action="web-archive" href="https://web.archive.org/...">
            Open page in Web Archive
          </a>
        </div>
      </article>
    </section>
  </main>
</body>
```

## Anti-Contract

These are not stable public hooks:

- `._0_*`, `.__sri-*`, `.sri-group`, `.dd-list`, `.dd-toggle`, and generated
  implementation classes.
- Hard-coded control IDs such as `#dd_toggle_r`.
- Exact child indexes, sibling order, or deep SVG paths.
- Visible text such as `Past Week` or `Quick Summary`.
- Popup internals such as checkbox-driven open state.
- Class names that exist only to support one compiled stylesheet.

## Fixture Lab Success Criteria

The fixture lab should prove two different jobs without blending them.

Backwards-compatible fixtures:

- Add contract hooks without removing current private selectors.
- Keep selector match reports stable for current Custom CSS.
- Show zero backwards-compatible regressions.
- Prove existing functional Custom CSS, such as the sidebar release CSS, still
  works after additive hooks.

Optimized fixtures:

- Rewrite high-impact filter controls into semantic no-JS controls, starting
  with one honest Region component before a full sidebar.
- Normalize result, widget, action, and popover hooks across the web search
  page.
- Preserve runtime scripts for JS-enhanced captures when the source capture
  includes them, so opened popups can be tested through real interaction.
- Verify JS-enhanced popovers by clicking the real result shield badge and
  result action menu controls, not by generating forced open-state HTML.
- Reduce private IDs, private classes, structural selectors, and repeated full
  URLs in standard output.
- Allow semantic Custom CSS to target concepts such as filters, results, and
  actions without targeting old internals.
- Keep `/search` and `/html/search` behavior equivalent for search and filters.

`backwards-compatible + semantic sidebar CSS` is not a required success case. If
generated, it should be labeled as a diagnostic bridge because it asks one
stylesheet to target both current dropdown internals and future component
structure.

Measurement should report both the migration story and the optimized payoff:

```txt
current release CSS against original fixtures
current release CSS against backwards-compatible fixtures
semantic CSS against optimized fixtures
standard HTML bytes before and after optimized rewrite
private selector token count
structural selector count
no-JS behavior checks
```
