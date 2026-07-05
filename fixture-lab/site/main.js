const controls = {
  htmlVariant: document.querySelector("#html-variant"),
  cssSample: document.querySelector("#css-sample"),
  cssVersion: document.querySelector("#css-version"),
  matrixLink: document.querySelector("#matrix-link"),
  generationSummary: document.querySelector("#generation-summary"),
  compatibilitySummary: document.querySelector("#compatibility-summary"),
  matrixRows: document.querySelector("#matrix-rows"),
};

function matrixFileName() {
  return `${controls.htmlVariant.value}__${controls.cssSample.value}__${controls.cssVersion.value}.html`;
}

function updateMatrixLink() {
  controls.matrixLink.href = `/generated/matrix/${matrixFileName()}`;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load ${url}`);
  }

  return response.json();
}

function renderJson(target, value) {
  target.textContent = JSON.stringify(value, null, 2);
}

function renderMatrixRows(combinations) {
  if (!combinations.length) {
    controls.matrixRows.innerHTML =
      '<tr><td colspan="4">No matrix pages planned yet.</td></tr>';
    return;
  }

  controls.matrixRows.innerHTML = combinations
    .map(
      (item) => `<tr>
        <td>${item.htmlVariant}</td>
        <td>${item.cssSample}</td>
        <td>${item.cssVersion}</td>
        <td>${item.captureCount}</td>
      </tr>`,
    )
    .join("");
}

function wireControls() {
  for (const control of [
    controls.htmlVariant,
    controls.cssSample,
    controls.cssVersion,
  ]) {
    control.addEventListener("change", updateMatrixLink);
  }

  updateMatrixLink();
}

async function loadReports() {
  try {
    const generationSummary = await fetchJson(
      "/generated/reports/generation-summary.json",
    );
    renderJson(controls.generationSummary, generationSummary);
  } catch (error) {
    controls.generationSummary.textContent = error.message;
  }

  try {
    const compatibilitySummary = await fetchJson(
      "/generated/reports/compatibility-summary.json",
    );
    renderJson(controls.compatibilitySummary, compatibilitySummary);
  } catch (error) {
    controls.compatibilitySummary.textContent = error.message;
  }

  try {
    const matrixManifest = await fetchJson("/generated/matrix/manifest.json");
    renderMatrixRows(matrixManifest.combinations ?? []);
  } catch {
    renderMatrixRows([]);
  }
}

function init() {
  wireControls();
  loadReports();
}

init();
