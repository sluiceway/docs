// Code highlighting themes for Expressive Code, built from the tokens. The design system's
// CodeBlock colours three things only: keys in `crate-deep`, strings and values in
// `water-deep`, comments in `ink-muted`. Everything else is `ink` on `surface-sunk`.

import tokens from "../styles/tokens.json" with { type: "json" };

type ThemeId = "light" | "dark";

function color(name: string, theme: ThemeId): string {
  const token = tokens.color.tokens.find((t) => t.name === name);
  const value = token?.value;
  if (typeof value === "string") return value;
  const v = value?.[theme];
  if (!v) throw new Error(`tokens.json has no ${theme} value for colour token "${name}"`);
  return v;
}

const KEY_SCOPES = [
  "entity.name.tag",
  "support.type.property-name",
  "meta.object-literal.key",
  "variable.other.property",
  "keyword",
  "storage",
];
const STRING_SCOPES = ["string", "constant", "support.constant", "entity.name.function"];
const COMMENT_SCOPES = ["comment", "punctuation.definition.comment"];

export function codeTheme(theme: ThemeId) {
  return {
    name: `sluiceway-${theme}`,
    type: theme,
    colors: {
      "editor.background": color("surface-sunk", theme),
      "editor.foreground": color("ink", theme),
    },
    tokenColors: [
      { settings: { foreground: color("ink", theme) } },
      { scope: KEY_SCOPES, settings: { foreground: color("crate-deep", theme) } },
      { scope: STRING_SCOPES, settings: { foreground: color("water-deep", theme) } },
      { scope: COMMENT_SCOPES, settings: { foreground: color("ink-muted", theme) } },
    ],
  };
}
