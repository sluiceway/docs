// Checks that .gitmodules names the tag the submodule is checked out at. Renovate reads the
// tag from the `branch` line of .gitmodules to find the next release, and moves the line and
// the submodule together. If a hand edit moves only one of them, this check fails.

import { execFileSync } from "node:child_process";
import { TAG } from "../src/lib/source";

const recorded = (() => {
  try {
    return execFileSync(
      "git",
      ["config", "--file", ".gitmodules", "--get", "submodule.vendor/sluiceway.branch"],
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
})();

if (recorded !== TAG) {
  console.error(
    `.gitmodules records ${recorded ? `branch = ${recorded}` : "no branch"} for vendor/sluiceway, ` +
      `but the submodule is checked out at ${TAG}. ` +
      `Run \`git submodule set-branch --branch ${TAG} vendor/sluiceway\`, or check the submodule out at the recorded tag.`,
  );
  process.exit(1);
}
console.log(`vendor/sluiceway is at ${TAG}, and .gitmodules says so.`);
