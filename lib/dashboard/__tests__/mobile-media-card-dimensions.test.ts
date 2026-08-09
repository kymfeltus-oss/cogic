import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("mobile portrait artwork, approved hero layer, and live player preserve their intended footprints", async () => {
  const css = await readFile(
    path.join(process.cwd(), "app/my-convocation/dashboard.css"),
    "utf8",
  );

  assert.match(css, /--cl-mobile-feature-aspect:\s*2160\s*\/\s*1280/);
  assert.match(
    css,
    /\.cl-dash \.cl-mobile-home \.cl-live-stage\s*\{[^}]*width:\s*100%[^}]*height:\s*auto[^}]*aspect-ratio:\s*var\(--cl-mobile-feature-aspect\)/s,
  );
  assert.match(
    css,
    /\.cl-dash \.cl-mobile-home \.cl-live-stage__viewport\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0[^}]*width:\s*100%[^}]*height:\s*100%/s,
  );
  assert.match(
    css,
    /\.cl-dashboard-media\s*\{[^}]*width:\s*100%[^}]*aspect-ratio:\s*9\s*\/\s*16/s,
  );
  assert.match(
    css,
    /\.cl-dashboard-media__artwork\s*\{[^}]*width:\s*100%[^}]*height:\s*100%[^}]*object-fit:\s*contain[^}]*object-position:\s*top center/s,
  );
  assert.match(
    css,
    /\.cl-dashboard-media__approved-reference\s*\{[^}]*top:\s*0[^}]*width:\s*100%[^}]*object-fit:\s*contain/s,
  );
  assert.match(css, /\.cl-mobile-home\s*\{[^}]*padding:\s*clamp\(25rem,\s*105vw,\s*28rem\)/s);
  assert.match(css, /\.cl-dash \.cl-mobile-home \.cl-live-stage::after\s*\{/);
  assert.doesNotMatch(css, /cl-hero|my-sanctuary-hero/);
  assert.doesNotMatch(css, /@media\s*\(min-width|cl-desktop|cl-dashboard-desktop/);
});
