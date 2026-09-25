// The examples on the command line page: each command the action's docs/command-line.md
// lists, what it prints, and what it prints with --json. The action's page says what each
// command does; this part shows it.
//
// Every example is what the command line at the pinned tag prints against the fake app of its
// own tests (test/cli/fake-app.ts), whose answers the action holds to the app's OpenAPI
// document. test/command-line.test.ts holds each app answer below to the copy of that document
// at the pinned tag, test/fixtures/app/openapi.json, so a field the app renames fails a test
// here.

export interface Example {
  /** The command, as typed. */
  command: string;
  /** What it prints without --json, or on stderr for a failure. */
  words?: string;
  /** What it prints with --json. */
  json?: unknown;
  /** The schema in the app's OpenAPI document that `json` is, when it is the app's answer as it came. */
  schema?: string;
  exit: number;
}

export interface ExampleGroup {
  /** The heading, a command in backticks. */
  heading: string;
  /** The sentences under the heading, Markdown. */
  intro: string;
  examples: Example[];
}

const COUNTS = { pending: 2, deploying: 1, drifted: 0, failed: 0, "in-sync": 1 };

const STACKS = [
  {
    stack: "site:prod",
    repo: "acme/infra",
    state: "in-sync",
    word: "in sync",
    destroys: false,
    line: "",
    at: null,
  },
  {
    stack: "network:prod",
    repo: "acme/infra",
    state: "pending",
    word: "pending",
    destroys: false,
    line: "1 update · from #12 by alice",
    at: null,
  },
  {
    stack: "apps/api:prod",
    repo: "acme/infra",
    state: "pending",
    word: "pending",
    destroys: true,
    line: "1 update, 1 replace · from #14 by bob",
    at: null,
  },
  {
    stack: "db:prod",
    repo: "acme/infra",
    state: "deploying",
    word: "queued",
    destroys: false,
    line: "ticked by carol",
    at: null,
  },
];

const ORG = { login: "acme", kind: "organization", page: "https://app.sluiceway.dev/acme" };

const REPO_LINE = {
  name: "acme/infra",
  page: "https://app.sluiceway.dev/acme/infra",
  dashboard: "https://github.com/acme/infra/issues/7",
  stacks: 4,
  counts: COUNTS,
  recordWriter: null,
};

const DASHBOARD = "https://github.com/acme/infra/issues/7";

