# Appendix: Real-World Kagi Custom CSS Cases

Date: July 5, 2026
Status: Supporting appendix for
`making-kagi-simpler-smaller-easier-to-customize.md`
Audience: Kagi engineers, designers, and frontend maintainers.

This appendix summarizes real Custom CSS examples linked from Kagi's Custom CSS
post and docs. It supports the main proposal by showing where semantic hooks
would simplify existing user CSS, where they would not, and what would break
during a markup refactor.

## Scope

Kagi's docs describe Custom CSS as applying to search and landing pages, not to
Settings pages. Some community themes also target Assistant. This appendix
therefore avoids Settings and focuses on search, results, landing, and adjacent
surfaces where real examples exist.

Sources reviewed:

- Kagi Custom CSS post: https://blog.kagi.com/tips/custom-css
- Kagi Custom CSS docs: https://help.kagi.com/kagi/features/custom-css.html
- Kagi Appearance docs: https://help.kagi.com/kagi/settings/appearance.html
- Kagi Condensed: https://github.com/jotslo/kagi-condensed-theme
- Kagi Google-Style Theme: https://github.com/shmublu/kagi-google-theme
- Kagi Plus: https://github.com/cameronpcampbell/kagi-plus
- Kagi Darker: https://github.com/realrogue/kagi-darker
- Faded Slop: https://gist.github.com/andy0130tw/cf7ea286a19417ab1a9a2de074c77cd6
- High Contrast Purple for Low Vision:
  https://gist.github.com/veroniiiica/6291da12d12d69a2f14f6cd9e3ae51fd
- Gruber Custom CSS:
  https://gist.github.com/gruber/a0f9d95489b723da0817120c936383ca
- Old-theme/underline tweak:
  https://gist.github.com/slaughtr/17564d9f4aac7f3b20dc1b604e155aff

## What The Examples Show

The examples are not only aesthetic themes. They cover real workflow and
accessibility preferences:

- More results on screen.
- Less visual clutter.
- Stronger contrast and focus indicators for low vision.
- Familiar search-result layouts.
- Hidden AI features or visually demoted AI-labeled results.
- Cleaner result titles, URLs, snippets, metadata, widgets, dropdowns, and
  search inputs.

The strongest pattern is repeated fallback selectors. Users often write several
selectors for one product concept because Kagi exposes different private classes
for web results, grouped results, news results, Wikipedia widgets, podcasts, and
videos.

## Case Summary

| Example | What it does | Current selector burden | How semantic hooks help | What would not simplify |
| --- | --- | --- | --- | --- |
| Kagi Condensed | Reduces spacing across Search, Home, News, Podcasts, and mobile; hides some modules | Uses `.__sri-*`, `.sri-group`, `.newsResultItem`, `.podcast_result`, `#web_archive`, `._0_app-data-top-panel` | Result, widget, and surface hooks replace private class piles | General spacing values still need CSS |
| Google-style Kagi | Recreates a Google-like result layout | Large CSS near the Custom CSS character limit; many `!important`s, private IDs, `:has()` selectors, and private layout selectors | Page slots, result hooks, nav hooks, and layout variables remove much of the scaffolding | A pixel-matched full reskin remains large |
| Kagi Plus | Restyles search inputs, related items, dropdowns, widgets, toggle switches, and Search Options | Targets `_0_k_ui_dropdown_data_list`, `.quick-settings`, `.related-items`, `.widgetItem`, `.search-input-container`, and private theme wrappers | Stable hooks for dropdowns, search input, widgets, related items, and actions reduce selector guessing | Browser-specific rounded-corner effects remain theme CSS |
| Kagi Darker | Full dark theme for Search and Assistant with result cards, widgets, and responsive behavior | Targets widgets, dropdowns, filters, results, summaries, Assistant pieces, and many private classes; README notes the theme needs rewrites as Kagi evolves | Stable result/widget/Assistant/action hooks would reduce ongoing breakage | Surface-specific design polish still needs substantial CSS |
| High Contrast Purple | Low-vision theme with large text, high contrast, stronger focus outlines, styled results and widgets | Broad CSS works well, but result title, URL, snippet, mode buttons, widgets, logo, and submit buttons need private selectors | Result, widget, mode, action, and logo/icon color tokens reduce fallback selectors and `!important` | Whole-page font, color, and spacing rules are already simple |
| Faded Slop | Visually demotes AI-labeled results | Uses `.search-result:has(.ai-stain-icon)` and sibling selectors to affect grouped results | `data-kagi-ai-label` on the result container removes the `:has()` and sibling dependency | The desired visual treatment is still custom |
| Gruber CSS | Small typography, URL, and border tweaks | Mostly uses existing CSS variables, with a few `.__sri-*` selectors | URL/title hooks clean up the private selectors | Token-based tweaks are already concise |
| Official docs snippets | Remove underlines, hide Quick Search, hide answer boxes | Some examples need separate selectors for web, grouped, news, and Wikipedia links | A single title-link hook and stable widget/action hooks make these examples easier to document | Simple one-line hides are more stable, not much shorter |

## Selector Patterns That Would Simplify

### Result Titles

Current examples often need separate selectors:

