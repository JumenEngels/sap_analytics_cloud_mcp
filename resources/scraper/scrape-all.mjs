#!/usr/bin/env node
/**
 * Full scraper for SAP Analytics Cloud REST API documentation.
 * Visits every sub-page under the REST API guide and saves all content.
 *
 * Usage: node scraper/scrape-all.mjs
 * Output: resources/sac_rest_api_full_scraped.txt
 */
import puppeteer from "puppeteer";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../resources");
const OUTPUT_FILE = resolve(OUTPUT_DIR, "sac_rest_api_full_scraped.txt");

const ROOT_URL =
  "https://help.sap.com/docs/SAP_ANALYTICS_CLOUD/14cac91febef464dbb1efce20e3f1613/3ccfab3348dd407db089accb66cff9a2.html";

const BASE_PATH = "/docs/SAP_ANALYTICS_CLOUD/14cac91febef464dbb1efce20e3f1613/";

const CONCURRENCY = 3;
const PAGE_TIMEOUT = 45000;
const SETTLE_DELAY = 3000;

/**
 * Extract the actual topic content from a page, excluding nav sidebar.
 */
async function extractPageContent(page) {
  return page.evaluate(() => {
    function getText(el) {
      if (!el) return "";
      const tag = el.tagName?.toLowerCase() || "";

      // Skip elements that are navigation, breadcrumbs, toolbars, etc.
      if (["nav", "header", "footer", "aside", "script", "style", "svg"].includes(tag)) return "";
      const cls = (el.className || "").toString().toLowerCase();
      const role = (el.getAttribute("role") || "").toLowerCase();
      if (role === "navigation" || role === "toolbar") return "";
      if (cls.includes("sidebar") || cls.includes("treeview") || cls.includes("breadcrumb") ||
          cls.includes("nav-") || cls.includes("navigation") || cls.includes("toc")) return "";

      let result = "";
      const isBlock = [
        "div", "p", "h1", "h2", "h3", "h4", "h5", "h6",
        "li", "tr", "section", "article", "pre", "blockquote",
        "table", "thead", "tbody", "dt", "dd", "br",
      ].includes(tag);

      if (tag.match(/^h[1-6]$/)) {
        const level = parseInt(tag[1]);
        result += "\n" + "#".repeat(level) + " ";
      }
      if (tag === "li") result += "- ";
      if (tag === "td" || tag === "th") result += "| ";
      if (tag === "br") return "\n";

      if (tag === "pre") {
        const text = el.textContent?.trim() || "";
        if (text.length > 0) return "\n```\n" + text + "\n```\n";
      }
      if (tag === "code" && !el.closest("pre")) {
        return "`" + (el.textContent?.trim() || "") + "`";
      }

      if (el.children && el.children.length > 0) {
        for (const child of el.childNodes) {
          if (child.nodeType === 3) {
            result += child.textContent?.replace(/\s+/g, " ") || "";
          } else if (child.nodeType === 1) {
            result += getText(child);
          }
        }
      } else {
        result += el.textContent?.replace(/\s+/g, " ")?.trim() || "";
      }

      if (tag === "tr") result += " |\n";
      if (tag === "td" || tag === "th") result += " ";
      if (isBlock && !tag.match(/^h[1-6]$/)) result += "\n";

      return result;
    }

    // Strategy: Find the topic/article content, NOT the sidebar nav.
    // SAP Help Portal structure: the main content panel contains the topic text.
    // The sidebar contains the tree navigation.

    // Try to identify the actual topic content area
    let contentEl = null;
    let title = "";

    // Look for article or topic-specific containers
    const candidates = document.querySelectorAll("article, [class*='topic'], [class*='Topic'], [class*='content-panel'], [class*='ContentPanel'], section[class*='content']");
    for (const c of candidates) {
      const text = c.textContent?.trim() || "";
      // Should have substantial content and contain headings
      if (text.length > 200 && c.querySelector("h1, h2, h3")) {
        contentEl = c;
        break;
      }
    }

    // Fallback: look for the main > div structure but skip nav-like divs
    if (!contentEl) {
      const main = document.querySelector("[role='main'], main");
      if (main) {
        // Find the child div that has the most text and isn't navigation
        let bestChild = null;
        let bestLen = 0;
        for (const child of main.querySelectorAll(":scope > div, :scope > div > div")) {
          const cls = (child.className || "").toString().toLowerCase();
          if (cls.includes("nav") || cls.includes("tree") || cls.includes("sidebar")) continue;
          const len = child.textContent?.trim().length || 0;
          if (len > bestLen) {
            bestLen = len;
            bestChild = child;
          }
        }
        if (bestChild && bestLen > 100) {
          contentEl = bestChild;
        } else {
          contentEl = main;
        }
      }
    }

    if (!contentEl) contentEl = document.body;

    // Extract the first real heading as the title
    const h1 = contentEl.querySelector("h1");
    const h2 = contentEl.querySelector("h2");
    if (h1) {
      title = h1.textContent?.trim() || "";
    } else if (h2) {
      title = h2.textContent?.trim() || "";
    }

    // Clean up the title (remove "Version: Q4 2025..." etc.)
    title = title.replace(/Version:.*$/i, "").trim();
    if (!title || title === "SAP Analytics Cloud REST API") {
      // Try the page's meta description or <title>
      const metaTitle = document.querySelector("meta[name='title']")?.getAttribute("content") ||
                        document.querySelector("meta[property='og:title']")?.getAttribute("content") || "";
      if (metaTitle) title = metaTitle;
    }

    const rawContent = getText(contentEl);
    // Remove the repeated sidebar nav content: lines that start with "- " and match common nav patterns
    const lines = rawContent.split("\n");
    const filteredLines = [];
    let inNavBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Detect start of nav block: a sequence of "- " lines that look like nav links
      if (line.startsWith("- ") && line.length < 100) {
        // Check if this is part of a long list of nav items
        let navCount = 0;
        for (let j = i; j < Math.min(i + 30, lines.length); j++) {
          if (lines[j].trim().startsWith("- ") && lines[j].trim().length < 100) navCount++;
          else break;
        }
        // If it's a long nav-like list at the start, skip it
        if (navCount > 10 && i < 20) {
          inNavBlock = true;
        }
      }

      if (inNavBlock) {
        if (!line.startsWith("- ") && line.length > 0 && !line.match(/^(Home|SAP Analytics|English|…)/)) {
          inNavBlock = false;
          filteredLines.push(line);
        }
        continue;
      }

      // Skip common boilerplate
      if (line === "Provide feedback on our search" ||
          line === "View all" ||
          line.match(/^Version: Q\d+ \d+/) ||
          line === "English" ||
          line === "… " ||
          line === "- Home") continue;

      filteredLines.push(line);
    }

    const content = filteredLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

    return {
      title: title || "Untitled",
      content,
      length: content.length,
    };
  });
}

