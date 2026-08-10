import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("mobile portrait artwork and clear live player preserve their intended footprints", async () => {
  const css = await readFile(
    path.join(process.cwd(), "app/my-convocation/dashboard.css"),
    "utf8",
  );

  assert.match(
    css,
    /\.cl-dash \.cl-mobile-home \.cl-live-stage\s*\{[\s\S]*?width:\s*calc\(100% \+ \(var\(--cl-mobile-pad-x\) \* 2\)\)[\s\S]*?height:\s*auto[\s\S]*?display:\s*grid/,
  );
  assert.match(
    css,
    /\.cl-dash \.cl-mobile-home \.cl-live-stage__viewport\s*\{[\s\S]*?position:\s*relative[\s\S]*?width:\s*100%[\s\S]*?aspect-ratio:\s*16\s*\/\s*9/,
  );
  assert.match(
    css,
    /\.cl-dashboard-media\s*\{[\s\S]*?width:\s*100%[\s\S]*?aspect-ratio:\s*9\s*\/\s*16/,
  );
  assert.match(
    css,
    /\.cl-dashboard-media__artwork\s*\{[\s\S]*?width:\s*100%[\s\S]*?height:\s*100%[\s\S]*?object-fit:\s*contain[\s\S]*?object-position:\s*top center/,
  );
  assert.doesNotMatch(css, /\.cl-dashboard-media__bishops\s*\{/);
  assert.match(
    css,
    /\.cl-mobile-home\s*\{[\s\S]*?padding:\s*clamp\(17rem,\s*104vw,\s*28rem\)/,
  );
  assert.match(
    css,
    /\.cl-dash \.cl-mobile-home \.cl-live-stage\s*\{[\s\S]*?border:\s*1px solid rgb\(201 162 39 \/ 28%\)/,
  );
  assert.match(css, /\.cl-live-stage__details\s*\{[\s\S]*?display:\s*grid/);
  assert.doesNotMatch(css, /cl-hero|my-sanctuary-hero/);
  assert.doesNotMatch(css, /@media\s*\(min-width|cl-desktop|cl-dashboard-desktop/);
});
