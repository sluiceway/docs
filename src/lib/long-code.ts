// Inline code that may wrap. A pass over rendered HTML, kept out of the loader so it can be
// tested without Astro.

/**
 * A tag with its attributes. A quoted value may hold `<` and `>`: the copy button of a code
 * block carries the block's code in `data-code`, and a code block that quotes a dashboard row
 * holds `<code>` and `</code>` as text there.
 */
const TAG = /(<\/?[a-zA-Z][^\s/>]*(?:\s+[^\s=/>]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*\/?>)/;

/**
 * Inline code stays on one line, so a stack id never breaks. The action's pages also quote
 * whole messages as code, which would push the page sideways on a phone: those may wrap.
 * Only a `<code>` element gets the class, never the text of an attribute, which a `"` in the
 * class would cut short.
 */
export function wrapLongCode(html: string): string {
  const pieces = html.split(TAG);
  for (let i = 0; i + 2 < pieces.length; i++) {
    if (
      pieces[i] === "<code>" &&
      pieces[i + 2] === "</code>" &&
      (pieces[i + 1]?.length ?? 0) >= 33
    ) {
      pieces[i] = '<code class="sw-code-long">';
    }
  }
  return pieces.join("");
}
