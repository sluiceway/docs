// Serves the built site the way GitHub Pages does, for Lighthouse and for looking at a build:
// a directory is served from its index.html, a path to a directory without its trailing slash
// is redirected to it, and anything else gets 404.html with status 404. Text is gzipped and
// every file may be cached for ten minutes, as Pages does. The site sits under DOCS_BASE, as
// it does when deployed.
//
//   bun scripts/serve.ts [dir]    (default dist/, port PORT or 4321)

import { existsSync, statSync } from "node:fs";
import { join, normalize } from "node:path";

const root = process.argv[2] ?? "dist";
const base = (process.env.DOCS_BASE ?? "/docs").replace(/\/+$/, "");
const port = Number(process.env.PORT ?? 4321);

function file(path: string): string | undefined {
  return existsSync(path) && statSync(path).isFile() ? path : undefined;
}

const TEXT = /^(text\/|application\/(javascript|json|xml)|image\/svg\+xml)/;

async function send(path: string, request: Request, status = 200): Promise<Response> {
  const body = Bun.file(path);
  const headers: Record<string, string> = {
    "content-type": body.type,
    "cache-control": "max-age=600",
  };
  if (TEXT.test(body.type) && /\bgzip\b/.test(request.headers.get("accept-encoding") ?? "")) {
    headers["content-encoding"] = "gzip";
    const bytes = new Uint8Array(await body.arrayBuffer());
    return new Response(Bun.gzipSync(bytes), { status, headers });
  }
  return new Response(body, { status, headers });
}

const server = Bun.serve({
  port,
  fetch(request) {
    const url = new URL(request.url);
    const notFound = () => send(join(root, "404.html"), request, 404);
    if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return notFound();
    const rest = normalize(decodeURIComponent(url.pathname.slice(base.length)) || "/");
    if (rest.includes("..")) return notFound();
    const path = join(root, rest);
    if (existsSync(path) && statSync(path).isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        return Response.redirect(`${url.pathname}/${url.search}`, 301);
      }
      const index = file(join(path, "index.html"));
      return index ? send(index, request) : notFound();
    }
    const found = file(path) ?? file(`${path}.html`);
    return found ? send(found, request) : notFound();
  },
});

console.log(`Serving ${root} at http://localhost:${server.port}${base}/`);
