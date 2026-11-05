import { readFileSync } from "node:fs";

const insights = JSON.parse(readFileSync(new URL("./insights.json", import.meta.url), "utf8"));
const resumen = JSON.parse(readFileSync(new URL("./resumen.json", import.meta.url), "utf8"));

function walk(node, depth = 0, lines = []) {
  if (!node || typeof node !== "object") return lines;
  if (node.url || node.node) {
    lines.push({
      depth,
      url: node.url || node.node?.snippet || node.node?.nodeLabel || "",
      wasted: node.wastedBytes ?? node.wastedMs ?? null,
      total: node.totalBytes ?? node.transferSize ?? null,
      label: node.reason || node.subItems?.items?.map((item) => item.reason || item.signal || JSON.stringify(item)).join(" | ") || "",
    });
  }
  for (const child of node.children || node.items || node.chains || []) {
    if (child && typeof child === "object") walk(child, depth + 1, lines);
  }
  if (node.longestChain) walk(node.longestChain, depth, lines);
  return lines;
}

const image = insights["image-delivery-insight"];
console.log("\n=== IMAGE DELIVERY ===");
for (const item of image.items ?? []) {
  if (item.type === "table" || Array.isArray(item.items)) {
    for (const row of item.items ?? []) {
      const reasons = (row.subItems?.items ?? []).map((sub) => sub.reason || sub.label || JSON.stringify(sub)).join(" | ");
      console.log(
        [
          row.wastedBytes,
          row.totalBytes,
          reasons.slice(0, 180),
          String(row.url || "").slice(0, 180),
        ].join("\t"),
      );
    }
  } else if (item.url || item.wastedBytes) {
    console.log(JSON.stringify(item).slice(0, 400));
  }
}

console.log("\n=== RENDER BLOCKING INSIGHT ===");
console.log(JSON.stringify(insights["render-blocking-insight"].items, null, 2).slice(0, 4000));

console.log("\n=== LEGACY ===");
console.log(JSON.stringify(insights["legacy-javascript-insight"].items, null, 2).slice(0, 3000));

console.log("\n=== DOM INSIGHT ===");
console.log(JSON.stringify(insights["dom-size-insight"].items, null, 2).slice(0, 2500));
console.log("DOM AUDIT", JSON.stringify(resumen.dom).slice(0, 1500));

console.log("\n=== LCP BREAKDOWN ===");
console.log(JSON.stringify(insights["lcp-breakdown-insight"].items, null, 2).slice(0, 4000));

console.log("\n=== NETWORK TREE keys ===");
const tree = insights["network-dependency-tree-insight"];
console.log("item types", (tree.items ?? []).map((item) => item.type || Object.keys(item)));
console.log(JSON.stringify(tree.items, null, 2).slice(0, 5000));

console.log("\n=== LONG TASKS ===");
console.log(JSON.stringify(resumen.longTasks, null, 2));
console.log("\n=== BOOTUP ===");
console.log(JSON.stringify(resumen.bootup, null, 2));
console.log("\n=== MAIN ===");
console.log(JSON.stringify(resumen.mainThread, null, 2));
console.log("\n=== RENDER BLOCKING AUDIT ===");
console.log(JSON.stringify(resumen.renderBlocking, null, 2).slice(0, 2500));
