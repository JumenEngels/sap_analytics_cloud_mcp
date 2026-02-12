#!/usr/bin/env node
/**
 * Quick test to find the right CSS selector for page content
 */
import puppeteer from "puppeteer";

const TEST_URL =
  "https://help.sap.com/docs/SAP_ANALYTICS_CLOUD/14cac91febef464dbb1efce20e3f1613/f89aca1af73e4798bf8df3804ac23092.html";

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  console.log("Loading stories page...");
  await page.goto(TEST_URL, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));

  // Try various selectors to find the content area
  const results = await page.evaluate(() => {
    const selectors = [
      ".documentation-content",
      "[class*='content-area']",
      "[class*='ContentArea']",
      "[class*='topic-content']",
      "[class*='TopicContent']",
      "[class*='doc-content']",
      "[class*='DocContent']",
      "[data-testid='content']",
      "[data-testid='topic-content']",
      "section.content",
      ".concept-body",
      ".task-body",
      "article",
      "[role='main']",
      "main article",
      "main section",
      "main > div",
      "main > div > div",
      "main > div > div > div",
    ];

    const out = {};
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        out[sel] = {
          count: els.length,
          textLen: els[0].textContent?.trim().length || 0,
          preview: els[0].textContent?.trim().substring(0, 200),
          classes: els[0].className,
          tagName: els[0].tagName,
        };
      }
    }

    // Also look at main's direct children
    const main = document.querySelector("main");
    if (main) {
      const children = main.children;
      out["main children"] = [];
      for (let i = 0; i < Math.min(children.length, 10); i++) {
        const c = children[i];
        out["main children"].push({
          tag: c.tagName,
          class: c.className?.substring(0, 80),
          textLen: c.textContent?.trim().length || 0,
          id: c.id,
        });
      }
    }

    return out;
  });

  console.log(JSON.stringify(results, null, 2));

  // Also try to get the rendered content structure
  const structure = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return "no main element";

    // Walk the tree to find the deepest large text container
    function walk(el, depth = 0) {
      const indent = "  ".repeat(depth);
      const text = el.textContent?.trim() || "";
      const tag = el.tagName?.toLowerCase() || "?";
      const cls = el.className ? `.${String(el.className).split(" ").join(".")}` : "";
      const id = el.id ? `#${el.id}` : "";
      let result = `${indent}<${tag}${id}${cls.substring(0, 50)}> textLen=${text.length}\n`;

      if (depth < 5) {
        for (const child of el.children) {
          result += walk(child, depth + 1);
        }
      }
      return result;
    }

    return walk(main);
  });

  console.log("\n=== DOM TREE ===\n");
  console.log(structure);

  await browser.close();
})();
