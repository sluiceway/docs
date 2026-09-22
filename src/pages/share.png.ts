// The share image, rendered at build time. See src/lib/share-image.ts.
import type { APIRoute } from "astro";
import { shareImagePng } from "../lib/share-image";

export const GET: APIRoute = () =>
  new Response(shareImagePng(), { headers: { "content-type": "image/png" } });
