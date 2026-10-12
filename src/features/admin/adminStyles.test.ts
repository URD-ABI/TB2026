/// <reference types="node" />

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const adminStyles = readFileSync(resolve("src/features/admin/admin.css"), "utf8");

describe("admin score adjustment styles", () => {
  it("contient les champs numériques dans leurs colonnes et étend le bouton", () => {
    expect(adminStyles).toMatch(
      /\.score-controls__custom label\s*\{[^}]*min-width:\s*0;/s,
    );
    expect(adminStyles).toMatch(
      /\.score-controls__custom input\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;/s,
    );
    expect(adminStyles).toMatch(
      /\.score-controls__custom > button\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s,
    );
  });
});
