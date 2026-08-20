import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { resolveIntroEnterDestination } from "@/lib/experience/intro-destination";
import { INTRO_ENTER_PANEL, INTRO_VIDEO_ART, INTRO_VIDEO_SRC } from "@/lib/experience/intro-assets";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("intro plate uses intro mobile.png at native 941×1672", async () => {
  assert.match(INTRO_VIDEO_SRC, /intro%20mobile\.png/);
  assert.equal(INTRO_VIDEO_ART.width, 941);
  assert.equal(INTRO_VIDEO_ART.height, 1672);
  const assets = await source("lib/experience/intro-assets.ts");
  assert.match(assets, /24\.23/);
  assert.match(assets, /82\.835/);
  assert.match(assets, /43\.146/);
  assert.match(assets, /7\.895/);
  assert.equal(INTRO_ENTER_PANEL.left + INTRO_ENTER_PANEL.width <= 100, true);
  assert.equal(INTRO_ENTER_PANEL.top + INTRO_ENTER_PANEL.height <= 100, true);
});

test("intro Enter always goes to the attendee dashboard", () => {
  assert.equal(
    resolveIntroEnterDestination({
      userId: null,
      isGuest: false,
      hasActiveRegistration: false,
    }).destination,
    "/my-convocation",
  );
  assert.equal(
    resolveIntroEnterDestination({
      userId: "u1",
      isGuest: true,
      hasActiveRegistration: false,
    }).destination,
    "/my-convocation",
  );
  assert.equal(
    resolveIntroEnterDestination({
      userId: "u1",
      isGuest: false,
      hasActiveRegistration: false,
    }).destination,
    "/my-convocation",
  );
  assert.equal(
    resolveIntroEnterDestination({
      userId: "u1",
      isGuest: false,
      hasActiveRegistration: true,
    }).destination,
    "/my-convocation",
  );
});

test("intro experience wires Enter hit to measured panel and destination API", async () => {
  const [experience, api, css] = await Promise.all([
    source("components/intro/VideoIntroExperience.tsx"),
    source("app/api/intro/destination/route.ts"),
    source("app/globals.css"),
  ]);
  assert.match(experience, /INTRO_ENTER_PANEL/);
  assert.match(experience, /introRectStyle\(INTRO_ENTER_PANEL\)/);
  assert.match(experience, /\/api\/intro\/destination/);
  assert.doesNotMatch(experience, /<audio|\.play\(\)|intro-music/i);
  assert.match(api, /getUserFromSession/);
  assert.match(api, /getActiveRegistrationForUser/);
  assert.match(api, /resolveIntroEnterDestination/);
  const enterHit = css.match(/\.intro-flash-enter-hit\s*\{[^}]+\}/)?.[0] ?? "";
  assert.match(enterHit, /min-height:\s*0/);
  assert.doesNotMatch(enterHit, /min-height:\s*44px/);
});
