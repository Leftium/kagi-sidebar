# Kagi Semantic Hooks and Components

Custom CSS can be used for full workflow changes, not just colors: density,
readability, result emphasis, widget treatment, filter visibility, and filter
placement. That flexibility is welcome, but today many useful changes depend on
generated classes, private IDs, wrapper depth, visible text, and dropdown
internals.

Simple proposal: expose a small `data-kagi-*` contract for search. Semantic
hooks identify public product concepts. Semantic component contracts define the
stable parts of controls that users can style, hide, show, or move.

This is not a request for Kagi to ship a sidebar. The sidebar is only the case
study: Custom CSS can prototype useful layout changes today, but it has to
reverse-engineer private markup to do it.

## The Contract

Custom CSS should target concepts and states, not implementation details.

Good public targets:

- Page and mode: search, web results, images, videos, or news.
- Result anatomy: result, title, URL, snippet, metadata, and actions.
- Widget anatomy: widget, title, body, and actions.
- Filter anatomy: filter, trigger, value, options, section, search, and action.
- Popover anatomy: trigger, panel, list, option, and action menu.
- State: current, expanded, selected, hidden, disabled, and checked.

Poor public targets:

- Generated classes and private IDs.
- Deep wrapper chains.
- SVG path structure.
- Child indexes such as `:nth-child()`.
- Visible text used as a selector.
- Popup positioning or hidden-state implementation details.

Semantic hooks can be additive. They identify what an element means without
requiring a rewrite:

```html
<body data-kagi-surface="search" data-kagi-result-mode="web">
  <main data-kagi-results>
    <article data-kagi-result data-kagi-result-type="organic">
      <a data-kagi-result-title-link href="https://example.com">Example</a>
    </article>
  </main>
</body>
```

Kagi can still change the internal DOM, split components, rename generated
classes, and move wrappers. Custom CSS that only depends on the public contract
keeps working.

Semantic components are the next layer. They give stable anatomy to controls
that people reasonably want to style or move:

```html
<section data-kagi-filter="region" data-kagi-filter-kind="single-select">
  <button data-kagi-filter-trigger aria-expanded="false">
    <span data-kagi-filter-label>Region</span>
    <span data-kagi-filter-value>United States</span>
  </button>
  <div data-kagi-filter-options data-kagi-popover-panel>
    <div data-kagi-filter-section="recent">...</div>
  </div>
</section>
```

Hooks make selectors stable. Component contracts make larger layout changes
maintainable, because the CSS can style known parts instead of undoing private
dropdown behavior.

## Recommended Hooks

Start with a small search contract. These names are a suggested shape, not a
complete component spec.

Page:

- `data-kagi-surface="search"`
- `data-kagi-result-mode="web"`

Layout:

- `data-kagi-layout-slot="app-header"`
- `data-kagi-layout-slot="search-controls"`
- `data-kagi-layout-slot="result-list"`

Search:

- `data-kagi-search-form`
- `data-kagi-search-input`
- `data-kagi-search-submit`
- `data-kagi-search-action`

Filters:

- `data-kagi-filter-panel`
- `data-kagi-filter-form`
- `data-kagi-filter`, with values such as `time`, `region`, `sort`,
  `matching`, and `lens`
- `data-kagi-filter-kind`, with values such as `single-select`,
  `multi-select`, `range`, and `action`
- `data-kagi-filter-trigger`
- `data-kagi-filter-label`
- `data-kagi-filter-value`
- `data-kagi-filter-options`
- `data-kagi-filter-option`
- `data-kagi-filter-search`
- `data-kagi-filter-section`
- `data-kagi-filter-action`

Results:

- `data-kagi-results`
- `data-kagi-result`
- `data-kagi-result-type`
- `data-kagi-result-title`
- `data-kagi-result-title-link`
- `data-kagi-result-url`
- `data-kagi-result-snippet`
- `data-kagi-result-metadata`
- `data-kagi-result-actions`
- `data-kagi-ai-label`

Widgets and actions:

- `data-kagi-widget`
- `data-kagi-widget-title`
- `data-kagi-widget-body`
- `data-kagi-widget-actions`
- `data-kagi-action`

Popovers:

- `data-kagi-popover`
- `data-kagi-popover-trigger`
- `data-kagi-popover-panel`
- `data-kagi-action-menu`

State should use standard HTML and ARIA where possible: `aria-current`,
`aria-expanded`, `aria-selected`, `hidden`, `disabled`, `checked`, `open`, and
form state. If a state cannot be represented cleanly with native attributes, a
synchronized `data-state` value is better than exposing private classes.

Hook values should be lower-kebab-case and open-ended. Custom CSS should handle
unknown result types, widgets, actions, and modes without assuming the set is
complete.

## Why Components Matter

Additive hooks make themes less fragile, but they do not automatically make
layout-changing Custom CSS reliable.

Search filters are a good example. A CSS-only sidebar can work today
because Kagi's dropdown contents are present in the DOM. But the stylesheet has
to know how closed dropdowns are hidden, which wrappers hold fixed heights, how
each trigger is wired, which nodes are options, sections, search fields, or
actions, and which page containers are affected when controls move. Those are
component anatomy questions, not selector-name questions.

For durable customization, filters need a semantic component contract:

- Identity: time, region, sort, matching, lens.
- Trigger: the visible control that opens or identifies the filter.
- Value: the current selection or summary shown by the closed control.
- Options: the full selectable list or form controls.
- Section: a named group inside the panel, such as recent regions or custom
  date controls.
- Search: local filtering when a list is long.
- Action: clear, advanced search, or another command.
- State: active option, expanded popup, hidden option, disabled option.

Once Kagi owns that anatomy, Kagi CSS and user CSS can both target the same
component contract instead of depending on private dropdown internals.

## Keep Basic Search Aligned

The public contract should be shared by `/search` and `/html/search`.
JavaScript can enhance controls, but the underlying meaning should stay visible
in ordinary HTML.

Useful primitives:

- `form`, `input`, `select`, and `button` for submitted search state.
- `a[href]` for navigation.
- `details`, `summary`, `dialog`, or the browser `popover` primitive where they
  fit.
- `aria-current` and `aria-expanded` for state that users and CSS both need.

This keeps basic search first-class and prevents the JS-enhanced page from
becoming the only place where public semantics exist.

## Rollout

Kagi does not need to solve the whole contract at once.

1. Add page, surface, result, widget, action, and filter identity hooks to the
   current markup.
2. Make `/search` and `/html/search` expose the same public hook names.
3. Publish a short Custom CSS selector map from common private selectors to
   semantic hooks.
4. Define component anatomy for high-impact filters and popovers.
5. Add documented layout hooks for existing page regions only where Kagi wants
   to support placement changes.

Some existing Custom CSS will still break when private structure changes. That
is acceptable if the new contract is documented, additive at first, and clearly
better than preserving accidental selectors forever.

Success looks like this: a theme can target result titles, URLs, snippets,
widgets, filters, actions, and popovers without private selectors; active and
expanded states are available through standard attributes or documented state
hooks; and Kagi can refactor internal classes and wrappers without breaking CSS
written against the public contract.
