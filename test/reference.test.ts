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

test("a fixed value, a length limit, a flag and a sentence per tool read as they should", () => {
  const schema = {
    properties: {
      stacks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tool: { type: "string", enum: ["helm", "kubectl"] },
            dependsOn: { anyOf: [{ type: "string", const: "auto" }, { type: "array" }] },
            namespace: {
              type: "string",
              maxLength: 63,
              description:
                "helm: Passed with --namespace to every command. kubectl: The namespace of objects that name none.",
            },
          },
        },
      },
    },
  };
  const markdown = configReference(JSON.stringify(schema), {
    guideAnchors: new Map(),
    guideUrl: "/docs/guides/configuration/",
  });
  expect(markdown).toContain("- **Type:** `auto` or list");
  expect(markdown).toContain("- The value is at most 63 characters long.");
  expect(markdown).toContain(
    "* `helm`: Passed with `--namespace` to every command.\n* `kubectl`: The namespace of objects that name none.",
  );
});

test("modes and true or false in an action description are code", () => {
  const markdown = actionReference(
    [
      "inputs:",
      "  mode:",
      "    description: >-",
      "      What this step does. One of: scan, apply, check.",
      "  strict:",
      "    description: scan only. true turns the job red.",
      "outputs:",
      "  changed:",
      "    description: >-",
      "      Set by scan and apply. true when the body changed, false otherwise.",
    ].join("\n"),
  );
  expect(markdown).toContain("`scan` only. `true` turns the job red.");
  expect(markdown).toContain("Set by `scan` and `apply`. `true` when the body changed, `false`");
  expect(markdown).toContain("What this step does. One of: scan, apply, check.");
});

test("a description for two tools, or per value of the key, is one item per lead", () => {
  const schema = {
    properties: {
      stacks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tool: { type: "string", enum: ["opentofu", "terraform", "helm"] },
            wrapper: {
              type: "string",
              enum: ["terragrunt"],
              description:
                "opentofu and terraform: What stands in front. terragrunt: runs the tool there.",
            },
          },
        },
      },
    },
  };
  const markdown = configReference(JSON.stringify(schema), {
    guideAnchors: new Map(),
    guideUrl: "/docs/guides/configuration/",
  });
  expect(markdown).toContain(
    "* `opentofu` and `terraform`: What stands in front.\n* `terragrunt`: runs the tool there.",
  );
});

test("limits of a key that is a string or a mapping say which they are for", () => {
  const schema = {
    properties: {
      phase: {
        anyOf: [
          { type: "string", minLength: 1 },
          { type: "object", properties: { from: { type: "string" } }, required: ["from"] },
        ],
      },
    },
  };
  const markdown = configReference(JSON.stringify(schema), {
    guideAnchors: new Map(),
    guideUrl: "/docs/guides/configuration/",
  });
  expect(markdown).toContain("- A string is at least 1 character long.\n- A mapping needs `from`.");
});
