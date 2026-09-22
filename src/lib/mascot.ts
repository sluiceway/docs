// Penny's header pictures from the action's assets/mascot, at the pinned tag. The files are
// served from the submodule at build time, so the picture on the page is the file the build
// checked, and nothing loads from raw.githubusercontent.com (which serves SVG as text/plain,
// so an <img> cannot show it).

import { existsSync } from "node:fs";
import { vendorPath } from "./source";

const files = import.meta.glob<string>("/vendor/sluiceway/assets/mascot/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

/** The URL of a header picture's light or dark file. Stops the build when it does not exist. */
export function mascotUrl(picture: string, theme: "light" | "dark"): string {
  const file = `assets/mascot/${picture}-${theme}.svg`;
  const src = files[`/vendor/sluiceway/${file}`];
  if (!existsSync(vendorPath(file)) || !src) {
    throw new Error(
      `vendor/sluiceway/${file} does not exist at the pinned tag. ` +
        `Use a stem from vendor/sluiceway/assets/mascot, such as "in-sync" or "pending-4".`,
    );
  }
  return src;
}
