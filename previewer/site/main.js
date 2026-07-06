const controls = {
  captureOptions: document.querySelector("#capture-options"),
  cssFileOptions: document.querySelector("#css-file-options"),
  openPreviewButton: document.querySelector("#open-preview-button"),
  selectionStatus: document.querySelector("#selection-status"),
};

const preferredSelection = {
  captureId: "search",
  customCssId: "kagi-sidebar",
};

let manifest = {
  kagiCustomCssLimit: 40000,
  captures: [],
  customCssFiles: [],
  pages: [],
};
let state = { ...preferredSelection };

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
    basic: "HTML",
    enhanced: "JS",
    "html-search": "HTML",
    "kagi-sidebar": "Kagi Sidebar",
    release: "Release",
    search: "JS",
  };

  return labels[value] ?? String(value).replaceAll("-", " ");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
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

function statRow(label, value) {
  return `<span class="metric-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></span>`;
}

function renderEmpty(target, message) {
  target.className = "empty-state";
  target.innerHTML = escapeHtml(message);
}

function captures() {
  return manifest.captures ?? [];
}

function customCssFiles() {
  return manifest.customCssFiles ?? [];
}

function selectedPage() {
  return (manifest.pages ?? []).find(
    (page) =>
      page.captureId === state.captureId &&
      page.customCssId === state.customCssId,
  );
}

function ensureValidState() {
  const captureOptions = captures();
  const cssOptions = customCssFiles();

  if (!captureOptions.some((item) => item.id === state.captureId)) {
    state.captureId =
      captureOptions.find((item) => item.id === preferredSelection.captureId)
        ?.id ??
      captureOptions[0]?.id ??
      preferredSelection.captureId;
  }

  if (!cssOptions.some((item) => item.id === state.customCssId)) {
    state.customCssId =
      cssOptions.find((item) => item.id === preferredSelection.customCssId)
        ?.id ??
      cssOptions[0]?.id ??
      preferredSelection.customCssId;
  }
}

function renderChoiceCards({
  target,
  name,
  options,
  selectedValue,
  valueFor,
  labelFor,
  descriptionFor = () => "",
  metaFor,
  onChange,
}) {
  if (!options.length) {
    renderEmpty(target, "Run pnpm generate.");
    return;
  }

  target.className = "choice-grid";
  target.innerHTML = options
    .map((option) => {
      const value = valueFor(option);
      const selected = value === selectedValue;
      const description = descriptionFor(option);

      return `<label class="choice-card${selected ? " is-selected" : ""}">
        <input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}"${selected ? " checked" : ""} />
        <span class="choice-title">${escapeHtml(labelFor(option))}</span>
        ${
          description
            ? `<span class="choice-description">${escapeHtml(description)}</span>`
            : ""
        }
        <span class="choice-meta">${metaFor(option)}</span>
      </label>`;
    })
    .join("");

  target.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => onChange(input.value));
  });
}

function captureDescription(capture) {
  const descriptions = {
    basic: "Basic no-JS renderer.",
    enhanced: "JS-enhanced renderer with Kagi runtime behavior.",
  };

  return descriptions[capture.renderer] ?? "";
}

function cssLimitText(cssFile) {
  const characterCount = cssFile.characterCount ?? cssFile.cssCharacterCount;
  const count = formatNumber(characterCount);
  const limit = formatNumber(cssFile.kagiCustomCssLimit);

  return cssFile.overKagiLimit
    ? `${count} / ${limit} chars, over limit`
    : `${count} / ${limit} chars`;
}

function renderCaptureOptions() {
  renderChoiceCards({
    target: controls.captureOptions,
    name: "capture",
    options: captures(),
    selectedValue: state.captureId,
    valueFor: (option) => option.id,
    labelFor: (option) => humanize(option.id),
    descriptionFor: captureDescription,
    metaFor: (option) =>
      [
        statRow("Renderer", humanize(option.renderer)),
        statRow("Source", option.file),
      ].join(""),
    onChange: (value) => {
      state.captureId = value;
      render();
    },
  });
}

function renderCssFileOptions() {
  renderChoiceCards({
    target: controls.cssFileOptions,
    name: "custom CSS",
    options: customCssFiles(),
    selectedValue: state.customCssId,
    valueFor: (option) => option.id,
    labelFor: (option) => option.name || humanize(option.id),
    descriptionFor: (option) =>
      option.source === "release"
        ? "Current distributable sidebar CSS."
        : "Additional local Custom CSS file.",
    metaFor: (option) =>
      [
        statRow("Source", option.path),
        statRow("Length", cssLimitText(option)),
        statRow("Bytes", formatBytes(option.sourceBytes)),
      ].join(""),
    onChange: (value) => {
      state.customCssId = value;
      render();
    },
  });
}

function renderOpenButton() {
  const page = selectedPage();

  if (!page) {
    controls.openPreviewButton.href = "#";
    controls.openPreviewButton.setAttribute("aria-disabled", "true");
    controls.selectionStatus.textContent =
      "This capture and Custom CSS pairing is not generated.";
    return;
  }

  controls.openPreviewButton.href = `/${page.pagePath}`;
  controls.openPreviewButton.removeAttribute("aria-disabled");
  controls.selectionStatus.textContent = [
    humanize(page.captureId),
    page.customCssName,
    cssLimitText(page),
  ].join(" / ");
}

function render() {
  ensureValidState();
  renderCaptureOptions();
  renderCssFileOptions();
  renderOpenButton();
}

async function loadManifest() {
  manifest = await fetchJson("/generated/previewer/manifest.json").catch(
    () => ({
      kagiCustomCssLimit: 40000,
      captures: [],
      customCssFiles: [],
      pages: [],
    }),
  );
  render();
}

function init() {
  render();
  loadManifest();
}

init();
