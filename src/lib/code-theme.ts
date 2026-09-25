// Code highlighting themes for Expressive Code, built from the tokens. The design system's
// CodeBlock colours three things only: keys in `crate-deep`, strings and values in
// `water-deep`, comments in `ink-muted`. Everything else is `ink` on `surface-sunk`.

import type { LanguageRegistration } from "shiki";
import tokens from "../styles/tokens.json" with { type: "json" };
import rego from "./grammars/rego.tmLanguage.json" with { type: "json" };

type ThemeId = "light" | "dark";

/**
 * Languages the action's docs fence that Shiki's bundle does not know. Rego, for the policies
 * page, comes from the grammar of the Open Policy Agent's VS Code extension (Apache-2.0), see
 * grammars/README.md. Without it the build warns and shows the block as plain text.
 */
export function extraLanguages(): LanguageRegistration[] {
  return [rego as unknown as LanguageRegistration];
}

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
