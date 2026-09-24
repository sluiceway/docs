// Inline code that may wrap: only an element, never the text of an attribute.

import { expect, test } from "bun:test";
import { wrapLongCode } from "../src/lib/long-code";

const long = "deploys are turned off in sluiceway.yaml";

test("inline code of 33 characters or more may wrap, shorter code never", () => {
  expect(wrapLongCode(`<p><code>${long}</code> and <code>apps/web:prod</code></p>`)).toBe(
    `<p><code class="sw-code-long">${long}</code> and <code>apps/web:prod</code></p>`,
  );
});

test("the code a copy button carries in data-code is left alone", () => {
  // The block's own text is escaped; the attribute holds the same code raw.
  const code = `- [ ] **network:dev** <details><summary>4 changes</summary> <code>${long}</code><br></details>`;
  const escaped = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<pre><code>${escaped}</code></pre><button data-code="${code}"><div></div></button>`;
  const out = wrapLongCode(html);
  expect(out).toBe(
    `<pre><code class="sw-code-long">${escaped}</code></pre><button data-code="${code}"><div></div></button>`,
  );
});
