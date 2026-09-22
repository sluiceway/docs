// Heading levels without gaps. A page read from the action can skip a level: a section cut
// from under a heading the page title replaces, or a file that goes from ## to ####. Screen
// readers and search engines read the levels as the page's outline, so the loader shifts each
// heading up until it sits one level below the nearest heading above it that is shallower.
// It never makes a heading deeper, and the action's files stay as they are.

/**
 * The levels headings take on a page whose title is the h1, for headings at `depths` in
 * document order. `[3, 2, 4]` becomes `[2, 2, 3]`.
 */
export function levels(depths: number[]): number[] {
  // The open headings above the current one: their depth in the source and their new level.
  const open: { depth: number; level: number }[] = [{ depth: 1, level: 1 }];
  return depths.map((depth) => {
    while (open.length > 1 && (open.at(-1)?.depth ?? 1) >= depth) open.pop();
    const level = Math.min(depth, (open.at(-1)?.level ?? 1) + 1);
    open.push({ depth, level });
    return level;
  });
}

const HEADING = /<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g;

/**
 * The HTML with its h2 to h6 elements at gapless levels, and the new level of each, in
 * document order. An h1 in the HTML is left alone and does not count.
 */
export function shiftHeadings(html: string): { html: string; levels: number[] } {
  const depths = [...html.matchAll(HEADING)].map((m) => Number(m[1])).filter((depth) => depth > 1);
  const shifted = levels(depths);
  let at = 0;
  const out = html.replace(HEADING, (match, depth: string, attrs = "", inner: string) => {
    if (depth === "1") return match;
    const level = shifted[at++];
    return `<h${level}${attrs}>${inner}</h${level}>`;
  });
  return { html: out, levels: shifted };
}