```css
.__sri_title_link._0_sri_title_link._0_URL,
.__srgi-title a,
.newsResultItem .newsResultHeader .newsResultTitle a._0_TITLE,
.wikipediaResult a {
  border-bottom: none;
}
```

With semantic hooks:

```css
[data-kagi-result-title-link] {
  border-bottom: none;
}
```

### Result URLs And Snippets

Current examples target several private URL and snippet shapes:

```css
.__sri_url,
.result-url,
._0_url,
.url,
.sri-desc,
.__sri_desc,
.__sri-desc,
._0_sri_desc {
  color: inherit;
}
```

With semantic hooks:

```css
[data-kagi-result-url],
[data-kagi-result-snippet] {
  color: inherit;
}
```

### AI-Labeled Results

Current example:

```css
.theme_dark .search-result:has(.ai-stain-icon),
.theme_dark .search-result:has(.ai-stain-icon) + .sr-group {
  --search-result-title: #87858080;
}
```

With semantic hooks:

```css
.theme_dark [data-kagi-result][data-kagi-ai-label] {
  --search-result-title: #87858080;
}
```

### Widgets And Quick Actions

Current examples target private or implementation-specific names:

```css
.searchResultAnswers,
.quick-search-btn,
#web_archive,
.weather_day,
.videoResultItem .videoResultRight .videoResultDesc {
  display: none;
}
```

With semantic hooks:

```css
[data-kagi-widget="quick-answer"],
[data-kagi-action="quick-search"],
[data-kagi-widget="web-archive"],
[data-kagi-widget="weather"],
[data-kagi-result-type="video"] [data-kagi-result-snippet] {
  display: none;
}
```

## Cases That Would Not Get Much Simpler

Semantic markup is not a replacement for theme tokens. These cases may become
more stable, but not much shorter:

- Whole-page font and color rules such as `body { font-family: ... }`.
- CSS variable overrides that already target documented or stable Kagi tokens.
- Simple one-line hides, where the gain is durability rather than length.
- Full reskins that intentionally replace Kagi's visual language.
- Logo and SVG path recoloring, unless Kagi exposes logo/icon color tokens.
- Structural preferences such as "hide every grouped result after the fourth";
  those need explicit product hooks if Kagi wants to support them.

## Existing CSS Likely To Break

A simplified HTML proposal would break many examples if it removed old selectors
without a transition. Common breakpoints:

| Current selector family | Why it breaks | Candidate hook |
| --- | --- | --- |
| `.__sri-*`, `.sri-*`, `.sr-group`, `.search-result` | Private result implementation classes | `data-kagi-result`, `data-kagi-result-*` |
| `.newsResultItem`, `.videoResultItem`, `.podcast_result` | Mode-specific result wrappers | `data-kagi-result-type="news|video|podcast"` |
| `.wikipediaResult`, `.instant-answer`, `.searchResultAnswers` | Widget-specific private classes | `data-kagi-widget="wikipedia|quick-answer"` |
| `.quick-search-btn`, `._0_summarize_link`, `._0_discuss_document_btn` | Private action classes | `data-kagi-action="quick-search|summarize|discuss"` |
| `#web_archive`, `#myip`, `#conversions` | Widget IDs | `data-kagi-widget="web-archive|my-ip|conversions"` |
| `._0_filters-panel`, `#sidebarForm`, `#dd_toggle_*` | Filter implementation details | `data-kagi-filter-panel`, `data-kagi-filter` |
| `#_0_app_content`, `.top-panel-box`, `.m-h .m-h-i` | Page layout internals | Layout variables and named slots |
| Deep SVG selectors and `:nth-child()` paths | Structural coupling to current SVG/DOM order | Theme tokens or manual migration |

## Migration Strategy

The practical migration path is additive first:

1. Add semantic hooks to current markup while old selectors still work.
2. Publish a mapping table like the one above.
3. Keep short-term legacy aliases for common concepts where possible.
4. Provide a best-effort selector migrator for direct replacements.
5. Flag selectors that cannot be migrated safely.

Safe mechanical rewrites:

| Old selector | New selector |
| --- | --- |
| `.quick-search-btn` | `[data-kagi-action="quick-search"]` |
| `.searchResultAnswers` | `[data-kagi-widget="quick-answer"]` |
| `#web_archive` | `[data-kagi-widget="web-archive"]` |
| `.newsResultItem` | `[data-kagi-result-type="news"]` |
| `.videoResultItem` | `[data-kagi-result-type="video"]` |
| `.podcast_result` | `[data-kagi-result-type="podcast"]` |
| `#sidebarForm` | `[data-kagi-filter-form]` |
| `._0_filters-panel` | `[data-kagi-filter-panel]` |

Manual-review rewrites:

- Selectors with `:nth-child()` or `:nth-of-type()`.
- Selectors that depend on adjacent siblings, such as result grouping hacks.
- Selectors that target SVG paths or icon internals.
- Selectors that target private layout containers rather than product concepts.
- Selectors that mix several unrelated concepts in one rule.

## Recommendation For The Main Proposal

The main proposal should stay centered on search filters because that is the
measured case study. The community examples justify broadening the semantic
contract to include results, widgets, actions, and page slots. They also justify
a migration plan: existing Custom CSS is evidence of demand, but also evidence
that a cleaner HTML contract cannot be shipped as an invisible implementation
detail.
