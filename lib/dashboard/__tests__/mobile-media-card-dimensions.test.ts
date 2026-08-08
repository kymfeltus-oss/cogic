import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("mobile banner and live player use the same outer dimensions", async () => {
  const css = await readFile(
    path.join(process.cwd(), "app/my-convocation/dashboard.css"),
    "utf8",
  );

  assert.match(css, /--cl-mobile-feature-height:\s*clamp\(/);
  assert.match(
    css,
    /\.cl-dash \.cl-mobile-home \.cl-hero,\s*\.cl-dash \.cl-mobile-home \.cl-live-stage\s*\{[^}]*width:\s*100%[^}]*height:\s*var\(--cl-mobile-feature-height\)/s,
  );
  assert.match(
    css,
    /\.cl-dash \.cl-mobile-home \.cl-live-stage__viewport\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0[^}]*width:\s*100%[^}]*height:\s*100%/s,
  );
  assert.match(css, /\.cl-dash \.cl-mobile-home \.cl-live-stage::after\s*\{/);
});
