// The generated references hold every key of the schema and every input and output.

import { expect, test } from "bun:test";
import { readVendor } from "../src/lib/markdown";
import { githubSlug } from "../src/lib/pages";
import { actionNames, actionReference, configReference, schemaKeys } from "../src/lib/reference";

const schemaJson = readVendor("schema/sluiceway.schema.json", "test");
const actionYml = readVendor("action.yml", "test");

test("every schema key has a section headed by its full path", () => {
  const markdown = configReference(schemaJson, {
    guideAnchors: new Map(),
    guideUrl: "/docs/guides/configuration/",
  });
  const headings = new Set(
    markdown
      .split("\n")
      .filter((l) => /^#{2,4} /.test(l))
      .map((l) => l.replace(/^#+ `|`$/g, "")),
  );
  const keys = schemaKeys(JSON.parse(schemaJson)).map((k) => k.path);
  expect(keys).toContain("dashboard.title");
  expect(keys).toContain("stacks[].dependsOn");
  expect(keys).toContain("ignore[].reason");
  for (const key of keys) expect(headings).toContain(key);
  expect(new Set(keys.map(githubSlug)).size).toBe(keys.length);
});

test("a key links to its heading in the configuration guide", () => {
  const markdown = configReference(schemaJson, {
    guideAnchors: new Map([["dashboard.title", "dashboardtitle"]]),
    guideUrl: "/docs/guides/configuration/",
  });
  expect(markdown).toContain("[dashboard.title](/docs/guides/configuration/#dashboardtitle)");
});

test("every input and output of action.yml has a section", () => {
  const markdown = actionReference(actionYml);
  const { inputs, outputs } = actionNames(actionYml);
  expect(inputs).toContain("mode");
  expect(outputs).toContain("matrix");
  for (const name of [...inputs, ...outputs]) expect(markdown).toContain(`### \`${name}\``);
});
