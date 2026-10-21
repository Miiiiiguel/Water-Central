// Renders every technique demo's keyframes (and its "common mistake"
// variant) to one HTML sheet, for eyeballing the poses after editing
// demos.ts:  npx tsx scripts/render-demos.tsx > demos.html
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { DEMOS } from "../src/components/technique/demos";
import { Figure } from "../src/components/technique/Figure";
import { reachReport, samplePath, solve, wrongPoses } from "../src/components/technique/rig";

const only = process.argv[2];
// Each renderToStaticMarkup call restarts useId, so make the SVG ids
// unique across the sheet or every figure would reuse the first defs.
let n = 0;
const uniq = (html: string) => html.replaceAll("_R_0_", `f${n++}`);
const cells: string[] = [];
for (const [id, demo] of Object.entries(DEMOS)) {
  if (only && !id.includes(only)) continue;
  const issues = reachReport(demo).filter(r => r.issues.length);
  const trail = samplePath(demo, demo.poses);
  const frames = demo.poses.map((p, i) =>
    uniq(renderToStaticMarkup(
      createElement(Figure, { demo, s: solve(demo, p), trail: i === 0 ? trail : undefined })
    ))
  );
  const bad = demo.wrong
    ? wrongPoses(demo).map(p =>
        uniq(renderToStaticMarkup(createElement(Figure, { demo, s: solve(demo, p), wrong: true })))
      )
    : [];
  cells.push(`<section><h3>${id} ${issues.length ? `<b>${JSON.stringify(issues)}</b>` : ""}</h3><div class="row">${[...frames, ...bad]
    .map(f => `<div class="f">${f}</div>`)
    .join("")}</div></section>`);
}
console.log(`<!doctype html><html><body style="background:#07090f;color:#fff;font:12px sans-serif;margin:0;padding:8px">
<style>.row{display:flex;gap:6px;flex-wrap:wrap}.f{width:260px;background:#0b0f17;border:1px solid #222}.f svg{width:100%;height:auto;display:block}h3{margin:10px 0 4px}b{color:#ff5a5a}</style>
${cells.join("")}</body></html>`);
