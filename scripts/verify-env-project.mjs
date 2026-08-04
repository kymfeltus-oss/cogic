import fs from "node:fs";

const path = new URL("../.env.local", import.meta.url);
const env = Object.fromEntries(
  fs
    .readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""),
      ];
    }),
);

function refFromJwt(jwt) {
  if (!jwt) return null;
  const p = jwt.split(".")[1];
  if (!p) return null;
  const j = JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  return j.ref || null;
}

function refFromUrl(u) {
  const m = (u || "").match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? m[1] : null;
}

const target = "wjlaaluonxiaxmytiqwi";
const urlRef = refFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
const anonRef = refFromJwt(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const svcRef = refFromJwt(env.SUPABASE_SERVICE_ROLE_KEY);

console.log("NEXT_PUBLIC_SUPABASE_URL —", env.NEXT_PUBLIC_SUPABASE_URL ? "PRESENT" : "MISSING");
console.log("NEXT_PUBLIC_SUPABASE_ANON_KEY —", env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "PRESENT" : "MISSING");
console.log("SUPABASE_SERVICE_ROLE_KEY —", env.SUPABASE_SERVICE_ROLE_KEY ? "PRESENT" : "MISSING");
console.log("URL_REF", urlRef);
console.log("ANON_REF", anonRef);
console.log("SVC_REF", svcRef);
console.log(
  "ENV PROJECT MATCH —",
  urlRef === target && anonRef === target && svcRef === target ? "PASS" : "FAIL",
);