/**
 * Collect all documentation page URLs from the nav tree.
 */
async function collectAllLinks(page) {
  // Expand all tree nodes
  console.log("Expanding navigation tree...");
  for (let round = 0; round < 5; round++) {
    const expanded = await page.evaluate(() => {
      const buttons = document.querySelectorAll(
        '[aria-expanded="false"], .tree-node-toggle:not(.expanded), [class*="expand"]:not([class*="expanded"])'
      );
      let count = 0;
      for (const btn of buttons) {
        try { btn.click(); count++; } catch {}
      }
      return count;
    });
    if (expanded === 0) break;
    console.log(`  Round ${round + 1}: expanded ${expanded} nodes`);
    await new Promise(r => setTimeout(r, 1500));
  }
  await new Promise(r => setTimeout(r, 2000));

  // Collect links
  const links = await page.evaluate((basePath) => {
    const anchors = document.querySelectorAll("a[href]");
    const seen = new Set();
    const result = [];

    for (const a of anchors) {
      let href = a.getAttribute("href") || "";
      if (href.startsWith("/")) href = "https://help.sap.com" + href;
      if (!href.includes(basePath)) continue;

      const match = href.match(/\/([a-f0-9]{32})\.html/);
      if (!match) continue;

      const pageId = match[1];
      if (seen.has(pageId)) continue;
      seen.add(pageId);

      const text = a.textContent?.trim() || "";
      result.push({
        url: `https://help.sap.com/docs/SAP_ANALYTICS_CLOUD/14cac91febef464dbb1efce20e3f1613/${pageId}.html`,
        navTitle: text.substring(0, 200),
        pageId,
      });
    }
    return result;
  }, BASE_PATH);

  return links;
}

