# Kagi Semantic Hooks and Components

Date: July 6, 2026
Status: Draft proposal
Audience: Kagi engineers, designers, frontend maintainers, and Custom CSS authors.

One sentence: Kagi can make search easier to theme, customize, and maintain by
exposing stable semantic hooks and semantic component contracts for page
identity, filters, results, widgets, actions, popovers, and layout.

This is not a request for Kagi to ship a sidebar. The sidebar is a case study:
it shows that useful Custom CSS is possible today, but it also shows where
outside CSS has to reverse-engineer private markup and generated CSS.

## Summary

Kagi already supports Custom CSS, and users use it for more than color changes.
Real themes change density, readability, visibility, result emphasis, widget
treatment, and workflow surfaces. That is a strength. The problem is that many
useful changes have to target generated classes, private IDs, child positions,
visible text, or implementation-specific dropdown structure.

The practical proposal is small:

- Add stable `data-kagi-*` hooks for public product concepts.
- Give common UI components stable anatomy: trigger, panel, list, option,
  preview, action, and state.
- Keep JS-enhanced search and basic/no-JS search on the same public contract.
- Let Kagi-owned CSS and user Custom CSS both target those contracts.

This would make theming easier, but the bigger gain is maintainability. A theme
that targets "result title" or "quick answer widget" should not break because
Kagi renamed a generated class or changed wrapper markup. Kagi should be free to
refactor internals while preserving the public contract.

## What The Outside Experiments Showed

We experimented with simplifying Kagi HTML and CSS from captured generated
output. That was useful for diagnosis, but it is not a realistic path to a clean
frontend contract.

Generated output only shows the final shape. It does not show the source
components, state model, accessibility decisions, or the boundary between
product behavior and incidental implementation. An outside rewrite can add
attributes or rearrange markup, but it quickly becomes another compatibility
layer over private structure.

The better conclusion is narrower and more actionable: use the experiments to
identify selector pain, then define the semantic hooks and component contracts
inside Kagi's frontend source.

## Core Principle

Custom CSS should target concepts and states, not implementation details.

Good targets:

- Page surface: search, home, or another product surface.
- Result mode: web, images, videos, news, or another mode.
- Component identity: filter, result, widget, action, popover.
- Component part: trigger, panel, list, option, title, URL, snippet.
- State: active, expanded, selected, hidden, disabled.

Poor public targets:

- Generated classes and private IDs.
- Deep wrapper chains.
- SVG path structure.
- Child indexes such as `:nth-child()`.
- Visible text used as a selector.
- Popup positioning or hidden-state implementation details.

## Contract Layers

Semantic hooks and semantic components solve different problems.

Semantic hooks identify what an element means. They can be added to today's DOM
without changing layout or behavior:

```html
<body data-kagi-surface="search" data-kagi-result-mode="web">
  <main data-kagi-results>
    <article data-kagi-result data-kagi-result-type="organic">
      <a data-kagi-result-title-link href="https://example.com">Example</a>
    </article>
  </main>
</body>
```

Semantic components define stable anatomy for controls Kagi expects people to
style or move:

```html
<section data-kagi-filter="region" data-kagi-filter-kind="single-select">
  <button data-kagi-filter-trigger aria-expanded="false">Region</button>
  <div data-kagi-filter-preview>...</div>
  <div data-kagi-filter-options data-kagi-popover-panel>...</div>
</section>
```

Hooks make existing theming less fragile. Component contracts are what make
larger layout changes maintainable, because the CSS can style known parts
instead of undoing private dropdown behavior.

Native layout modes are the product-owned layer above both. If Kagi wants to
support a filter sidebar, compact toolbar, or other major placement change, that
mode should eventually be a Kagi layout option or documented layout contract,
not a pile of external CSS that shifts headers and reverses hidden popovers.

## Recommended Public Hooks

The first hook set should be small, stable, and open-ended.

Page:

- `data-kagi-contract="search-dom-v0"`
- `data-kagi-surface="search"`
- `data-kagi-result-mode="web"`
- `data-kagi-renderer="enhanced"` or `data-kagi-renderer="basic"`

Layout:

- `data-kagi-layout-slot="app-header"`
- `data-kagi-layout-slot="search-controls"`
- `data-kagi-layout-slot="result-list"`
- `data-kagi-layout-slot="side-panel"`

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
- `data-kagi-filter-preview`
- `data-kagi-filter-options`
- `data-kagi-filter-option`
- `data-kagi-filter-search`
- `data-kagi-filter-section`

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
`aria-expanded`, `hidden`, `disabled`, `checked`, `open`, and form state. If a
state cannot be represented cleanly with native attributes, a synchronized
`data-state` value is preferable to exposing private classes.

