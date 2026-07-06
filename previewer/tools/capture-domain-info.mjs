import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { chromium } from "@playwright/test";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const captureRoot = path.join(projectRoot, "previewer", "captures", "original");
const kagiOrigin = "https://kagi.com";
const systemChromeCandidates = [
  process.env.PLAYWRIGHT_CHROME_EXECUTABLE,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function argValue(name) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function relativeProjectPath(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

function asciiJson(value) {
  return JSON.stringify(value, null, 2).replace(/[^\x00-\x7f]/g, (character) =>
    [...character]
      .map((part) => `\\u${part.charCodeAt(0).toString(16).padStart(4, "0")}`)
      .join(""),
  );
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
  const executablePath = await firstExistingPath(systemChromeCandidates);
  const headless = !process.argv.includes("--headed");
  const userDataDir =
    argValue("--user-data-dir") ?? process.env.KAGI_CAPTURE_USER_DATA_DIR;

  if (userDataDir) {
    return chromium.launchPersistentContext(path.resolve(userDataDir), {
      executablePath: executablePath ?? undefined,
      headless,
    });
  }

  try {
    const browser = await chromium.launch({ headless });

    return {
      close: () => browser.close(),
      newPage: (...args) => browser.newPage(...args),
    };
  } catch (error) {
    if (!executablePath) {
      throw error;
    }

    const browser = await chromium.launch({ executablePath, headless });

    return {
      close: () => browser.close(),
      newPage: (...args) => browser.newPage(...args),
    };
  }
}

function sourceUrlFromCapture(html) {
  const commentMatch = html.match(/Source:\s*(https:\/\/kagi\.com\/[^<\s]+)/);

  if (commentMatch) {
    return commentMatch[1];
  }

  const $ = cheerio.load(html, { decodeEntities: false });
  const action = $("#searchForm").attr("action");

  if (action) {
    return new URL(action, kagiOrigin).href;
  }

  throw new Error("Could not infer the source Kagi URL from the HTML capture.");
}

function absoluteUrl(value) {
  if (!value) {
    return null;
  }

  return new URL(value, kagiOrigin).href;
}

function renderedResultTargets(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const targets = new Map();

  $("._0_main-search-results ._0_rank-icons").each((_, badge) => {
    const result = $(badge).closest("._0_SRI, .search-result");
    const url = result.find("._0_URL[data-domain]").first();
    const domain = url.attr("data-domain") ?? $(badge).attr("data-domain");
    const href = absoluteUrl(url.attr("href"));

    if (!domain) {
      return;
    }

    targets.set(domain, {
      domain,
      url: href,
    });
  });

  return [...targets.values()].sort((a, b) => a.domain.localeCompare(b.domain));
}

function mergePayloads(payloads) {
  const data = new Map();
  const slopStop = new Map();
  const youtube = new Map();
  const merged = {};

  for (const payload of payloads) {
    if (!payload || typeof payload !== "object") {
      continue;
    }

    for (const [key, value] of Object.entries(payload)) {
      if (!Array.isArray(value) && value != null) {
        merged[key] = value;
      }
    }

    for (const entry of payload.data ?? []) {
      if (entry?.domain) {
        data.set(entry.domain, entry);
      }
    }

    for (const entry of payload.slop_stop_metadata ?? []) {
      if (entry?.slop_stop_url) {
        slopStop.set(entry.slop_stop_url, entry);
      }
    }

    for (const entry of payload.youtube_metadata ?? []) {
      const key = entry?.creator_id ?? entry?.domain ?? entry?.title;

      if (key) {
        youtube.set(key, entry);
      }
    }
  }

  return {
    ...merged,
    data: [...data.values()],
    slop_stop_metadata: [...slopStop.values()],
    youtube_metadata: [...youtube.values()],
  };
}

function hostnameForUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function filterPayloadForTargets(payload, targets) {
  const targetDomains = new Set(targets.map((target) => target.domain));
  const targetUrls = new Set(
    targets.map((target) => target.url).filter((value) => value),
  );

  return {
    ...payload,
    data: (payload.data ?? [])
      .filter((entry) => targetDomains.has(entry.domain))
      .map(redactDomainEntry),
    slop_stop_metadata: (payload.slop_stop_metadata ?? []).filter((entry) => {
      const host = hostnameForUrl(entry.slop_stop_url);

      return targetUrls.has(entry.slop_stop_url) || targetDomains.has(host);
    }),
    youtube_metadata: (payload.youtube_metadata ?? []).filter((entry) =>
      targetDomains.has(`youtube.com/channel/${entry.creator_id}`),
    ),
  };
}

function redactDomainEntry(entry) {
  const { favicon_url, ...safeEntry } = entry;

  return safeEntry;
}

async function captureProviderPayloads(page, sourceUrl, expectedDomains) {
  await page.addInitScript(() => {
    window.__kagiPreviewerDomainInfoPayloads = [];
    window.addEventListener("provider:domain_info", (event) => {
      window.__kagiPreviewerDomainInfoPayloads.push(event.detail?.payload);
    });
  });

  await page.goto(sourceUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("._0_main-search-results ._0_rank-icons", {
    timeout: 15000,
  });

  await page
    .waitForFunction(
      (domains) => {
        const captured = new Set(
          (window.__kagiPreviewerDomainInfoPayloads ?? []).flatMap((payload) =>
            (payload?.data ?? []).map((entry) => entry.domain),
          ),
        );

        return domains.every((domain) => captured.has(domain));
      },
      expectedDomains,
      { timeout: 20000 },
    )
    .catch(() => {});

  await page.waitForTimeout(500);

  return page.evaluate(() => window.__kagiPreviewerDomainInfoPayloads ?? []);
}

async function main() {
  const captureId = argValue("--capture") ?? "search";
  const capturePath = path.join(captureRoot, `${captureId}.html`);
  const outputPath = argValue("--out")
    ? path.resolve(projectRoot, argValue("--out"))
    : path.join(captureRoot, `${captureId}.domain-info.json`);
  const html = await fs.readFile(capturePath, "utf8");
  const sourceUrl = argValue("--url") ?? sourceUrlFromCapture(html);
  const targets = renderedResultTargets(html);
  const expectedDomains = targets.map((target) => target.domain);

  if (!targets.length) {
    throw new Error(`No rendered result domains found in ${capturePath}.`);
  }

  let browser;

  try {
    browser = await launchBrowser();

    const page = await browser.newPage({
      viewport: { width: 1280, height: 1100 },
    });
    const payloads = await captureProviderPayloads(
      page,
      sourceUrl,
      expectedDomains,
    );
    const payload = filterPayloadForTargets(mergePayloads(payloads), targets);
    const capturedDomains = new Set(payload.data.map((entry) => entry.domain));
    const missingDomains = expectedDomains.filter(
      (domain) => !capturedDomains.has(domain),
    );

    if (missingDomains.length) {
      throw new Error(
        `Missing domain-info data for ${missingDomains.join(", ")}.`,
      );
    }

    await fs.writeFile(
      outputPath,
      `${asciiJson({
        sourceCapture: relativeProjectPath(capturePath),
        sourceUrl,
        event: "provider:domain_info",
        renderedDomains: expectedDomains,
        payload,
      })}\n`,
    );

    await page.close();

    console.log(
      `Captured domain-info data for ${capturedDomains.size} domain(s) to ${relativeProjectPath(outputPath)}.`,
    );
  } finally {
    await browser?.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