/**
 * Scrape a single page.
 */
async function scrapePage(browser, url, index, total) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: PAGE_TIMEOUT });
    await new Promise(r => setTimeout(r, SETTLE_DELAY));
    const content = await extractPageContent(page);
    const shortTitle = (content.title || "").substring(0, 60);
    console.log(`  [${index + 1}/${total}] OK ${shortTitle} (${content.length} chars)`);
    return content;
  } catch (err) {
    console.log(`  [${index + 1}/${total}] FAILED: ${err.message}`);
    return { title: url, content: `ERROR: ${err.message}`, length: 0 };
  } finally {
    await page.close();
  }
}

/**
 * Process pages in parallel batches.
 */
async function scrapeAllPages(browser, links) {
  const results = new Array(links.length);
  for (let i = 0; i < links.length; i += CONCURRENCY) {
    const batch = links.slice(i, i + CONCURRENCY);
    const promises = batch.map((link, j) =>
      scrapePage(browser, link.url, i + j, links.length)
    );
    const batchResults = await Promise.all(promises);
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = { ...links[i + j], ...batchResults[j] };
    }
  }
  return results;
}

// ─── Main ────────────────────────────────────────────────────────────

(async () => {
  console.log("Starting SAC REST API documentation scraper...\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    // Step 1: Load root page and collect all links
    console.log("Step 1: Loading root page and collecting navigation links...");
    const rootPage = await browser.newPage();
    await rootPage.goto(ROOT_URL, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    const links = await collectAllLinks(rootPage);
    await rootPage.close();

    console.log(`\nFound ${links.length} unique documentation pages.\n`);
    if (links.length === 0) {
      console.error("No links found!");
      process.exit(1);
    }

    // Step 2: Scrape all pages
    console.log("Step 2: Scraping all pages...\n");
    const results = await scrapeAllPages(browser, links);

    // Step 3: Write output
    console.log("\nStep 3: Writing output...");
    mkdirSync(OUTPUT_DIR, { recursive: true });

    let output = "";
    output += "=".repeat(80) + "\n";
    output += "SAP ANALYTICS CLOUD — REST API REFERENCE (FULL SCRAPED DOCUMENTATION)\n";
    output += `Scraped on: ${new Date().toISOString()}\n`;
    output += `Source: ${ROOT_URL}\n`;
    output += `Total pages: ${results.length}\n`;
    output += "=".repeat(80) + "\n\n";

    // Table of contents using nav titles
    output += "TABLE OF CONTENTS\n";
    output += "-".repeat(40) + "\n";
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const displayTitle = r.navTitle || r.title || r.pageId;
      output += `${i + 1}. ${displayTitle}\n`;
    }
    output += "\n" + "=".repeat(80) + "\n\n";

    // Full content
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const displayTitle = r.navTitle || r.title || "Untitled";
      output += "─".repeat(80) + "\n";
      output += `PAGE ${i + 1}: ${displayTitle}\n`;
      output += `URL: ${r.url}\n`;
      output += `Content length: ${r.length} chars\n`;
      output += "─".repeat(80) + "\n\n";
      output += r.content + "\n\n";
    }

    output += "\n" + "=".repeat(80) + "\n";
    output += "END OF DOCUMENTATION\n";
    output += "=".repeat(80) + "\n";

    writeFileSync(OUTPUT_FILE, output, "utf-8");

    const sizeMB = (Buffer.byteLength(output) / 1024 / 1024).toFixed(2);
    const totalChars = results.reduce((s, r) => s + r.length, 0);
    const smallPages = results.filter(r => r.length < 200).length;
    console.log(`\nDone! Written ${results.length} pages to:`);
    console.log(`  ${OUTPUT_FILE}`);
    console.log(`  Size: ${sizeMB} MB`);
    console.log(`  Total content: ${totalChars} chars`);
    console.log(`  Pages with <200 chars: ${smallPages} (these may be index/category pages)`);

  } finally {
    await browser.close();
  }
})();
