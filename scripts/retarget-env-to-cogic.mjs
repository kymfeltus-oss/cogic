/**
 * Retarget .env.local to Supabase project cogic (wjlaaluonxiaxmytiqwi).
 * Does not print secret values.
 */
import fs from "node:fs";

const path = ".env.local";
const anon =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqbGFhbHVvbnhpYXhteXRpcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MDM2OTQsImV4cCI6MjEwMTE3OTY5NH0.lXRofylSGEzVW2mSPKk9TmZfU8IYVpkVgEVY_YDP-z4";

let text = fs.readFileSync(path, "utf8");
text = text.replace(
  /^# Local development.*$/m,
  "# Local development — cogic (wjlaaluonxiaxmytiqwi)",
);
text = text.replace(
  /^NEXT_PUBLIC_SUPABASE_URL=.*$/m,
  "NEXT_PUBLIC_SUPABASE_URL=https://wjlaaluonxiaxmytiqwi.supabase.co",
);
text = text.replace(
  /^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*$/m,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
);
text = text.replaceAll("tezzihhkqlovynybaypu", "wjlaaluonxiaxmytiqwi");
text = text.replaceAll("vital-organs-entertainment", "cogic");
fs.writeFileSync(path, text);

function jwtRef(line) {
  const value = line.split("=").slice(1).join("=").trim();
  const payload = value.split(".")[1];
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64url").toString("utf8")).ref;
}

const lines = text.split(/\r?\n/);
const url = lines.find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_URL="));
const anonLine = lines.find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY="));
const svcLine = lines.find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="));

console.log(
  "URL_OK=" +
    String(url === "NEXT_PUBLIC_SUPABASE_URL=https://wjlaaluonxiaxmytiqwi.supabase.co"),
);
console.log("ANON_REF=" + jwtRef(anonLine));
console.log("SERVICE_REF=" + jwtRef(svcLine));
console.log(
  "SERVICE_NONEMPTY=" +
    String(svcLine.split("=").slice(1).join("=").trim().length > 20),
);
