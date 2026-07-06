import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const generatedRoot = path.join(projectRoot, "generated");
const previewerRoot = path.join(projectRoot, "previewer");
const captureRoot = path.join(previewerRoot, "captures", "original");
const customCssRoot = path.join(previewerRoot, "custom-css");
const builtInCssPath = "src/kagi-sidebar.css";
const kagiOrigin = "https://kagi.com";
const kagiCustomCssLimit = 40000;
const preferredCaptureOrder = ["search", "html-search"];
const transparentPixelDataUri =
  "data:image/gif;base64,R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function readJsonIfExists(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }

  return readJson(filePath);
}

function relativeProjectPath(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cssNameFromFileName(fileName) {
  return path
    .basename(fileName, ".css")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function uniqueCssId(preferredId, usedIds) {
  let id = preferredId || "custom-css";
  let suffix = 2;

  while (usedIds.has(id)) {
    id = `${preferredId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(id);
  return id;
}

function compareCaptures(a, b) {
  const aIndex = preferredCaptureOrder.indexOf(a.id);
  const bIndex = preferredCaptureOrder.indexOf(b.id);

  if (aIndex !== -1 || bIndex !== -1) {
    return (
      (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) -
      (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex)
    );
  }

  return a.id.localeCompare(b.id);
}

async function listHtmlCaptures() {
  if (!(await pathExists(captureRoot))) {
    return [];
  }

  const entries = await fs.readdir(captureRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => ({
      id: path.basename(entry.name, ".html"),
      fileName: entry.name,
      sourcePath: path.join(captureRoot, entry.name),
      domainInfoPath: path.join(
        captureRoot,
        `${path.basename(entry.name, ".html")}.domain-info.json`,
      ),
    }))
    .sort(compareCaptures);
}

async function cssFileMetadata({ id, name, source, relativePath }) {
  const absolutePath = path.join(projectRoot, relativePath);
  const body = await fs.readFile(absolutePath, "utf8");
  const characterCount = body.length;

  return {
    id,
    name,
    source,
    path: relativePath,
    sourceBytes: Buffer.byteLength(body),
    characterCount,
    kagiCustomCssLimit,
    overKagiLimit: characterCount > kagiCustomCssLimit,
  };
}

async function listCustomCssFiles() {
  const usedIds = new Set();
  const files = [
    {
      id: uniqueCssId("no-css", usedIds),
      name: "No CSS",
      source: "baseline",
      path: null,
      sourceBytes: 0,
      characterCount: 0,
      kagiCustomCssLimit,
      overKagiLimit: false,
    },
    await cssFileMetadata({
      id: uniqueCssId("kagi-sidebar", usedIds),
      name: "Kagi Sidebar",
      source: "release",
      relativePath: builtInCssPath,
    }),
  ];

  if (!(await pathExists(customCssRoot))) {
    return files;
  }

  const entries = await fs.readdir(customCssRoot, { withFileTypes: true });
  const customFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of customFiles) {
    const relativePath = relativeProjectPath(
      path.join(customCssRoot, entry.name),
    );
    const preferredId = slugify(path.basename(entry.name, ".css"));

    files.push(
      await cssFileMetadata({
        id: uniqueCssId(preferredId, usedIds),
        name: cssNameFromFileName(entry.name),
        source: "custom-css",
        relativePath,
      }),
    );
  }

  return files;
}

async function ensureGeneratedDirs() {
  await Promise.all([
    fs.rm(path.join(generatedRoot, "html"), { recursive: true, force: true }),
    fs.rm(path.join(generatedRoot, "matrix"), { recursive: true, force: true }),
    fs.rm(path.join(generatedRoot, "pages"), { recursive: true, force: true }),
    fs.rm(path.join(generatedRoot, "previewer"), {
      recursive: true,
      force: true,
    }),
    fs.rm(path.join(generatedRoot, "reports"), {
      recursive: true,
      force: true,
    }),
  ]);

  await Promise.all(
    [
      path.join(generatedRoot, "pages"),
      path.join(generatedRoot, "previewer"),
      path.join(generatedRoot, "reports"),
    ].map((dir) => fs.mkdir(dir, { recursive: true })),
  );
}

function toKagiAssetUrl(value) {
  if (!value || value.startsWith("http") || value.startsWith("data:")) {
    return value;
  }

  if (value.startsWith("about:blank#redacted-kagi-favicon-proxy")) {
    return transparentPixelDataUri;
  }

  if (value.startsWith("/")) {
    return `${kagiOrigin}${value}`;
  }

  return value;
}

function assetRevisionFromHref(value) {
  if (!value) {
    return null;
  }

  const url = new URL(value, kagiOrigin);
  const assetMatch = url.pathname.match(/^\/asset\/([^/]+)\//);

  if (!assetMatch) {
    return null;
  }

  return {
    assetId: assetMatch[1],
    version: url.searchParams.get("v"),
  };
}

function capturedAssetRevision($) {
  for (const element of $("link[href]").toArray()) {
    const revision = assetRevisionFromHref($(element).attr("href"));

    if (revision) {
      return revision;
    }
  }

  return null;
}

function kagiRuntimeScriptUrls($) {
  const revision = capturedAssetRevision($);

  if (!revision) {
    return [];
  }

  const suffix = revision.version
    ? `?v=${encodeURIComponent(revision.version)}`
    : "";

  return ["k_sea.js", "k_serp.js"].map(
    (fileName) =>
      `${kagiOrigin}/asset/${revision.assetId}/js/${fileName}${suffix}`,
  );
}

function rendererForCapture(capture) {
  return capture.id === "html-search" ? "basic" : "enhanced";
}

function runtimeState($, capture) {
  if (rendererForCapture(capture) !== "enhanced") {
    return "none";
  }

  if ($("script").length) {
    return "source";
  }

  return "none";
}

function ensureEnhancedRuntimeScripts($, capture) {
  if (runtimeState($, capture) !== "none") {
    return [];
  }

  if (rendererForCapture(capture) !== "enhanced") {
    return [];
  }

  const scriptUrls = kagiRuntimeScriptUrls($);

  for (const src of scriptUrls) {
    $("head").append(
      `\n    <script src="${src}" data-previewer-runtime="kagi"></script>`,
    );
  }

  return scriptUrls;
}

function jsonForInlineScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function domainInfoPayload(domainInfoCapture) {
  return domainInfoCapture?.payload ?? null;
}

function injectDomainInfoReplay($, capture, domainInfoCapture) {
  const payload = domainInfoPayload(domainInfoCapture);

  if (rendererForCapture(capture) !== "enhanced" || !payload) {
    return "none";
  }

  const script = `
    <script data-previewer-domain-info="captured">
      (() => {
        const payload = ${jsonForInlineScript(payload)};
        window.__kagiPreviewerDomainInfoPayload = payload;

        const dispatch = () => {
          window.dispatchEvent(
            new CustomEvent("provider:domain_info", {
              detail: { payload },
            }),
          );
        };

        const replayWhenRuntimeIsReady = (attempt = 0) => {
          if (typeof window.openDomainInfo === "function") {
            dispatch();
            return;
          }

          if (attempt < 100) {
            window.setTimeout(() => replayWhenRuntimeIsReady(attempt + 1), 50);
          }
        };

        if (document.readyState === "loading") {
          document.addEventListener(
            "DOMContentLoaded",
            () => replayWhenRuntimeIsReady(),
            { once: true },
          );
        } else {
          replayWhenRuntimeIsReady();
        }
      })();
    </script>`;

  $("head").append(script);

  return "captured";
}

function prepareForLocalViewing(html, capture, domainInfoCapture) {
  const $ = cheerio.load(html, { decodeEntities: false });

  $("link[href]").each((_, element) => {
    const node = $(element);
    node.attr("href", toKagiAssetUrl(node.attr("href")));
  });

  $("script[src]").each((_, element) => {
    const node = $(element);
    node.attr("src", toKagiAssetUrl(node.attr("src")));
  });

  $("img[src], source[src], video[poster]").each((_, element) => {
    const node = $(element);

    for (const attr of ["src", "poster"]) {
      if (node.attr(attr) != null) {
        node.attr(attr, toKagiAssetUrl(node.attr(attr)));
      }
    }
  });

  $("img[srcset], source[srcset]").each((_, element) => {
    const node = $(element);
    const srcset = node.attr("srcset");

    if (!srcset) {
      return;
    }

    node.attr(
      "srcset",
      srcset
        .split(",")
        .map((candidate) => {
          const parts = candidate.trim().split(/\s+/);
          parts[0] = toKagiAssetUrl(parts[0]);
          return parts.join(" ");
        })
        .join(", "),
    );
  });

  const sourceRuntime = runtimeState($, capture);
  const inferredRuntimeScripts = ensureEnhancedRuntimeScripts($, capture);
  const runtime =
    sourceRuntime !== "none"
      ? sourceRuntime
      : inferredRuntimeScripts.length
        ? "inferred-kagi"
        : "none";
  const domainInfo = injectDomainInfoReplay($, capture, domainInfoCapture);

  $("html")
    .attr("data-previewer-capture", capture.id)
    .attr("data-previewer-renderer", rendererForCapture(capture))
    .attr("data-previewer-js-runtime", runtime)
    .attr("data-previewer-domain-info", domainInfo);

  return $.html();
}

function injectCustomCssLink(html, page) {
  const $ = cheerio.load(html, { decodeEntities: false });

  if (page.cssPath) {
    const href = `../../${page.cssPath}`;
    const cssLink = `<link rel="stylesheet" href="${href}" data-previewer-custom-css="${page.customCssId}">`;

    $("head").append(`\n    ${cssLink}\n  `);
  }

  $("html")
    .attr("data-previewer-custom-css", page.customCssId)
    .attr("data-previewer-custom-css-path", page.cssPath ?? "");

  return $.html();
}

function previewPages(captures, customCssFiles) {
  return captures.flatMap((capture) =>
    customCssFiles.map((cssFile) => {
      const fileName = `${capture.id}__${cssFile.id}.html`;
      const outputPath = path.join(generatedRoot, "pages", fileName);

      return {
        captureId: capture.id,
        captureFile: relativeProjectPath(capture.sourcePath),
        renderer: rendererForCapture(capture),
        customCssId: cssFile.id,
        customCssName: cssFile.name,
        cssPath: cssFile.path,
        cssSource: cssFile.source,
        cssCharacterCount: cssFile.characterCount,
        cssSourceBytes: cssFile.sourceBytes,
        overKagiLimit: cssFile.overKagiLimit,
        kagiCustomCssLimit,
        pageFileName: fileName,
        pagePath: relativeProjectPath(outputPath),
      };
    }),
  );
}

async function writeCaptureHtml(captures) {
  const captureHtml = new Map();
  const generatedCaptures = [];

  for (const capture of captures) {
    const html = await fs.readFile(capture.sourcePath, "utf8");
    const domainInfoCapture = await readJsonIfExists(capture.domainInfoPath);
    const localHtml = prepareForLocalViewing(html, capture, domainInfoCapture);

    captureHtml.set(capture.id, localHtml);
    generatedCaptures.push({
      id: capture.id,
      file: relativeProjectPath(capture.sourcePath),
      renderer: rendererForCapture(capture),
      htmlBytes: Buffer.byteLength(localHtml),
      domainInfoFile:
        rendererForCapture(capture) === "enhanced" && domainInfoCapture
          ? relativeProjectPath(capture.domainInfoPath)
          : null,
    });
  }

  return { captureHtml, generatedCaptures };
}

async function writePreviewPages(pages, captureHtml) {
  for (const page of pages) {
    const html = captureHtml.get(page.captureId);

    if (!html) {
      throw new Error(`Missing prepared HTML for capture ${page.captureId}`);
    }

    const previewHtml = injectCustomCssLink(html, page);
    const outputPath = path.join(projectRoot, page.pagePath);

    await fs.writeFile(
      outputPath,
      previewHtml.endsWith("\n") ? previewHtml : `${previewHtml}\n`,
    );
  }
}

async function main() {
  await ensureGeneratedDirs();

  const captures = await listHtmlCaptures();
  const customCssFiles = await listCustomCssFiles();
  const pages = previewPages(captures, customCssFiles);
  const { captureHtml, generatedCaptures } = await writeCaptureHtml(captures);

  await writePreviewPages(pages, captureHtml);

  const summary = {
    status: captures.length === 0 ? "waiting-for-captures" : "ready",
    kagiCustomCssLimit,
    captureFiles: captures.map((capture) => capture.fileName),
    customCssFiles,
    generatedPageCount: pages.length,
    nextStep:
      captures.length === 0
        ? "Add redacted HTML captures to previewer/captures/original/."
        : "Open pnpm dev and inspect the generated preview pages.",
  };
  const manifest = {
    kagiCustomCssLimit,
    captures: generatedCaptures,
    customCssFiles,
    pages,
  };

  await fs.writeFile(
    path.join(generatedRoot, "reports", "generation-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  await fs.writeFile(
    path.join(generatedRoot, "previewer", "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  console.log(
    `Generated ${pages.length} preview page(s) from ${captures.length} capture(s) and ${customCssFiles.length} Custom CSS file(s).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
