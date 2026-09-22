// The image that links to the docs show when they are shared: Penny's `in-sync` header in
// light, from the action's assets/mascot at the pinned tag, on a 1200 by 630 ground. The
// picture is scaled to the full width without stretching. Above and behind it is `surface`,
// the white of the GitHub issue it is drawn for; below it `sky`, the colour of the quay the
// picture ends on, runs on to the bottom edge. The wordmark is in the picture as paths, so
// the rasteriser needs no font. Every build renders it again, so a new release of the art
// updates it.

import { Resvg } from "@resvg/resvg-js";
import tokens from "../styles/tokens.json";
import { readVendor } from "./markdown";

export const SHARE_IMAGE = {
  /** Under the site's base. */
  path: "share.png",
  width: 1200,
  height: 630,
  alt: "Sluiceway: Penny the sluice gate on a calm quay, every stack in sync",
  /** The picture it is made from, in assets/mascot. */
  picture: "in-sync-light.svg",
} as const;

/** Where the top of the picture sits, so the wordmark lands near the middle. */
const TOP = 250;

function token(name: string): string {
  const found = tokens.color.tokens.find((t) => t.name === name);
  if (!found) throw new Error(`src/styles/tokens.json has no colour "${name}".`);
  return found.value.light;
}

/** The composed SVG, before it is rendered. */
export function shareSvg(): string {
  const art = readVendor(`assets/mascot/${SHARE_IMAGE.picture}`, "The share image");
  const viewBox = /<svg\b[^>]*\bviewBox="0 0 (\d+) (\d+)"/.exec(art);
  if (!viewBox) {
    throw new Error(`assets/mascot/${SHARE_IMAGE.picture} has no viewBox starting at 0 0.`);
  }
  const { width, height } = SHARE_IMAGE;
  const scaled = (width * Number(viewBox[2])) / Number(viewBox[1]);
  // The picture's root element becomes a nested <svg>, placed and scaled on the ground.
  const placed = art.replace(/<svg\b[^>]*>/, (root) =>
    root
      .replace(/\s(width|height|x|y)="[^"]*"/g, "")
      .replace("<svg", `<svg x="0" y="${TOP}" width="${width}" height="${scaled}"`),
  );
  // The quay starts 2px inside the picture's own opaque quay, so no seam shows.
  const quay = TOP + scaled - 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${token("surface")}"/>`,
    `<rect y="${quay}" width="${width}" height="${height - quay}" fill="${token("sky")}"/>`,
    placed,
    "</svg>",
  ].join("");
}

/** The share image as PNG. */
export function shareImagePng(): Uint8Array<ArrayBuffer> {
  const resvg = new Resvg(shareSvg(), {
    font: { loadSystemFonts: false },
    fitTo: { mode: "original" },
  });
  return new Uint8Array(resvg.render().asPng());
}
