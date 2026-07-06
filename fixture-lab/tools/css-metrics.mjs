import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

const privateSelectorPattern =
  /(^|[\s>+~,(])(?:#[\w-]*(?:dd_toggle|sidebarForm|web_archive)[\w-]*|\.(?:_0_|__|sri-|newsResultItem|podcast_result|quick-search-btn)[\w-]*)/;
const privateSelectorTokenPattern =
  /#[\w-]*(?:dd_toggle|sidebarForm|web_archive)[\w-]*|\.(?:_0_|__|sri-|newsResultItem|podcast_result|quick-search-btn)[\w-]*/g;
const structuralSelectorPattern = /(?:\+|~|>|:nth-child|:nth-of-type)/;
const modernSelectorPattern = /:has\(/;

function splitSelectors(selectorText) {
  const selectors = [];

  selectorParser((root) => {
    root.each((selector) => {
      const value = selector.toString().trim();

      if (value) {
        selectors.push(value);
      }
    });
  }).processSync(selectorText);

  return selectors;
}

function closestParentRule(rule) {
  let parent = rule.parent;

  while (parent) {
    if (parent.type === "rule") {
      return parent;
    }

    parent = parent.parent;
  }

  return null;
}

function combineNestedSelector(parentSelector, childSelector) {
  if (childSelector.includes("&")) {
    return childSelector.replaceAll("&", parentSelector);
  }

  return `${parentSelector} ${childSelector}`;
}

function resolvedSelectorsForRule(rule, cache = new WeakMap()) {
  const cached = cache.get(rule);

  if (cached) {
    return cached;
  }

  const selectors = splitSelectors(rule.selector);
  const parentRule = closestParentRule(rule);

  if (!parentRule) {
    cache.set(rule, selectors);
    return selectors;
  }

  const parentSelectors = resolvedSelectorsForRule(parentRule, cache);
  const resolvedSelectors = parentSelectors.flatMap((parentSelector) =>
    selectors.map((selector) =>
      combineNestedSelector(parentSelector, selector),
    ),
  );

  cache.set(rule, resolvedSelectors);
  return resolvedSelectors;
}

function classifySelector(selector) {
  return {
    selector,
    privateKagiSelector: privateSelectorPattern.test(selector),
    structuralDependency: structuralSelectorPattern.test(selector),
    modernSelector: modernSelectorPattern.test(selector),
  };
}

function countLines(value) {
  if (!value) {
    return 0;
  }

  const newlineCount = value.match(/\n/g)?.length ?? 0;

  return value.endsWith("\n") ? newlineCount : newlineCount + 1;
}

function minifyCssValue(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*([,:])\s*/g, "$1");
}

function minifyCssParams(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function minifyCssSelector(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*([>+~,{])\s*/g, "$1");
}

function serializeMinifiedCssNode(node) {
  if (node.type === "comment") {
    return "";
  }

  if (node.type === "decl") {
    return `${node.prop.trim()}:${minifyCssValue(node.value)}${node.important ? "!important" : ""}`;
  }

  if (node.type === "rule") {
    return `${minifyCssSelector(node.selector)}{${serializeMinifiedCssNodes(node.nodes)}}`;
  }

  if (node.type === "atrule") {
    const params = minifyCssParams(node.params);
    const name = params ? `@${node.name} ${params}` : `@${node.name}`;

    if (node.nodes) {
      return `${name}{${serializeMinifiedCssNodes(node.nodes)}}`;
    }

    return `${name};`;
  }

  return "";
}

function serializeMinifiedCssNodes(nodes = []) {
  return nodes.map(serializeMinifiedCssNode).join("");
}

function minifyCss(css, from) {
  const root = postcss.parse(css, { from });

  return serializeMinifiedCssNodes(root.nodes);
}

function uniquePrivateSelectorTokens(selectors) {
  return [
    ...new Set(
      selectors.flatMap(
        (item) => item.selector.match(privateSelectorTokenPattern) ?? [],
      ),
    ),
  ].sort();
}

export function auditCss(css, from) {
  const root = postcss.parse(css, { from });
  const minifiedCss = minifyCss(css, from);
  const selectors = [];
  let declarationCount = 0;
  let tokenDeclarationCount = 0;
  const selectorCache = new WeakMap();

  root.walkRules((rule) => {
    if (
      rule.parent?.type === "atrule" &&
      /keyframes$/i.test(rule.parent.name)
    ) {
      return;
    }

    for (const selector of resolvedSelectorsForRule(rule, selectorCache)) {
      selectors.push(classifySelector(selector));
    }

    rule.each((node) => {
      if (node.type !== "decl") {
        return;
      }

      declarationCount += 1;

      if (node.prop.startsWith("--") || /var\(--/.test(node.value)) {
        tokenDeclarationCount += 1;
      }
    });
  });

  const privateSelectorTokens = uniquePrivateSelectorTokens(selectors);

  return {
    sourceBytes: Buffer.byteLength(css),
    minifiedBytes: Buffer.byteLength(minifiedCss),
    bytes: Buffer.byteLength(minifiedCss),
    lineCount: countLines(css),
    selectorCount: selectors.length,
    privateSelectorCount: selectors.filter((item) => item.privateKagiSelector)
      .length,
    privateSelectorTokenCount: privateSelectorTokens.length,
    privateSelectorTokens,
    structuralSelectorCount: selectors.filter(
      (item) => item.structuralDependency,
    ).length,
    modernSelectorCount: selectors.filter((item) => item.modernSelector).length,
    declarationCount,
    tokenDeclarationCount,
    selectors,
  };
}
