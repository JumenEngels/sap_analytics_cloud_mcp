#!/usr/bin/env node
/**
 * Quick test: load the SAC REST API docs root page and extract
 * the page content + navigation links.
 */
import puppeteer from "puppeteer";

const ROOT_URL =
  "https://help.sap.com/docs/SAP_ANALYTICS_CLOUD/14cac91febef464dbb1efce20e3f1613/3ccfab3348dd407db089accb66cff9a2.html";

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  console.log("Loading page...");
  await page.goto(ROOT_URL, { waitUntil: "networkidle2", timeout: 60000 });

  // Wait for content to render
  await page.waitForSelector("body", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 3000)); // extra wait for SPA

  // Extract all links that look like doc pages (same base path)
  const links = await page.evaluate(() => {
    const anchors = document.querySelectorAll("a[href]");
    const result = [];
    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      const text = a.textContent?.trim() || "";
      if (href.includes("14cac91febef464dbb1efce20e3f1613") || href.includes("/docs/SAP_ANALYTICS_CLOUD")) {
        result.push({ href, text: text.substring(0, 120) });
      }
    }
    return result;
  });

  console.log(`\nFound ${links.length} doc links:\n`);
  for (const l of links) {
    console.log(`  ${l.text}`);
    console.log(`    ${l.href}`);
  }

  // Also get the main content text
  const bodyText = await page.evaluate(() => {
    // Try common SAP Help content selectors
    const selectors = [
      ".documentation-content",
      ".concept-body",
      "[data-testid='content']",
      "main",
      "#content",
      ".content",
      "article",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 50) {
        return `[Selector: ${sel}] ${el.textContent.trim().substring(0, 2000)}`;
      }
    }
    return `[body] ${document.body.textContent?.trim().substring(0, 2000)}`;
  });

  console.log("\n\n=== PAGE CONTENT PREVIEW ===\n");
  console.log(bodyText);

  // Get the page title
  const title = await page.title();
  console.log(`\nPage title: ${title}`);

  // Dump full HTML structure for debugging
  const htmlSnippet = await page.evaluate(() => {
    return document.body.innerHTML.substring(0, 3000);
  });
  console.log("\n\n=== HTML STRUCTURE (first 3000 chars) ===\n");
  console.log(htmlSnippet);

  await browser.close();
})();
