const controls = {
  captureOptions: document.querySelector("#capture-options"),
  htmlOptions: document.querySelector("#html-options"),
  cssOptions: document.querySelector("#css-options"),
  matrixLink: document.querySelector("#matrix-link"),
  summaryCards: document.querySelector("#summary-cards"),
  matrixRows: document.querySelector("#matrix-rows"),
};

const preferredSelection = {
  captureId: "search",
  htmlVariant: "original",
  cssSample: "sidebar",
  cssVersion: "original",
};

let generationSummary = null;
let compatibilitySummary = null;
let selectorInventory = { samples: [] };
let matrixManifest = {
  captures: [],
  combinations: [],
};
let state = { ...preferredSelection };

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function uniqueValues(items, getValue) {
  return [...new Set(items.map(getValue))];
}

function cssKey(sample, version) {
  return `${sample}::${version}`;
}

function parseCssKey(value) {
  const [sample, version] = value.split("::");

  return { sample, version };
}

function currentCombinations() {
  return matrixManifest.combinations ?? [];
}

function selectedCombination() {
  return currentCombinations().find(
    (item) =>
      item.captureId === state.captureId &&
      item.htmlVariant === state.htmlVariant &&
      item.cssSample === state.cssSample &&
      item.cssVersion === state.cssVersion,
  );
}

function applyCombination(combination) {
  if (!combination) {
    return;
  }

  state = {
    captureId: combination.captureId,
    htmlVariant: combination.htmlVariant,
    cssSample: combination.cssSample,
    cssVersion: combination.cssVersion,
  };
}

function preferredCombination(combinations) {
  return (
    combinations.find(
      (item) =>
        item.captureId === preferredSelection.captureId &&
        item.htmlVariant === preferredSelection.htmlVariant &&
        item.cssSample === preferredSelection.cssSample &&
        item.cssVersion === preferredSelection.cssVersion,
    ) ??
    combinations.find(
      (item) =>
        item.htmlVariant === preferredSelection.htmlVariant &&
        item.cssSample === preferredSelection.cssSample &&
        item.cssVersion === preferredSelection.cssVersion,
    ) ??
    combinations.find((item) => item.cssSample !== "none") ??
    combinations[0]
  );
}

