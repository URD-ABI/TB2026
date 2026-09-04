import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("affiche le titre initial du tournoi", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /tournoi des arcanes/i })).toBeInTheDocument();
  });
});
