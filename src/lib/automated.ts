// Whether this visit comes from a program rather than a person. Nearly every
// visit Umami counted besides the owner's was a headless crawler: a stock
// Chrome, Edge or Safari user agent on a screen of exactly 800x600 (once
// 1024x1024), no clicks, often the same page twice a day apart. Those are not
// counted. The same rule stands in sluiceway/landing and sluiceway/app; change
// the three together (src/content/docs/privacy.mdx says it in words).
//
// A visit is automated when any of these holds:
// - the browser says it is driven by automation (navigator.webdriver);
// - the user agent names a bot, a crawler, a spider, a headless browser or a
//   link preview service;
// - the screen is exactly 800x600 or 1024x1024, the sizes headless crawlers
//   report and no person's screen was seen at.

export type Visitor = {
  webdriver: boolean;
  userAgent: string;
  screen: { width: number; height: number };
};

// Bots, crawlers and spiders, headless browsers and the tools that drive
// them, and the services that fetch a page to show a preview of a link.
// "Cubot" is a phone maker, not a bot.
export const AUTOMATED_USER_AGENT =
  /(?<!cu)bot(?![a-z])|crawl|spider|slurp|headless|phantomjs|puppeteer|playwright|selenium|webdriver|lighthouse|preview|facebookexternalhit|facebookcatalog|embedly|iframely|whatsapp|skypeuripreview|google-pagerenderer|googleother|google-inspectiontool/i;

export const AUTOMATED_SCREENS: readonly (readonly [number, number])[] = [
  [800, 600],
  [1024, 1024],
];

export function isAutomated({ webdriver, userAgent, screen }: Visitor): boolean {
  if (webdriver) return true;
  if (AUTOMATED_USER_AGENT.test(userAgent)) return true;
  return AUTOMATED_SCREENS.some(
    ([width, height]) => screen.width === width && screen.height === height,
  );
}