function ensureValidState() {
  const combinations = currentCombinations();

  if (!combinations.length) {
    return;
  }

  if (!selectedCombination()) {
    applyCombination(
      preferredCombination(
        combinations.filter((item) => item.captureId === state.captureId),
      ) ?? preferredCombination(combinations),
    );
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load ${url}`);
  }

  return response.json();
}

function humanize(value) {
  const labels = {
    "backwards-compatible": "Backwards-compatible hooks",
    "backwards-compatible-preserved": "Backwards-compatible preserved",
    "backwards-compatible-regressions": "Backwards-compatible regressions",
    "html-search": "Basic HTML search",
    none: "No CSS",
    original: "Original",
    optimized: "Optimized",
    ready: "Ready",
    search: "JS search",
    semantic: "Semantic",
    sidebar: "Kagi Sidebar",
    "selector-inventory-only": "Selector inventory only",
    "waiting-for-captures": "Waiting for captures",
  };

  return labels[value] ?? String(value).replaceAll("-", " ");
}

function htmlVariantLabel(value) {
  if (value === "original") {
    return "Original capture";
  }

  return humanize(value);
}

function cssOptionLabel(option) {
  if (option.cssSample === "none") {
    return "No CSS";
  }

  const sampleName = option.cssSampleName || humanize(option.cssSample);

  return `${sampleName} ${humanize(option.cssVersion).toLowerCase()}`;
}

function formatBytes(bytes) {
  if (bytes == null) {
    return "Pending";
  }

  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1000 && unitIndex < units.length - 1) {
    size /= 1000;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDelta(bytes) {
  if (bytes == null || bytes === 0) {
    return "0 B";
  }

  const sign = bytes > 0 ? "+" : "-";

  return `${sign}${formatBytes(Math.abs(bytes))}`;
}

function statRow(label, value) {
  return `<span class="metric-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></span>`;
}

function renderEmpty(target, message) {
  target.className = "empty-state";
  target.innerHTML = escapeHtml(message);
}

function renderChoiceGroup({
  target,
  name,
  options,
  selectedValue,
  valueFor,
  labelFor,
  metaFor,
  onChange,
}) {
  if (!options.length) {
    renderEmpty(target, "Run pnpm generate.");
    return;
  }

  if (options.length < 3) {
    target.className = "choice-grid";
    target.innerHTML = options
      .map((option) => {
        const value = valueFor(option);
        const checked = value === selectedValue;

        return `<label class="choice-card${checked ? " is-selected" : ""}">
          <input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}"${checked ? " checked" : ""} />
          <span class="choice-title">${escapeHtml(labelFor(option))}</span>
          <span class="choice-meta">${metaFor(option)}</span>
        </label>`;
      })
      .join("");

    target.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => onChange(input.value));
    });
    return;
  }

  target.className = "select-row";
  target.innerHTML = `<select aria-label="${escapeHtml(name)}">
    ${options
      .map((option) => {
        const value = valueFor(option);

        return `<option value="${escapeHtml(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(labelFor(option))}</option>`;
      })
      .join("")}
  </select>`;

  target.querySelector("select").addEventListener("change", (event) => {
    onChange(event.target.value);
  });
}

function captureOptions() {
  return uniqueValues(currentCombinations(), (item) => item.captureId).map(
    (captureId) => {
      const capture = (matrixManifest.captures ?? []).find(
        (item) => item.id === captureId,
      );

      return {
        id: captureId,
        file: capture?.file ?? "",
      };
    },
  );
}

function htmlOptions() {
  return uniqueValues(
    currentCombinations().filter((item) => item.captureId === state.captureId),
    (item) => item.htmlVariant,
  ).map((htmlVariant) => ({ htmlVariant }));
}

function cssOptions() {
  const unique = new Map();

  for (const combination of currentCombinations()) {
    if (
      combination.captureId !== state.captureId ||
      combination.htmlVariant !== state.htmlVariant
    ) {
      continue;
    }

    unique.set(cssKey(combination.cssSample, combination.cssVersion), {
      cssSample: combination.cssSample,
      cssSampleName: combination.cssSampleName,
      cssVersion: combination.cssVersion,
      cssPath: combination.cssPath,
      cssBuiltIn: combination.cssBuiltIn,
    });
  }

  return [...unique.values()];
}

function htmlMetric(captureId, htmlVariant) {
  return (generationSummary?.generatedHtml ?? []).find(
    (item) => item.captureId === captureId && item.htmlVariant === htmlVariant,
  );
}

function cssMetric(cssSample, cssVersion) {
  if (cssSample === "none") {
    return {
      bytes: 0,
      lineCount: 0,
      selectorCount: 0,
      privateSelectorCount: 0,
      privateSelectorTokenCount: 0,
      structuralSelectorCount: 0,
      modernSelectorCount: 0,
    };
  }

  return (selectorInventory.samples ?? []).find(
    (item) => item.sampleId === cssSample && item.version === cssVersion,
  );
}

function selectedCaptureOriginalBytes() {
  return htmlMetric(state.captureId, "original")?.bytes;
}

function renderSummaryCards() {
  const combinations = currentCombinations();
  const status =
    compatibilitySummary?.status ?? generationSummary?.status ?? "Loading";
  const cards = [
    {
      label: "Status",
      value: humanize(status),
    },
    {
      label: "Captures",
      value: String(matrixManifest.captures?.length ?? 0),
    },
    {
      label: "HTML pages",
      value: String(generationSummary?.generatedHtml?.length ?? 0),
    },
    {
      label: "Matrix pages",
      value: String(
        generationSummary?.generatedMatrixPageCount ?? combinations.length,
      ),
    },
    {
      label: "CSS files",
      value: String(compatibilitySummary?.cssFileCount ?? 0),
    },
    {
      label: "Selectors",
      value: String(compatibilitySummary?.selectorCount ?? 0),
    },
    {
      label: "Kagi hooks",
      value: String(compatibilitySummary?.privateSelectorTokenCount ?? 0),
    },
    {
      label: "Regressions",
      value: String(
        compatibilitySummary?.backwardsCompatibleRegressionCount ?? 0,
      ),
    },
  ];

  controls.summaryCards.innerHTML = cards
    .map(
      (card) => `<article class="summary-card">
        <span class="summary-label">${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.value)}</strong>
      </article>`,
    )
    .join("");
}

function renderCaptureOptions() {
  renderChoiceGroup({
    target: controls.captureOptions,
    name: "capture",
    options: captureOptions(),
    selectedValue: state.captureId,
    valueFor: (option) => option.id,
    labelFor: (option) => humanize(option.id),
    metaFor: (option) =>
      [
        statRow("File", option.file),
        statRow("Pages", capturePageCount(option.id)),
      ].join(""),
    onChange: (value) => {
      state.captureId = value;
      applyCombination(
        preferredCombination(
          currentCombinations().filter((item) => item.captureId === value),
        ),
      );
      render();
    },
  });
}

function renderHtmlOptions() {
  const originalBytes = selectedCaptureOriginalBytes();

  renderChoiceGroup({
    target: controls.htmlOptions,
    name: "html variant",
    options: htmlOptions(),
    selectedValue: state.htmlVariant,
    valueFor: (option) => option.htmlVariant,
    labelFor: (option) => htmlVariantLabel(option.htmlVariant),
    metaFor: (option) => {
      const metric = htmlMetric(state.captureId, option.htmlVariant);
      const delta =
        metric?.bytes == null || originalBytes == null
          ? "Pending"
          : formatDelta(metric.bytes - originalBytes);

      return [
        statRow("Size", formatBytes(metric?.bytes)),
        statRow("Delta", delta),
        statRow("File", metric?.path ?? "Pending"),
      ].join("");
    },
    onChange: (value) => {
      state.htmlVariant = value;

      if (!selectedCombination()) {
        applyCombination(
          preferredCombination(
            currentCombinations().filter(
              (item) =>
                item.captureId === state.captureId &&
                item.htmlVariant === value,
            ),
          ),
        );
      }

      render();
    },
  });
}

function renderCssOptions() {
  renderChoiceGroup({
    target: controls.cssOptions,
    name: "css option",
    options: cssOptions(),
    selectedValue: cssKey(state.cssSample, state.cssVersion),
    valueFor: (option) => cssKey(option.cssSample, option.cssVersion),
    labelFor: cssOptionLabel,
    metaFor: (option) => {
      const metric = cssMetric(option.cssSample, option.cssVersion);

      return [
        statRow("Size", formatBytes(metric?.bytes)),
        statRow("Lines", String(metric?.lineCount ?? 0)),
        statRow("Selectors", String(metric?.selectorCount ?? 0)),
        statRow("Kagi hooks", String(metric?.privateSelectorTokenCount ?? 0)),
        statRow("Private entries", String(metric?.privateSelectorCount ?? 0)),
        statRow("Structural", String(metric?.structuralSelectorCount ?? 0)),
        statRow(":has()", String(metric?.modernSelectorCount ?? 0)),
      ].join("");
    },
    onChange: (value) => {
      const parsed = parseCssKey(value);

      state.cssSample = parsed.sample;
      state.cssVersion = parsed.version;

      if (!selectedCombination()) {
        applyCombination(
          preferredCombination(
            currentCombinations().filter(
              (item) =>
                item.captureId === state.captureId &&
                item.cssSample === parsed.sample &&
                item.cssVersion === parsed.version,
            ),
          ),
        );
      }

      render();
    },
  });
}

function capturePageCount(captureId) {
  return String(
    currentCombinations().filter((item) => item.captureId === captureId).length,
  );
}

function updateMatrixLink() {
  const combination = selectedCombination();

  if (!combination) {
    controls.matrixLink.removeAttribute("href");
    controls.matrixLink.setAttribute("aria-disabled", "true");
    controls.matrixLink.textContent = "No matrix page";
    return;
  }

  controls.matrixLink.href = `/${combination.matrixPath}`;
  controls.matrixLink.removeAttribute("aria-disabled");
  controls.matrixLink.textContent = "Open selected page";
}

function renderMatrixRows(combinations) {
  if (!combinations.length) {
    controls.matrixRows.innerHTML =
      '<tr><td colspan="5">Run pnpm generate.</td></tr>';
    return;
  }

  controls.matrixRows.innerHTML = combinations
    .map(
      (item) => `<tr>
        <td>${escapeHtml(humanize(item.captureId))}</td>
        <td>${escapeHtml(htmlVariantLabel(item.htmlVariant))}</td>
        <td>${escapeHtml(cssOptionLabel(item))}</td>
        <td>${escapeHtml(item.matrixFileName)}</td>
        <td><a href="/${escapeHtml(item.matrixPath)}">Open</a></td>
      </tr>`,
    )
    .join("");
}

function render() {
  ensureValidState();
  renderSummaryCards();
  renderCaptureOptions();
  renderHtmlOptions();
  renderCssOptions();
  updateMatrixLink();
  renderMatrixRows(currentCombinations());
}

async function loadReports() {
  const [generation, compatibility, inventory, manifest] = await Promise.all([
    fetchJson("/generated/reports/generation-summary.json").catch(() => null),
    fetchJson("/generated/reports/compatibility-summary.json").catch(
      () => null,
    ),
    fetchJson("/generated/reports/selector-inventory.json").catch(() => ({
      samples: [],
    })),
    fetchJson("/generated/matrix/manifest.json").catch(() => ({
      captures: [],
      combinations: [],
    })),
  ]);

  generationSummary = generation;
  compatibilitySummary = compatibility;
  selectorInventory = inventory;
  matrixManifest = manifest;
  applyCombination(preferredCombination(currentCombinations()));
  render();
}

function init() {
  render();
  loadReports();
}

init();
