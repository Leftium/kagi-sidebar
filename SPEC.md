# Kagi Sidebar Specification

## Status

Current release: a CSS-only Kagi Custom CSS customization for desktop Kagi web
search. It optimizes for day-to-day web search while keeping the design clean
enough to share or expand later.

## References

- Kagi feedback proposal:
  https://kagifeedback.org/d/2934-show-search-result-settings-in-left-sidebar-reduce-clicks-and-save-vertical-space
- Kagi filtering documentation:
  https://help.kagi.com/kagi/features/filtering-results.html
- Kagi custom CSS documentation:
  https://help.kagi.com/kagi/features/custom-css.html
- Kagi Custom CSS settings:
  https://kagi.com/settings/custom_css
- Google Search Sidebar reference:
  https://github.com/mnghsn/google-search-sidebar

## Problem

Kagi's search result options are currently presented in a horizontal top toolbar.
This has a few practical costs:

- Common options can require two or more clicks to inspect or change.
- Available options are not visible until a menu is opened.
- Current state is harder to scan at a glance.
- The toolbar consumes vertical space above search results.
- On wide desktop layouts, useful horizontal space is left unused.

The goal is to make Kagi search options easier to discover, faster to change,
and easier to inspect by moving them into a compact left sidebar.

## Goals

- Show web search options in a vertical sidebar on sufficiently wide search
  result pages.
- Preserve Kagi's native search behavior, URLs, forms, links, and result
  rendering.
- Prefer a pure Kagi Custom CSS implementation when it is reliable.
- Allow a UserScript implementation when CSS-only selectors or layout hooks are
  too brittle.
- Keep the sidebar automatically enabled on desktop-width web search pages.
- Leave room for a future inline/sidebar toggle without designing that full
  preference system now.
- Use user-friendly wording in the UI, especially "Search Options" instead of
  "Facets".

## Non-Goals

- No browser extension package for the CSS release.
- No extension-store or userscript-registry distribution workflow.
- No support for Images, Videos, News, Podcasts, or Maps in this release.
- No redesign of Kagi result cards, ranking controls, or answer widgets.
- No replacement search backend or custom filter URL model unless moving native
  controls is impossible.
- No persistent account-level Kagi setting integration.

## Target Pages

This release supports Kagi web search result pages:

- `https://kagi.com/search?...`
- Only the standard web/all search mode.
- Logged-in pages are the primary target.
- Logged-out pages are best effort.

The sidebar must not apply to:

- Kagi settings pages.
- Kagi homepage or landing pages.
- Unsupported result modes, including Images, Videos, News, Podcasts, and Maps.
- Assistant, Translate, Summarizer, or other Kagi products.

## Search Options

The sidebar should include the options Kagi documents for filtering web search
results:

- Region.
- Order By.
- Sort direction when available or implied by the selected order.
- Time.
- Custom date range, using Kagi's native custom range behavior if available.
- Verbatim.
- Personalized results, if present and easy to target reliably.
- Clear or reset filters.

Other candidates to evaluate during DOM inventory:

- Lenses, if Kagi exposes the current lens as a search-page filter rather than a
  separate navigation concept.
- Search mode navigation, such as Web, Images, Videos, News, and Podcasts. This
  should stay outside this release unless it is structurally tied to the same
  toolbar.
- Quick Answer. This is an action/result feature, not a search option, so it
  should stay out of the sidebar.
- AI image filtering. This appears relevant to image search, not the web-search
  release.
- Safe search or family filtering, if Kagi exposes it as a per-search visible
  control. If it only exists in settings, do not add it.

## UX Requirements

### Layout

- The sidebar appears to the left of the main result column.
- The main result column shifts right only as much as needed for the sidebar.
- The sidebar width should start around 180-220px and be tuned against the live
  Kagi layout.
- The sidebar should be compact and utilitarian, not a large panel.
- The sidebar should not overlap search results, the search box, or Kagi account
  controls.
- On long result pages, the sidebar may either scroll with the page or use
  `position: sticky`; choose whichever behaves best with Kagi's header and
  result layout.

### Labeling

- Do not show a separate sidebar heading in the current CSS release. If future
  generated markup adds one, use "Search Options".
- Use concise group labels:
  - Region
  - Sort
  - Time
  - Matching
  - Reset
- Avoid internal jargon like "facets" in visible UI.

### Interaction

- Each visible option should be directly clickable when possible.
- Active values should be visually obvious without relying only on a checkmark.
- Long option lists, especially Region, should have a maximum height and
  internal scrolling.
- Custom date range should open Kagi's existing custom date UI or modal if one
  exists.
- Clear should use Kagi's existing clear/reset behavior.
- The sidebar should not trap focus or interfere with keyboard navigation.
- The existing horizontal controls may be hidden or visually minimized only when
  sidebar mode is active and working.

### Visual Style

- Match Kagi's current theme variables and typography where possible.
- Work in light and dark themes.
- Avoid heavy borders, strong backgrounds, and card-like styling.
- Use low visual weight for inactive options.
- Use Kagi's existing accent color or inherited link color for active options.
- Avoid checkboxes unless Kagi's native controls already require them.

## Responsive Behavior

Release breakpoints:

- `>= 1100px`: full sidebar enabled.
- `< 1100px`: sidebar disabled; Kagi's native horizontal controls remain
  visible.

The breakpoint should remain based on whether the sidebar can fit without
causing overlap, cramped result cards, or horizontal scrolling.

## Implementation Strategy

The current release uses the CSS-only track. Keep the UserScript track as
fallback guidance if Kagi markup changes make Custom CSS too brittle.

