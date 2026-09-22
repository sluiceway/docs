// The generated references: sluiceway.yaml from the action's JSON schema, and the inputs and
// outputs from its action.yml. Both are Markdown, rendered like every other page. Nothing
// here is written by hand, so a key added in a release shows up without a change here.

interface SchemaNode {
  type?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  properties?: { [key: string]: SchemaNode };
  required?: string[];
  items?: SchemaNode;
  anyOf?: SchemaNode[];
  minLength?: number;
  minItems?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

export interface SchemaKey {
  /** The full dotted path, such as `stacks[].dependsOn`. */
  path: string;
  node: SchemaNode;
  /** Whether the object that holds the key requires it. */
  required: boolean;
}

/** Every key of the schema, depth first in schema order. */
export function schemaKeys(schema: SchemaNode, prefix = ""): SchemaKey[] {
  const keys: SchemaKey[] = [];
  const objects = (node: SchemaNode): SchemaNode[] =>
    node.properties ? [node] : (node.anyOf ?? []).filter((alt) => alt.properties);
  for (const [name, node] of Object.entries(schema.properties ?? {})) {
    const path = prefix ? `${prefix}.${name}` : name;
    keys.push({ path, node, required: schema.required?.includes(name) ?? false });
    for (const obj of objects(node)) keys.push(...schemaKeys(obj, path));
    if (node.items)
      for (const obj of objects(node.items)) keys.push(...schemaKeys(obj, `${path}[]`));
  }
  return keys;
}

function code(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const ticks = text.includes("`") ? "``" : "`";
  return `${ticks}${text}${ticks}`;
}

function typeName(node: SchemaNode): string {
  if (node.anyOf) return node.anyOf.map(typeName).join(" or ");
  if (node.type === "array") return node.items ? `list of ${typeName(node.items)}` : "list";
  if (node.type === "object") return "mapping";
  if (node.type === "integer") return "whole number";
  return node.type ?? "any";
}

/** The allowed values of a key, from `enum` on the key or on one of its alternatives. */
function allowed(node: SchemaNode): unknown[] {
  return [node, ...(node.anyOf ?? [])].flatMap((n) => n.enum ?? []);
}

/** Plain sentences for the limits the schema sets, on the key and on what it holds. */
function constraints(node: SchemaNode, what = "The value"): string[] {
  const out: string[] = [];
  const count = (n: number, word: string) =>
    `${n} ${n === 1 ? word : word === "entry" ? "entries" : `${word}s`}`;
  if (node.minLength) out.push(`${what} is at least ${count(node.minLength, "character")} long.`);
  if (node.minItems) out.push(`${what} holds at least ${count(node.minItems, "entry")}.`);
  if (node.pattern) out.push(`${what} matches ${code(node.pattern)}.`);
  if (node.minimum !== undefined) out.push(`${what} is at least ${node.minimum}.`);
  // The schema writes JavaScript's largest safe integer for "no upper limit".
  if (node.maximum !== undefined && node.maximum < Number.MAX_SAFE_INTEGER) {
    out.push(`${what} is at most ${node.maximum}.`);
  }
  if (node.type === "object" && node.required?.length) {
    out.push(`${what} needs ${node.required.map(code).join(" and ")}.`);
  }
  if (node.items) out.push(...constraints(node.items, "Each entry"));
  for (const alt of node.anyOf ?? []) {
    out.push(...constraints(alt, alt.type === "array" ? "A list" : what));
  }
  return [...new Set(out)];
}

export interface ConfigReferenceOptions {
  /** The configuration guide's heading id for a key, such as `dashboard.title`. */
  guideAnchors: Map<string, string>;
  /** The URL of the configuration guide. */
  guideUrl: string;
}

/** The sluiceway.yaml reference, one section per key with its full path as the heading. */
export function configReference(schemaJson: string, options: ConfigReferenceOptions): string {
  const schema = JSON.parse(schemaJson) as SchemaNode;
  const out: string[] = [];
  if (schema.description) out.push(schema.description, "");
  out.push(
    `Generated from the action's JSON schema. [Configuration](${options.guideUrl}) explains each key with examples.`,
  );
  for (const key of schemaKeys(schema)) {
    const depth = Math.min(4, 1 + key.path.split(".").length);
    const { node } = key;
    const facts: string[] = [`- **Type:** ${typeName(node)}`];
    if (key.required) facts.push("- **Required:** yes");
    if (node.default !== undefined) facts.push(`- **Default:** ${code(node.default)}`);
    const values = allowed(node);
    if (values.length > 0) facts.push(`- **Allowed values:** ${values.map(code).join(", ")}`);
    for (const line of constraints(node)) facts.push(`- ${line}`);
    const anchor = options.guideAnchors.get(key.path);
    if (anchor) facts.push(`- **In the guide:** [${key.path}](${options.guideUrl}#${anchor})`);
    out.push("", `${"#".repeat(depth)} ${code(key.path)}`, "");
    if (node.description) out.push(node.description, "");
    out.push(...facts);
  }
  return out.join("\n");
}

interface ActionYml {
  inputs?: {
    [name: string]: { description?: string; required?: boolean; default?: string };
  };
  outputs?: { [name: string]: { description?: string } };
}

/** The inputs and outputs of action.yml. */
export function actionReference(actionYml: string): string {
  const action = Bun.YAML.parse(actionYml) as ActionYml;
  const out: string[] = ["## Inputs", "", "Generated from the action's `action.yml`."];
  for (const [name, input] of Object.entries(action.inputs ?? {})) {
    out.push("", `### ${code(name)}`, "");
    if (input.description) out.push(input.description.trim(), "");
    out.push(`- **Required:** ${input.required ? "yes" : "no"}`);
    if (input.default !== undefined) out.push(`- **Default:** ${code(input.default)}`);
  }
  out.push("", "## Outputs", "", "Generated from the action's `action.yml`.");
  for (const [name, output] of Object.entries(action.outputs ?? {})) {
    out.push("", `### ${code(name)}`, "");
    if (output.description) out.push(output.description.trim());
  }
  return out.join("\n");
}

/** The input and output names of action.yml, for the test and the loader's check. */
export function actionNames(actionYml: string): { inputs: string[]; outputs: string[] } {
  const action = Bun.YAML.parse(actionYml) as ActionYml;
  return { inputs: Object.keys(action.inputs ?? {}), outputs: Object.keys(action.outputs ?? {}) };
}
