import { execSync } from "node:child_process";

process.env.CAPACITOR_BUILD = "true";

execSync("next build", { stdio: "inherit", env: process.env });
execSync("npx cap sync", { stdio: "inherit", env: process.env });
