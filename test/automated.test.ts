import { describe, expect, test } from "bun:test";
import { isAutomated, type Visitor } from "../src/lib/automated";

// The rule in src/lib/automated.ts, on the visitors Umami counted and on people.

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const EDGE_WINDOWS = `${CHROME_WINDOWS} Edg/140.0.0.0`;
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const CUBOT_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; CUBOT_X50) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";

const person = (userAgent: string, width = 1920, height = 1080): Visitor => ({
  webdriver: false,
  userAgent,
  screen: { width, height },
});

describe("a person is counted", () => {
  test.each([
    ["Chrome on Windows", person(CHROME_WINDOWS)],
    ["Edge on Windows", person(EDGE_WINDOWS, 1536, 864)],
    ["Safari on a Mac", person(SAFARI_MAC, 1512, 982)],
    ["Firefox on Linux", person(FIREFOX_LINUX, 2560, 1440)],
    ["Safari on an iPhone", person(IPHONE, 393, 852)],
    ["Chrome on a Cubot phone", person(CUBOT_ANDROID, 412, 915)],
    ["a screen of 600x800, turned", person(CHROME_WINDOWS, 600, 800)],
    ["a screen of 1024x768", person(CHROME_WINDOWS, 1024, 768)],
  ])("%s", (_, visitor) => {
    expect(isAutomated(visitor)).toBe(false);
  });
});

describe("a program is not counted", () => {
  test("a browser driven by automation", () => {
    expect(isAutomated({ ...person(CHROME_WINDOWS), webdriver: true })).toBe(true);
  });

  test.each([
    ["Googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
    ["Bingbot", "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"],
    ["Applebot", `${SAFARI_MAC} (Applebot/0.1; +http://www.apple.com/go/applebot)`],
    ["AhrefsBot", "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)"],
    ["DuckDuckBot", "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)"],
    [
      "Yahoo Slurp",
      "Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)",
    ],
    ["a crawler", "Mozilla/5.0 (compatible; SomeCrawler/1.0)"],
    ["a spider", "Baiduspider+(+http://www.baidu.com/search/spider.htm)"],
    ["GPTBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2)"],
    ["ClaudeBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0)"],
    ["headless Chrome", CHROME_WINDOWS.replace("Chrome/", "HeadlessChrome/")],
    ["PhantomJS", "Mozilla/5.0 (Unknown; Linux x86_64) AppleWebKit/538.1 PhantomJS/2.1.1"],
    ["Lighthouse", `${CHROME_WINDOWS} Chrome-Lighthouse`],
    ["Slack's link preview", "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"],
    ["Twitter's card", "Twitterbot/1.0"],
    [
      "LinkedIn's preview",
      "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
    ],
    ["Discord's embed", "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"],
    ["Telegram's preview", "TelegramBot (like TwitterBot)"],
    [
      "Facebook's preview",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    ],
    ["WhatsApp's preview", "WhatsApp/2.23.20.0 A"],
    ["Skype's preview", "Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Preview/0.5"],
    ["Bing's preview", `${CHROME_WINDOWS} BingPreview/1.0b`],
    [
      "Google's page renderer",
      `${CHROME_WINDOWS} Google-PageRenderer Google (+https://developers.google.com/+/web/snippet/)`,
    ],
    ["Embedly", "Mozilla/5.0 (compatible; Embedly/0.2; +http://support.embed.ly/)"],
    ["Iframely", "Iframely/1.3.1 (+https://iframely.com/docs/about)"],
  ])("%s", (_, userAgent) => {
    expect(isAutomated(person(userAgent))).toBe(true);
  });

  test.each([
    ["Chrome on Windows at 800x600", person(CHROME_WINDOWS, 800, 600)],
    ["Edge on Windows at 800x600", person(EDGE_WINDOWS, 800, 600)],
    ["Safari on a Mac at 800x600", person(SAFARI_MAC, 800, 600)],
    ["Chrome on Windows at 1024x1024", person(CHROME_WINDOWS, 1024, 1024)],
  ])("%s", (_, visitor) => {
    expect(isAutomated(visitor)).toBe(true);
  });
});
