import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("credential server boundary contract", () => {
  it("keeps credential token/repository imports out of client components", () => {
    const clientRoots = [
      path.join(root, "components"),
      path.join(root, "app"),
    ];
    const offenders: string[] = [];

    for (const base of clientRoots) {
      for (const file of collectSourceFiles(base)) {
        const source = fs.readFileSync(file, "utf8");
        const isClient =
          source.includes('"use client"') || source.includes("'use client'");
        if (!isClient) continue;
        if (
          source.includes("@/lib/credentials/token") ||
          source.includes("@/lib/credentials/repository") ||
          source.includes("lib/credentials/token") ||
          source.includes("lib/credentials/repository")
        ) {
          offenders.push(path.relative(root, file));
        }
      }
    }

    assert.deepEqual(offenders, []);
  });

  it("marks repository and audit as server-only", () => {
    const repository = fs.readFileSync(
      path.join(root, "lib/credentials/repository.ts"),
      "utf8",
    );
    const audit = fs.readFileSync(
      path.join(root, "lib/credentials/audit.ts"),
      "utf8",
    );
    const token = fs.readFileSync(
      path.join(root, "lib/credentials/token.ts"),
      "utf8",
    );
    assert.match(repository, /import "server-only"/);
    assert.match(audit, /import "server-only"/);
    assert.match(token, /server boundary only/i);
    assert.match(token, /never be logged or persisted/i);
  });
});