1. DOM inventory.
   - Inspect current Kagi web search result markup.
   - Identify stable selectors for the toolbar, menus, active states, and clear
     actions.
   - Compare normal searches, searches with active filters, custom time ranges,
     region changes, verbatim mode, and personalized toggles.
   - Confirm whether unsupported modes can be detected reliably.

2. CSS-only stylesheet.
   - Try moving/restyling existing Kagi controls with Kagi Custom CSS.
   - Avoid broad `nth-child` selectors unless there is no alternative.
   - Confirm styles do not leak into Images, News, or other tabs.
   - Confirm the result column can be shifted cleanly.

3. UserScript fallback.
   - If CSS-only is brittle, use a Tampermonkey-compatible UserScript.
   - Add stable `ksb-*` classes and wrappers.
   - Move native controls into the sidebar when possible.
   - Inject namespaced CSS for layout.
   - Avoid cloning controls unless moving them breaks Kagi behavior.

4. Polish and verification.
   - Tune spacing, breakpoints, active states, and scrolling.
   - Test light/dark themes and several filter combinations.
   - Document known limitations.

## CSS-Only Track

CSS-only remains the preferred outcome because Kagi supports Custom CSS on search
and landing pages.

Requirements:

- Must fit within Kagi's Custom CSS character limit.
- Must be recoverable with Kagi's `no_css` query parameter.
- Must not require JavaScript-generated controls.
- Must not style unsupported Kagi modes by accident.
- Must not depend on text content selectors that CSS cannot express reliably.
- Should prefer stable IDs/classes over positional selectors.

Likely CSS responsibilities:

- Display the existing option menus vertically.
- Hide menu trigger buttons when the menu contents are shown in the sidebar.
- Reset dropdown positioning so menu contents become static sidebar content.
- Shift the main result layout to make room for the sidebar.
- Style active menu items and hover states.
- Restore Kagi's normal layout below the chosen breakpoint.

Known risk: Kagi's current markup may not expose stable, mode-specific selectors.
If CSS requires fragile positional selectors or leaks into unsupported modes, use
the UserScript track.

## UserScript Track

The UserScript should be small and dependency-free.

### Matching

Initial match target:

```js
// @match https://kagi.com/search*
```

Runtime checks must still confirm the page is a standard web search result page
before applying the sidebar.

### DOM Rules

- Add a single root class such as `ksb-enabled` to `document.documentElement`.
- Create one sidebar container with `ksb-sidebar`.
- Move existing Kagi controls into the sidebar when doing so preserves behavior.
- Keep a placeholder so controls can be restored if the sidebar disables itself.
- Make the script idempotent so it can safely rerun after Kagi client-side
  navigation or dynamic updates.
- Use `MutationObserver` only if Kagi updates search controls without full page
  reloads.
- Disconnect or debounce observers to avoid unnecessary work.

### Privacy and Safety

- Do not send network requests.
- Do not collect or store search queries.
- Do not modify result links, snippets, ranking buttons, or personalization
  actions outside the search options area.
- Store only UI preferences in `localStorage` if a future toggle is added.
- Do not use top-level `await` in any browser-imported JavaScript module.

### Future Toggle Hook

The current stylesheet is always on at desktop widths. If a toggle is added
later:

- Label choices as "Sidebar Options" and "Inline Options" or similarly
  user-friendly wording.
- Store the preference in `localStorage`, for example
  `kagi-sidebar.layout = "sidebar" | "inline"`.
- Place the toggle near the existing options area or at the top of the sidebar.
- Keep "always on when wide enough" as the initial default.

## Accessibility Requirements

- Preserve native links, buttons, and form controls where possible.
- Do not remove keyboard focus outlines.
- Preserve readable contrast in light and dark themes.
- Active state should not rely on color alone; use font weight, underline,
  current marker text, or native selected state where practical.
- Sidebar heading should be a real text heading if the UserScript creates markup.
- If controls are moved, tab order should remain logical: search input, result
  mode navigation, search options, results.

## Acceptance Criteria

The release is acceptable when:

- A normal Kagi web search shows a left sidebar on desktop-width screens.
- Region, Order By, Time, Verbatim, and Clear work from the sidebar.
- Personalized results are included if reliably available.
- Active filter state is visible at a glance.
- Results remain readable and aligned after the main column shifts.
- Light and dark themes remain readable.
- Narrow screens cleanly return to Kagi's native horizontal controls.
- Unsupported modes do not receive broken sidebar styling.
- Removing the CSS or disabling the UserScript fully restores Kagi's native UI.

## Manual Verification Plan

Run the release against these scenarios:

- Basic search with no active filters.
- Region changed from default.
- Order changed from default.
- Time set to Past 24 Hours, Past Week, Past Month, and custom range.
- Verbatim enabled and disabled.
- Personalized results enabled and disabled, if available.
- Clear/reset from multiple active filters.
- Light theme.
- Dark theme.
- Wide desktop viewport.
- Narrow/mobile viewport.
- Images, News, Videos, and other unsupported modes.
- Logged-out page, if accessible.

## Risks

- Kagi may change class names or toolbar markup.
- CSS-only implementation may require brittle positional selectors.
- Moving controls may break behavior if Kagi relies on ancestor structure.
- Some controls may be rendered only after interaction.
- Logged-in and logged-out markup may differ.
- Browser-specific CSS behavior may affect sticky positioning or advanced
  selectors.

## Future Work

- Inline/sidebar toggle.
- User-configurable visible options.
- User-configurable option order.
- Support for Images, Videos, News, and Podcasts with mode-specific sidebars.
- Public README with installation instructions.
- Versioned UserScript release.
- Greasy Fork distribution.
- Browser extension packaging.
- Screenshots or visual regression checks.
