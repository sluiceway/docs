import { satteri } from "@astrojs/markdown-satteri";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { codeTheme } from "./src/lib/code-theme";
import { sidebar } from "./src/lib/pages";
// Importing the pin here makes every command fail at once when the submodule is missing or
// not on a tag, rather than halfway through a build.
import { TAG } from "./src/lib/source";
import { githubAlerts } from "./src/plugins/github-alerts";

// Moving the site to its own domain later is a change of these two values.
const site = process.env.DOCS_SITE || "https://sluiceway.github.io";
const base = process.env.DOCS_BASE ?? "/docs";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap";

export default defineConfig({
  site,
  base,
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
        { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" } },
        {
          tag: "link",
          attrs: { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: true },
        },
        { tag: "link", attrs: { rel: "stylesheet", href: FONTS } },
      ],
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
  ],
});
