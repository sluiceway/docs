// The named events, hooked onto the page with listeners on `document`, so neither Starlight's
// search nor Expressive Code's copy button is forked. Every event goes through
// `analytics.track()`, which drops it under Do Not Track. No event carries anything personal.

import type { Analytics } from "./analytics";

/** Links whose full address is worth sending. Every other external link sends its host only. */
const FULL_URL = [
  /^https:\/\/github\.com\/sluiceway\/sluiceway(?:[/?#]|$)/,
  /^https:\/\/github\.com\/marketplace\/actions\/sluiceway(?:[/?#]|$)/,
];

const SEARCH_PAUSE_MS = 1500;
const QUERY_MAX = 100;

export function watchEvents(analytics: Analytics): void {
  watchSearch(analytics);
  watchCopyCode(analytics);
  watchLinks(analytics);
}

/** `search`: once per query, when typing stops for 1.5 seconds or a result is opened. */
function watchSearch(analytics: Analytics): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = "";
  let lastSent = "";

  const send = () => {
    clearTimeout(timer);
    timer = undefined;
    const query = pending.trim().slice(0, QUERY_MAX);
    if (!query || query === lastSent) return;
    lastSent = query;
    analytics.track("search", { query, results: resultCount() });
  };

  document.addEventListener("input", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (!input.classList.contains("pagefind-ui__search-input")) return;
    pending = input.value;
    clearTimeout(timer);
    timer = setTimeout(send, SEARCH_PAUSE_MS);
  });

  document.addEventListener(
    "click",
    (event) => {
      if ((event.target as Element | null)?.closest?.(".pagefind-ui__result-link")) send();
    },
    true,
  );
}

/** Pagefind's own line, such as "5 results for deploy", holds the full count. */
function resultCount(): number {
  const message = document.querySelector(".pagefind-ui__message")?.textContent ?? "";
  const count = message.match(/\d+/);
  return count ? Number(count[0]) : 0;
}

/** `copy-code`: the page path and the block's title, else its language. */
function watchCopyCode(analytics: Analytics): void {
  document.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest?.(".expressive-code .copy button");
    if (!button) return;
    const frame = button.closest("figure");
    const title = frame?.querySelector(".header .title")?.textContent?.trim();
    const language = frame?.querySelector("pre")?.getAttribute("data-language") ?? "";
    analytics.track("copy-code", { path: location.pathname, block: title || language });
  });
}

/** `outbound` on external links, and any link's own event from `data-analytics-event`. */
function watchLinks(analytics: Analytics): void {
  const onClick = (event: MouseEvent) => {
    if (event.type === "auxclick" && event.button !== 1) return;
    const link = (event.target as Element | null)?.closest?.("a[href]");
    if (!(link instanceof HTMLAnchorElement)) return;
    const named = link.dataset.analyticsEvent;
    if (named) {
      analytics.track(named);
      return;
    }
    const url = new URL(link.href, location.href);
    if (!url.protocol.startsWith("http") || url.host === location.host) return;
    const full = FULL_URL.some((pattern) => pattern.test(url.href));
    analytics.track("outbound", full ? { url: url.href } : { host: url.host });
  };
  document.addEventListener("click", onClick);
  document.addEventListener("auxclick", onClick);
}
