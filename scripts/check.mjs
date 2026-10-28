import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const html = fs.readFileSync("index.html", "utf8");
assert(html.includes("G-7BQ8R81F1M"), "Missing GA4 measurement ID");
assert(html.includes("data-portal-analytics"), "Missing portal-analytics script");
assert(html.includes("https://knucklebomb.poor.camp/"), "Missing canonical URL");
assert(fs.existsSync("portal-analytics.js"), "Missing portal-analytics.js");
assert(fs.existsSync("sitemap.xml"), "Missing sitemap.xml");
assert(fs.existsSync("robots.txt"), "Missing robots.txt");
assert(fs.existsSync(path.join("assets", "portal-preview.png")), "Missing portal-preview.png");
console.log("PASS: Knucklebomb static, analytics, and SEO verification.");