export const EXAMPLES: ExampleGroup[] = [
  {
    heading: "`sluiceway login`",
    intro:
      "Asks for the token, checks it with the app, and says who it signs you in as and where it keeps the token.",
    examples: [
      {
        command: "sluiceway login",
        words: [
          "Signed in to https://app.sluiceway.dev as alice, for acme, with the token laptop, which works until 2026-12-25T00:00:00Z.",
          "The token is kept in the macOS keychain.",
        ].join("\n"),
        exit: 0,
      },
      {
        command: "sluiceway login --json < token.txt",
        json: {
          app: "https://app.sluiceway.dev",
          login: "alice",
          org: "acme",
          token: { name: "laptop", expiresAt: "2026-12-25T00:00:00Z" },
          kept: "the macOS keychain",
        },
        exit: 0,
      },
    ],
  },
  {
    heading: "`sluiceway status`",
    intro:
      "The org's stacks by state, the way the app's org view groups them. With a repo, the same for that repo, with its last scan and its dashboard.",
    examples: [
      {
        command: "sluiceway status",
        words: [
          "acme: 2 pending, 1 deploying, 1 in sync, 4 stacks",
          "Last scan: 0a1b2c3 of acme/infra at 2026-09-26T08:00:00Z",
          "",
          "Needs you",
          "  acme/infra  apps/api:prod  pending, deletes or replaces  1 update, 1 replace · from #14 by bob",
          "  acme/infra  network:prod  pending  1 update · from #12 by alice",
          "In flight",
          "  acme/infra  db:prod  queued  ticked by carol",
          "In sync",
          "  acme/infra  site:prod",
        ].join("\n"),
        exit: 0,
      },
      {
        command: "sluiceway status infra --json",
        schema: "Repo",
        json: {
          org: ORG,
          repo: REPO_LINE,
          scan: { sha: "0a1b2c3d4e5f", at: "2026-09-26T08:00:00Z", run: null },
          counts: COUNTS,
          total: 4,
          stacks: STACKS,
        },
        exit: 0,
      },
    ],
  },
  {
    heading: "`sluiceway stack`",
    intro:
      "One stack's row: its state, the counts in the dashboard's words, what it deletes or replaces, drift, the preview page on GitHub, the run of a deploy and the last deploy. A line with nothing to say is left out.",
    examples: [
      {
        command: "sluiceway stack infra network:prod",
        words: [
          "network:prod in acme/infra: pending",
          "1 update · from #12 by alice",
          "Changes: 1 update",
          "Preview: sluiceway / network:prod, on https://github.com/acme/infra/commit/0a1b2c3d/checks",
          `Dashboard: ${DASHBOARD}`,
        ].join("\n"),
        exit: 0,
      },
      {
        command: "sluiceway stack infra network:prod --json",
        schema: "Stack",
        json: {
          stack: "network:prod",
          repo: "acme/infra",
          state: "pending",
          word: "pending",
          line: "1 update · from #12 by alice",
          counts: {
            creates: 0,
            updates: 1,
            replaces: 0,
            deletes: 0,
            tracking: 0,
            changed: 0,
            gone: 0,
          },
          changes: "1 update",
          destroys: null,
          drift: null,
          ticked: false,
          failed: false,
          dashboard: DASHBOARD,
          preview: {
            name: "sluiceway / network:prod",
            url: "https://github.com/acme/infra/commit/0a1b2c3d/checks",
          },
          run: null,
          lastDeploy: null,
          at: "2026-09-26T08:00:00Z",
        },
        exit: 0,
      },
    ],
  },
  {
    heading: "`sluiceway tick`",
    intro:
      "Ticks the stack as you and stops once the app shows the deployment record. With `--json` the answer is two of the app's: `tick`, what the tick came to, and `deploy`, the record as the app showed it. The audit log's line for it says `via the command line`.",
    examples: [
      {
        command: "sluiceway tick infra network:prod",
        words: [
          "The tick of network:prod is asked: the deployment record is open.",
          "Deployment record 4242: waiting to start.",
          `The workflow deploys it through a fresh preview and the hash check, and the dashboard says how it went: ${DASHBOARD}`,
        ].join("\n"),
        exit: 0,
      },
      {
        command: "sluiceway tick infra network:prod --json",
        json: {
          tick: {
            outcome: "asked",
            sentence: "The tick of network:prod is asked: the deployment record is open.",
            deployment: {
              id: 4242,
              status: "https://app.sluiceway.dev/api/v1/orgs/acme/repos/infra/deployments/4242",
            },
            dashboard: DASHBOARD,
          },
          deploy: {
            deployment: 4242,
            stack: "network:prod",
            repo: "acme/infra",
            who: "ticked by alice via the command line",
            via: "via the command line",
            result: "waiting to start",
            state: "deploying",
            sha: "0a1b2c3d4e5f",
            run: "https://github.com/acme/infra/actions/runs/99",
            at: "2026-09-26T08:05:00Z",
            flagged: false,
            approvedBy: null,
          },
        },
        exit: 0,
      },
      {
        command: "sluiceway tick infra apps/api:prod --json",
        json: {
          error:
            "apps/api:prod deletes or replaces resources (1 replace). Run the tick again with --yes to deploy that.",
          code: "needs-yes",
          exit: 5,
        },
        exit: 5,
      },
    ],
  },
  {
    heading: "`sluiceway rescan`",
    intro:
      "Asks GitHub for a full scan of the repo, as Rescan in the app does. It deploys nothing.",
    examples: [
      {
        command: "sluiceway rescan infra",
        words: ["GitHub was asked for a full scan of acme/infra.", `Dashboard: ${DASHBOARD}`].join(
          "\n",
        ),
        exit: 0,
      },
      {
        command: "sluiceway rescan infra --json",
        schema: "RescanAnswer",
        json: {
          repo: "acme/infra",
          outcome: "asked",
          sentence: "GitHub was asked for a full scan of acme/infra.",
          dashboard: DASHBOARD,
        },
        exit: 0,
      },
    ],
  },
  {
    heading: "`sluiceway settings`",
    intro:
      "Without `set`, the keys a settings pull request may change and the values the file gives them. With `set`, the pull request it opened. A person merges it.",
    examples: [
      {
        command: "sluiceway settings infra",
        words: [
          "sluiceway.yaml of acme/infra at 0a1b2c3: https://github.com/acme/infra/blob/0a1b2c3d4e5f/sluiceway.yaml",
          "  dashboard.redact = false",
          '  tickers = "write"',
          "  drift.enabled = false",
        ].join("\n"),
        exit: 0,
      },
      {
        command: "sluiceway settings infra --json",
        schema: "Config",
        json: {
          repo: "acme/infra",
          file: "sluiceway.yaml",
          sha: "0a1b2c3d4e5f",
          url: "https://github.com/acme/infra/blob/0a1b2c3d4e5f/sluiceway.yaml",
          text: "dashboard:\n  redact: false\n",
          problem: null,
          keys: { "dashboard.redact": false, tickers: "write", "drift.enabled": false },
          pullRequest: {
            title: "Sluiceway: dashboard settings",
            branch: "sluiceway/dashboard",
            base: "main",
          },
        },
        exit: 0,
      },
      {
        command: "sluiceway settings infra set dashboard.redact=true",
        words: [
          "Opened pull request #31 on sluiceway.yaml.",
          "  dashboard.redact: false → true",
          "https://github.com/acme/infra/pull/31",
        ].join("\n"),
        exit: 0,
      },
      {
        command: "sluiceway settings infra set dashboard.redact=true --json",
        schema: "PullRequestAnswer",
        json: {
          outcome: "opened",
          pullRequest: 31,
          url: "https://github.com/acme/infra/pull/31",
          sentence: "Opened pull request #31 on sluiceway.yaml.",
          changes: ["dashboard.redact: false → true"],
          problems: [],
        },
        exit: 0,
      },
    ],
  },
  {
    heading: "`sluiceway logout`",
    intro:
      "Takes the token out of every place it is kept, and asks the app nothing. With `--json`, `removed` names those places.",
    examples: [
      {
        command: "sluiceway logout",
        words: [
          "Signed out of https://app.sluiceway.dev: the token is gone from the macOS keychain.",
          "It still works until it expires. Revoke it on https://app.sluiceway.dev/settings/tokens to stop it now.",
        ].join("\n"),
        exit: 0,
      },
    ],
  },
  {
    heading: "When it fails",
    intro:
      "Without `--json` the reason goes to stderr. With `--json` it is one document on stdout, and its `exit` is the exit code. The table below says what each one means.",
    examples: [
      {
        command: "sluiceway stack infra nope:prod --json",
        json: { error: "Not found.", code: "not-found", exit: 4 },
        exit: 4,
      },
      {
        command: "sluiceway status --json",
        json: {
          error:
            "Not signed in to https://app.sluiceway.dev. Make a token on https://app.sluiceway.dev/settings/tokens, then run sluiceway login.",
          code: "not-signed-in",
          exit: 3,
        },
        exit: 3,
      },
    ],
  },
];

function fence(lang: string, body: string): string {
  return `\`\`\`${lang}\n${body}\n\`\`\``;
}

function example(one: Example): string {
  const out = one.json === undefined ? (one.words ?? "") : JSON.stringify(one.json, null, 2);
  const code = one.exit === 0 ? "" : `\n# exit ${one.exit}`;
  return [
    fence("sh", `${one.command}${code}`),
    fence(one.json === undefined ? "text" : "json", out),
  ].join("\n\n");
}

/** The examples, as one h2 section of Markdown for the command line page. */
export function commandLineExamples(): string {
  const groups = EXAMPLES.map((group) =>
    [`### ${group.heading}`, group.intro, ...group.examples.map(example)].join("\n\n"),
  );
  return [
    "## Each command, by example",
    "The examples are for an org, `acme`, with one repo, `infra`, and four stacks: two pending, one queued and one in sync. Each command is shown with what it prints, and with `--json`, the app's answer as it came.",
    ...groups,
  ].join("\n\n");
}
