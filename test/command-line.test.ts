// The examples on the command line page keep to the app's contract at the pinned tag: every
// answer the app gives is held to the schema the action's copy of the app's OpenAPI document
// names for it, so a field the app renames or adds fails here and not on the page.

import { describe, expect, test } from "bun:test";
import { commandLineExamples, EXAMPLES } from "../src/lib/command-line";
import { readVendor } from "../src/lib/markdown";

type Schema = Record<string, unknown>;

const OPENAPI = JSON.parse(readVendor("test/fixtures/app/openapi.json", "test")) as {
  components: { schemas: Record<string, Schema> };
};

// The parts of JSON Schema the document uses, as the action's test/cli/fake-app.ts checks them.
function problems(value: unknown, schema: Schema, at = "$"): string[] {
  if (typeof schema.$ref === "string") {
    const target = OPENAPI.components.schemas[schema.$ref.replace("#/components/schemas/", "")];
    return target ? problems(value, target, at) : [`${at}: no schema ${schema.$ref}`];
  }
  if (Array.isArray(schema.anyOf)) {
    const fits = (schema.anyOf as Schema[]).some((one) => problems(value, one, at).length === 0);
    return fits ? [] : [`${at}: matches no anyOf`];
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    return [`${at}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`];
  }
  switch (schema.type) {
    case "string":
      return typeof value === "string" ? [] : [`${at}: not a string`];
    case "integer":
      return Number.isInteger(value) ? [] : [`${at}: not an integer`];
    case "boolean":
      return typeof value === "boolean" ? [] : [`${at}: not a boolean`];
    case "null":
      return value === null ? [] : [`${at}: not null`];
    case "array":
      if (!Array.isArray(value)) return [`${at}: not a list`];
      return value.flatMap((item, i) => problems(item, schema.items as Schema, `${at}[${i}]`));
    case "object": {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return [`${at}: not an object`];
      }
      const record = value as Record<string, unknown>;
      const properties = (schema.properties ?? {}) as Record<string, Schema>;
      const found = ((schema.required ?? []) as string[])
        .filter((key) => !(key in record))
        .map((key) => `${at}.${key}: missing`);
      for (const [key, item] of Object.entries(record)) {
        const property = properties[key];
        if (property) found.push(...problems(item, property, `${at}.${key}`));
        else if (schema.additionalProperties === false)
          found.push(`${at}.${key}: not in the schema`);
      }
      return found;
    }
    default:
      return [];
  }
}

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const all = EXAMPLES.flatMap((group) => group.examples);

describe("the command line examples", () => {
  test("every app answer fits its schema", () => {
    const answers = all.filter((one) => one.schema);
    expect(answers.length).toBeGreaterThan(3);
    for (const one of answers) {
      expect({ command: one.command, problems: problems(one.json, ref(one.schema ?? "")) }).toEqual(
        { command: one.command, problems: [] },
      );
    }
  });

  test("a tick's answer is the app's tick and the app's record", () => {
    const tick = all.find((one) => one.command === "sluiceway tick infra network:prod --json");
    const json = tick?.json as { tick: unknown; deploy: unknown };
    expect(problems(json.tick, ref("TickAnswer"))).toEqual([]);
    expect(problems(json.deploy, ref("Deploy"))).toEqual([]);
  });

  test("login's answer is the app's Me, with where it came from and where the token is kept", () => {
    const login = all.find((one) => one.command.startsWith("sluiceway login --json"));
    const { app, kept, ...me } = (login?.json ?? {}) as Record<string, unknown>;
    expect(typeof app).toBe("string");
    expect(typeof kept).toBe("string");
    expect(problems(me, ref("Me"))).toEqual([]);
  });

  test("a failure says its exit code, and the example exits with it", () => {
    const failures = all.filter((one) => one.exit !== 0);
    expect(failures.length).toBeGreaterThan(0);
    for (const one of failures) {
      if (one.json === undefined) continue;
      expect(Object.keys(one.json as object).sort()).toEqual(["code", "error", "exit"]);
      expect((one.json as { exit: number }).exit).toBe(one.exit);
    }
  });

  test("every command the action's page lists has an example", () => {
    const listed = [
      ...readVendor("docs/command-line.md", "test").matchAll(/^\| `sluiceway (\w+)/gm),
    ].map((m) => m[1]);
    const shown = new Set(all.map((one) => one.command.split(" ")[1]));
    expect(listed.length).toBeGreaterThan(0);
    for (const command of [...listed, "login", "logout"]) expect(shown).toContain(command);
  });

  test("the section is one h2 with one h3 per group", () => {
    const md = commandLineExamples();
    expect(md.match(/^## /gm)).toHaveLength(1);
    expect(md.match(/^### /gm)).toHaveLength(EXAMPLES.length);
  });
});
