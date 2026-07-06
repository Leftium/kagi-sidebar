import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const manifestPath = path.join(
  projectRoot,
  "generated",
  "matrix",
  "manifest.json",
);
const screenshotRoot = path.join(
  projectRoot,
  "generated",
  "screenshots",
  "js-popovers",
);
const systemChromeCandidates = [
  process.env.PLAYWRIGHT_CHROME_EXECUTABLE,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const preferredChecks = [
  {
    bundleVariant: "original",
    cssSample: "sidebar",
    cssVersion: "original",
  },
  {
    bundleVariant: "backwards-compatible",
    cssSample: "sidebar",
    cssVersion: "semantic",
  },
  {
    bundleVariant: "optimized",
    cssSample: "sidebar",
    cssVersion: "semantic",
  },
];

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function slugFor(combination) {
  return [
    combination.captureId,
    combination.bundleVariant ?? combination.htmlVariant,
    combination.cssSample,
    combination.cssVersion,
  ].join("__");
}

function localPathForRequest(url) {
  const requestUrl = new URL(url, "http://127.0.0.1");
  const decodedPath = decodeURIComponent(requestUrl.pathname);
  const filePath = path.resolve(projectRoot, `.${decodedPath}`);

  if (!filePath.startsWith(`${projectRoot}${path.sep}`)) {
    return null;
  }

  return filePath;
}

async function serveFile(request, response) {
  const filePath = localPathForRequest(request.url);

  if (!filePath) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const body = await fs.readFile(filePath);
    response.writeHead(200, {
      "content-type":
        contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
}

async function startServer() {
  const server = http.createServer((request, response) => {
    serveFile(request, response).catch((error) => {
      response.writeHead(500).end(String(error?.stack ?? error));
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Could not determine fixture server address.");
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function firstExistingPath(paths) {
  for (const filePath of paths) {
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      // Try the next common browser location.
    }
  }

  return null;
}

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (error) {
    const executablePath = await firstExistingPath(systemChromeCandidates);

    if (!executablePath) {
      throw error;
    }

    return chromium.launch({ executablePath });
  }
}

function plannedChecks(manifest) {
  return preferredChecks.map((check) => {
    const combination = manifest.combinations.find(
      (item) =>
        item.captureId === "search" &&
        (item.bundleVariant ?? item.htmlVariant) === check.bundleVariant &&
        item.cssSample === check.cssSample &&
        item.cssVersion === check.cssVersion,
    );

    if (!combination) {
      throw new Error(
        `Missing matrix page for ${check.bundleVariant}/${check.cssVersion}. Run pnpm generate first.`,
      );
    }

    return combination;
  });
}

async function visibleElementMetrics(page, selector) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);

      return {
        display: style.display,
        height: rect.height,
        left: rect.left,
        opacity: style.opacity,
        position: style.position,
        top: rect.top,
        visibility: style.visibility,
        width: rect.width,
      };
    });
}

function isVisibleBox(metrics) {
  return (
    metrics.display !== "none" &&
    metrics.visibility !== "hidden" &&
    Number(metrics.opacity) > 0 &&
    metrics.width > 0 &&
    metrics.height > 0
  );
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function textFromHtml(value) {
  return normalizeText(String(value ?? "").replace(/<[^>]+>/g, " "));
}

function expectedText(value) {
  if (typeof value === "number") {
    return value.toLocaleString("en-US");
  }

  return textFromHtml(value);
}

function expectedDomainRows(entry) {
  const rows = [
    ["_0_di_scam_site", entry.scam_list_site ? "We found this site" : null],
    ["_0_di_trackers", entry.localizations?.trackers],
    ["_0_ranked_traffic", entry.localizations?.ranked_traffic],
    ["_0_tracker_category", entry.tracker_category],
    ["d-info-connection", entry.localizations?.connection_info],
    ["_0_registration", entry.registration_date],
    ["_0_domain_lang", entry.language],
    ["_0_website_speed", entry.website_speed],
    ["_0_whois_org", entry.whois_org],
    ["_0_bangs", entry.bangs],
    ...(entry.rss_link ?? []).map((link) => [
      "_0_rss_links",
      link.title || link.url,
    ]),
    ["_0_subscribers", entry.subscriber_count],
    ["_0_videos", entry.video_count],
    ["_0_created", entry.creator_published_at],
    ["_0_views", entry.view_count],
  ];

  return rows
    .map(([id, value]) => ({
      id,
      value: expectedText(value),
    }))
    .filter((row) => row.value);
}

function domainInfoByDomain(payload) {
  return new Map((payload?.data ?? []).map((entry) => [entry.domain, entry]));
}

async function waitForVisibleBox(page, selector) {
  await page.waitForFunction(
    (targetSelector) => {
      const element = document.querySelector(targetSelector);

      if (!element) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    },
    selector,
    { timeout: 5000 },
  );
}

async function fixtureDomainInfoPayload(page) {
  const payload = await page.evaluate(
    () => window.__kagiFixtureDomainInfoPayload ?? null,
  );

  if (!payload) {
    throw new Error("Matrix page did not load captured domain-info data.");
  }

  return payload;
}

async function renderedShieldDomains(page) {
  return page.evaluate(() => {
    const domains = [];
    const seen = new Set();

    for (const badge of document.querySelectorAll(
      "._0_main-search-results ._0_rank-icons",
    )) {
      const result = badge.closest("._0_SRI, .search-result");
      const url = result?.querySelector("._0_URL[data-domain]");
      const domain = url?.dataset.domain ?? badge.dataset.domain;

      if (domain && !seen.has(domain)) {
        seen.add(domain);
        domains.push(domain);
      }
    }

    return domains;
  });
}

async function closeDomainInfo(page) {
  await page.evaluate(() => window.closeDomainInfoModal?.()).catch(() => {});
  await page
    .waitForFunction(() => !document.querySelector("#domainInfoModal.--open"), {
      timeout: 1000,
    })
    .catch(() => {});
}

async function clickDomainInfoBadge(page, domain) {
  const handle = await page.evaluateHandle((targetDomain) => {
    return [
      ...document.querySelectorAll("._0_main-search-results ._0_rank-icons"),
    ].find((badge) => {
      const result = badge.closest("._0_SRI, .search-result");
      const url = result?.querySelector("._0_URL[data-domain]");

      return (url?.dataset.domain ?? badge.dataset.domain) === targetDomain;
    });
  }, domain);
  const badge = handle.asElement();

  if (!badge) {
    await handle.dispose();
    throw new Error(`Could not find a shield badge for ${domain}.`);
  }

  await badge.scrollIntoViewIfNeeded();

  const beforeUrl = page.url();
  await badge.click();
  await handle.dispose();

  if (page.url() !== beforeUrl) {
    throw new Error(`Badge click navigated to ${page.url()}`);
  }

  await page.locator("#domainInfoModal.--open").waitFor({
    state: "visible",
    timeout: 5000,
  });
  await waitForVisibleBox(page, "#domainInfoModal");
  await page.waitForTimeout(250);
}

async function visibleDomainInfoRows(page) {
  return page.locator("#domainInfoModal").evaluate((modal) => {
    return [...modal.querySelectorAll(".d-info-body .__section-item")]
      .map((row) => {
        const style = getComputedStyle(row);
        const id =
          row.id ||
          (row.classList.contains("d-info-connection")
            ? "d-info-connection"
            : "");

        return {
          id,
          display: style.display,
          hidden: row.hidden,
          label:
            row
              .querySelector(".__section-item-icon")
              ?.textContent?.trim()
              .replace(/\s+/g, " ") ?? "",
          value:
            row
              .querySelector(".d-info-section-desc")
              ?.textContent?.trim()
              .replace(/\s+/g, " ") ?? "",
          visibility: style.visibility,
        };
      })
      .filter(
        (row) =>
          !row.hidden &&
          row.display !== "none" &&
          row.visibility !== "hidden" &&
          row.value,
      );
  });
}

function assertExpectedRows(domain, expectedRows, actualRows) {
  const actualById = new Map();

  for (const row of actualRows) {
    actualById.set(row.id, [...(actualById.get(row.id) ?? []), row]);
  }

  if (!expectedRows.length) {
    return;
  }

  for (const expected of expectedRows) {
    const actual = actualById.get(expected.id) ?? [];

    if (!actual.length) {
      throw new Error(`${domain} did not render ${expected.id}.`);
    }

    if (!actual.some((row) => row.value.includes(expected.value))) {
      throw new Error(
        `${domain} rendered ${expected.id} as "${actual
          .map((row) => row.value)
          .join(" | ")}", expected "${expected.value}".`,
      );
    }
  }
}

async function checkDomainInfo(page, combination) {
  const payload = await fixtureDomainInfoPayload(page);
  const expectedByDomain = domainInfoByDomain(payload);
  const domains = await renderedShieldDomains(page);
  const checked = [];

  if (!domains.length) {
    throw new Error("No result shield badges were found.");
  }

  for (const [index, domain] of domains.entries()) {
    const expected = expectedByDomain.get(domain);

    if (!expected) {
      throw new Error(`No captured domain-info data for ${domain}.`);
    }

    await closeDomainInfo(page);
    await clickDomainInfoBadge(page, domain);

    const metrics = await visibleElementMetrics(page, "#domainInfoModal");

    if (!isVisibleBox(metrics)) {
      throw new Error(
        `Domain info modal is not visibly rendered: ${JSON.stringify(metrics)}`,
      );
    }

    const title = await page
      .locator("#domainInfoModal ._0_d-info-domain-title")
      .first()
      .textContent();

    if (!title?.trim()) {
      throw new Error(`${domain} opened without a result title.`);
    }

    const rows = await visibleDomainInfoRows(page);
    const expectedRows = expectedDomainRows(expected);

    assertExpectedRows(domain, expectedRows, rows);

    if (index === 0) {
      await page.locator("#domainInfoModal").screenshot({
        path: path.join(
          screenshotRoot,
          `${slugFor(combination)}--domain-info.png`,
        ),
      });
    }

    checked.push({
      domain,
      expectedRows,
      metrics,
      rows,
      title: title.trim(),
    });
  }

  await closeDomainInfo(page);

  return {
    checked,
    domainCount: checked.length,
  };
}

async function checkResultMenu(page, combination) {
  const menu = page.locator("._0_main-search-results .__sri_more_menu").first();
  const trigger = menu.locator("._0_k_ui_dropdown_first_item button").first();

  await trigger.waitFor({ state: "visible", timeout: 5000 });
  await trigger.click();
  await page.waitForFunction(
    (element) => element?.getAttribute("aria-expanded") === "true",
    await menu.elementHandle(),
    { timeout: 5000 },
  );
  await waitForVisibleBox(
    page,
    "._0_main-search-results .__sri_more_menu ._0_k_ui_dropdown_data_list",
  );

  const metrics = await visibleElementMetrics(
    page,
    "._0_main-search-results .__sri_more_menu ._0_k_ui_dropdown_data_list",
  );

  if (!isVisibleBox(metrics)) {
    throw new Error(
      `Result menu is not visibly rendered: ${JSON.stringify(metrics)}`,
    );
  }

  await page.screenshot({
    path: path.join(screenshotRoot, `${slugFor(combination)}--result-menu.png`),
  });
  await page.keyboard.press("Escape");

  return {
    metrics,
  };
}

async function checkCombination(browser, origin, combination) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1200 },
  });
  const consoleMessages = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  const url = `${origin}/${combination.matrixPath}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const runtime = await page
    .locator("html")
    .getAttribute("data-fixture-js-runtime");

  if (runtime === "none") {
    throw new Error(`${combination.matrixPath} has no JS runtime.`);
  }

  await page.waitForFunction(
    () =>
      Boolean(window.sseCache) &&
      typeof window.getKagiSetting === "function" &&
      Boolean(window.__kagiFixtureDomainInfoPayload),
    { timeout: 5000 },
  );

  const domainInfo = await checkDomainInfo(page, combination);
  const resultMenu = await checkResultMenu(page, combination);

  await page.close();

  return {
    combination,
    consoleMessages,
    domainInfo,
    pageErrors,
    resultMenu,
    runtime,
  };
}

async function main() {
  await fs.mkdir(screenshotRoot, { recursive: true });

  const manifest = await readJson(manifestPath);
  const checks = plannedChecks(manifest);
  const server = await startServer();
  let browser;
  const results = [];

  try {
    browser = await launchBrowser();

    for (const combination of checks) {
      results.push(await checkCombination(browser, server.origin, combination));
    }
  } finally {
    await browser?.close();
    await server.close();
  }

  await fs.writeFile(
    path.join(projectRoot, "generated", "reports", "js-popovers.json"),
    `${JSON.stringify({ checked: results }, null, 2)}\n`,
  );

  console.log(`Checked ${results.length} JS popover page(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
