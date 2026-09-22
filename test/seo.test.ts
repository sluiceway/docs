// The pieces behind the head tags: heading levels, breadcrumbs and record descriptions.

import { describe, expect, test } from "bun:test";
import { levels, shiftHeadings } from "../src/lib/headings";
import { recordDescription, records } from "../src/lib/pages";
import { breadcrumbs, type SidebarEntry, scriptJson } from "../src/lib/structured-data";

describe("levels", () => {
  const cases: [depths: number[], want: number[]][] = [
    [
      [2, 3, 2],
      [2, 3, 2],
    ],
    // A section under a heading the page title replaced.
    [
      [3, 2, 3],
      [2, 2, 3],
    ],
    // A file that goes from ## to ####.
    [
      [2, 4, 4, 3],
      [2, 3, 3, 3],
    ],
    [
      [2, 4, 5, 2],
      [2, 3, 4, 2],
    ],
    [
      [4, 4],
      [2, 2],
    ],
  ];
  test.each(cases)("%j", (depths, want) => {
    expect(levels(depths)).toEqual(want);
  });
});

test("shiftHeadings renames the elements and keeps their attributes", () => {
  const out = shiftHeadings('<h1>T</h1><h3 id="a">A <code>b</code></h3><p>x</p><h4>C</h4>');
  expect(out.html).toBe('<h1>T</h1><h2 id="a">A <code>b</code></h2><p>x</p><h3>C</h3>');
  expect(out.levels).toEqual([2, 3]);
});

describe("breadcrumbs", () => {
  const absolute = (href: string) => `https://docs.example${href}`;
  const home = { name: "Home", url: "https://docs.example/" };
  const sidebar = (current: string): SidebarEntry[] => {
    const link = (label: string, href: string): SidebarEntry => ({
      type: "link",
      label,
      href,
      isCurrent: href === current,
    });
    const group = (label: string, entries: SidebarEntry[]): SidebarEntry => ({
      type: "group",
      label,
      entries,
    });
    return [
      group("Start", [link("Overview", "/"), link("Get started", "/get-started/")]),
      group("Guides", [
        link("Configuration", "/guides/configuration/"),
        link("Security", "/guides/security/"),
      ]),
      group("Why", [link("All", "/why/"), group("One by one", [link("0001", "/why/0001/")])]),
    ];
  };
  const names = (current: string, name: string) =>
    breadcrumbs(sidebar(current), home, { name, url: absolute(current) }, absolute).map(
      (c) => c.name,
    );

  test("home, group, page", () => {
    expect(names("/guides/security/", "Security")).toEqual(["Home", "Guides", "Security"]);
  });
  test("a page nested deeper takes its top group", () => {
    expect(names("/why/0001/", "0001")).toEqual(["Home", "Why", "0001"]);
  });
  test("a group whose first page is the home page or the page itself is left out", () => {
    expect(names("/get-started/", "Get started")).toEqual(["Home", "Get started"]);
    expect(names("/guides/configuration/", "Configuration")).toEqual(["Home", "Configuration"]);
  });
  test("a page in no group", () => {
    expect(names("/style-check/", "Style check")).toEqual(["Home", "Style check"]);
  });
});

test("every record's description is 70 to 160 characters and holds its title", () => {
  for (const record of records()) {
    const description = recordDescription(record);
    expect(description.length, description).toBeGreaterThanOrEqual(70);
    expect(description.length, description).toBeLessThanOrEqual(160);
    expect(description).toContain(record.title);
  }
});

test("scriptJson cannot close its script element", () => {
  expect(scriptJson({ a: "</script>" })).toBe('{"a":"\\u003c/script>"}');
});