Hook values should be lower-kebab-case and open-ended. Custom CSS should handle
unknown result types, widgets, actions, and modes without assuming the set is
complete.

## Why This Helps Theming

Today, a theme often needs several selectors for one product concept. "Result
title" may mean one selector for web results, another for grouped results,
another for news, and another for a widget. The theme works until a wrapper or
generated class changes.

With semantic hooks, the same change becomes straightforward:

```css
[data-kagi-result-title-link] {
  text-decoration-thickness: 0.08em;
}

[data-kagi-result-url],
[data-kagi-result-snippet] {
  color: var(--app-text);
}

[data-kagi-widget="quick-answer"] {
  border-inline-start: 3px solid var(--primary);
}
```

The CSS is not only shorter. It is easier for Kagi to support and easier for
theme authors to maintain. Kagi can change the internal DOM, split components,
or rename private classes without breaking Custom CSS that only depends on the
public hook.

## Why Hooks Alone Are Not Enough

Additive hooks help styling and theme maintenance, but they do not automatically
make layout-changing Custom CSS reliable.

Search filters are the clearest example. A CSS-only sidebar can work today
because Kagi's dropdown contents are present in the DOM. But the stylesheet has
to know how closed dropdowns are hidden, which wrappers hold fixed heights, how
each trigger is wired, which options can be promoted, and which page containers
must be shifted. Those are component anatomy questions, not selector-name
questions.

For durable customization, filters need a semantic component contract:

- Filter identity: time, region, sort, matching, lens.
- Trigger: the visible control that opens or identifies the filter.
- Preview: the subset safe to show outside the popup.
- Options: the full selectable list or form controls.
- Search: local filtering when a list is long.
- Action: clear, advanced search, or other command controls.
- State: active option, expanded popup, hidden option, disabled option.

Once Kagi owns that anatomy, Kagi CSS and user CSS can both style the component
without depending on private dropdown internals.

## No-JS Contract

The public contract should be shared by `/search` and `/html/search`. JavaScript
can enhance controls, but the underlying meaning should be visible in ordinary
HTML.

Preferred primitives:

- `form`, `input`, `select`, and `button` for submitted search state.
- `a[href]` for navigation.
- `details`, `summary`, `dialog`, or the browser `popover` primitive where they
  fit.
- `aria-current` and `aria-expanded` for state that users and CSS both need.

This keeps basic search first-class and prevents the JS-enhanced page from
becoming the only place where public semantics exist.

## Migration Path

Kagi does not need to replace everything at once.

1. Add page, mode, result, widget, action, and filter identity hooks to current
   markup.
2. Make `/search` and `/html/search` expose the same public hook names.
3. Publish a short Custom CSS selector map from common private selectors to
   semantic hooks.
4. Convert one high-impact component at a time, starting with search filters or
   result cards.
5. Add stable component anatomy for popovers and dropdowns before encouraging
   layout-changing Custom CSS.
6. Deprecate private-selector compatibility after Kagi has a documented
   replacement path.

Some existing Custom CSS will still break when private structure changes. That
is acceptable if the new contract is documented, additive at first, and clearly
better than preserving accidental selectors forever.

## Priorities

P0: Add page, surface, mode, and renderer hooks.

P1: Add result, title, URL, snippet, widget, and action hooks.

P2: Add filter identity, option, active-state, and popup-state hooks.

P3: Define semantic component anatomy for high-impact filters and popovers.

P4: Expose layout slots, layout variables, or native layout modes for supported
control placement.

P5: Document the Custom CSS contract and migration map.

## Non-Goals

- This proposal does not require Kagi to ship a sidebar.
- It does not require preserving every private selector used by existing Custom
  CSS.
- It does not ask outside generated-output rewrites to become the product plan.
- It does not require cutting-edge CSS as the core compatibility story.
- It does not cover Settings pages unless Kagi expands Custom CSS to that
  surface.

## Acceptance Criteria

- A Custom CSS author can target result titles, URLs, snippets, widgets,
  filters, actions, and popovers without private selectors.
- Active and expanded states are available through standard attributes or a
  documented state hook.
- JS-enhanced and basic/no-JS search expose the same public contract.
- Kagi can refactor internal classes and wrappers without breaking CSS written
  against the semantic contract.
- Layout-changing customization has a component or layout contract instead of
  relying on hidden dropdown internals.
