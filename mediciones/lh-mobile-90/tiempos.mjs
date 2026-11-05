import { readFileSync } from "node:fs";

const lhr = JSON.parse(readFileSync(new URL("./lhr.json", import.meta.url), "utf8"));
const requests = lhr.audits["network-requests"].details.items;

function short(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`.slice(0, 140);
  } catch {
    return String(url).slice(0, 140);
  }
}

const interesting = requests.filter((item) => {
  const url = item.url || "";
  return (
    url.endsWith("/") ||
    url.includes("flora-landing.png") ||
    url.includes(".css") ||
    url.includes("font") ||
    url.includes(".woff") ||
    url.includes("manifest")
  );
});

for (const item of interesting) {
  console.log(
    [
      Math.round(item.networkRequestTime),
      Math.round(item.networkEndTime),
      item.transferSize,
      item.resourceSize,
      item.priority || "",
      item.resourceType,
      short(item.url),
    ].join("\t"),
  );
}

console.log("\n=== DOC LATENCY ===");
console.log(JSON.stringify(lhr.audits["document-latency-insight"].details, null, 2).slice(0, 3500));

console.log("\n=== LCP ELEMENT AUDIT ===");
const lcp = lhr.audits["largest-contentful-paint-element"];
console.log(JSON.stringify(lcp.details?.items, null, 2).slice(0, 2500));

console.log("\n=== RESPONSIVE IMAGES ===");
for (const item of lhr.audits["uses-responsive-images"].details?.items ?? []) {
  console.log(item.wastedBytes, item.totalBytes, short(item.url));
}
