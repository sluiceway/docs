import { satteri } from "@astrojs/markdown-satteri";
import sitemap from "@astrojs/sitemap";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { umamiWebsiteId } from "./src/lib/analytics-build";
import { codeTheme } from "./src/lib/code-theme";
import { sidebar } from "./src/lib/pages";
import { UNLISTED } from "./src/lib/site";
// Importing the pin here makes every command fail at once when the submodule is missing or
// not on a tag, rather than halfway through a build.
import { TAG } from "./src/lib/source";
import { githubAlerts } from "./src/plugins/github-alerts";

// Moving the site to its own domain later is a change of these two values.
const site = process.env.DOCS_SITE || "https://sluiceway.github.io";
const base = process.env.DOCS_BASE ?? "/docs";

// Throws on an empty PUBLIC_UMAMI_WEBSITE_ID, so analytics never goes off by accident.
// ANALYTICS_OFF=1 turns it off on purpose. The page scripts read the result, not the variable.
const umamiId = umamiWebsiteId(process.env);

const root = base.replace(/\/$/, "");
const unlisted = new Set(UNLISTED.map((id) => `${root}/${id}/`));

export default defineConfig({
  site,
  base,
  vite: {
    define: { "import.meta.env.PUBLIC_UMAMI_WEBSITE_ID": JSON.stringify(umamiId) },
  },
  markdown: {
    processor: satteri({ mdastPlugins: [githubAlerts] }),
  },
  integrations: [
    starlight({
      title: "Sluiceway",
      description: `Documentation for Sluiceway ${TAG}, the GitHub Action that deploys a stack when you tick its box.`,
      favicon: "/favicon-light.svg",
      head: [
        // Favicons can only follow the system setting, not the site's theme switch.
        ...(["light", "dark"] as const).map((theme) => ({
          tag: "link" as const,
          attrs: {
            rel: "icon",
            type: "image/svg+xml",
            href: `${base.replace(/\/$/, "")}/favicon-${theme}.svg`,
            media: `(prefers-color-scheme: ${theme})`,
          },
        })),
      ],
      // The fonts, the share image, the title rule and the JSON-LD.
      routeMiddleware: "./src/route-data.ts",
      customCss: [
        "./src/styles/tokens.css",
        "./src/styles/theme.css",
        "./src/styles/components.css",
        "./src/styles/content.css",
      ],
      sidebar: sidebar(),
      components: {
        SiteTitle: "./src/components/overrides/SiteTitle.astro",
        SocialIcons: "./src/components/overrides/SocialIcons.astro",
        Footer: "./src/components/overrides/Footer.astro",
        MarkdownContent: "./src/components/overrides/MarkdownContent.astro",
        Sidebar: "./src/components/overrides/Sidebar.astro",
        Hero: "./src/components/overrides/Hero.astro",
      },
      expressiveCode: {
        themes: [codeTheme("dark"), codeTheme("light")],
        styleOverrides: {
          borderRadius: "10px",
          borderWidth: "2.4px",
          borderColor: "var(--line)",
          codeBackground: "var(--surface-sunk)",
          codeFontFamily: "var(--font-mono)",
          codeFontSize: "14px",
          codeLineHeight: "24px",
          uiFontFamily: "var(--font-sans)",
          focusBorder: "var(--focus)",
          frames: {
            frameBoxShadowCssValue: "var(--shadow-pop)",
            editorTabBarBackground: "var(--surface-sunk)",
            editorTabBarBorderBottomColor: "var(--line)",
            editorActiveTabBackground: "var(--surface-sunk)",
            editorActiveTabForeground: "var(--ink)",
            editorActiveTabBorderColor: "transparent",
            editorActiveTabIndicatorTopColor: "transparent",
            editorActiveTabIndicatorBottomColor: "transparent",
            terminalTitlebarBackground: "var(--surface-sunk)",
            terminalTitlebarForeground: "var(--ink)",
            terminalTitlebarBorderBottomColor: "var(--line)",
            terminalBackground: "var(--surface-sunk)",
            inlineButtonForeground: "var(--ink)",
            inlineButtonBorder: "var(--line)",
          },
        },
      },
      lastUpdated: false,
      pagination: true,
    }),
    // In place of Starlight's own sitemap, to leave the unlisted pages out.
    sitemap({ filter: (page) => !unlisted.has(new URL(page).pathname) }),
  ],
});
