import { describe, expect, it } from "vitest";
import seed from "../../supabase/seed.sql?raw";

describe("local team seed", () => {
  it("defines the approved team identities in display order", () => {
    expect(seed).toContain("'Gryffinzyme', '#D1495B', 'mountain', 0");
    expect(seed).toContain("'Slythermers', '#1F7A4D', 'constellation', 1");
    expect(seed).toContain("'Hufflespin', '#EDAE49', 'wind', 2");
    expect(seed).toContain("'Ravenflow', '#30638E', 'lightning', 3");
    expect(seed).toContain("'Order of the Phenol', '#7A3B69', 'flame', 4");
  });
});
