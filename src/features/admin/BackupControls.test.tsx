import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeEventSnapshot } from "../../test/fixtures";
import { BackupControls } from "./BackupControls";

describe("BackupControls", () => {
  it("exige de saisir exactement REINITIALISER et décrit ce qui est conservé", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn().mockResolvedValue(undefined);
    render(<BackupControls snapshot={makeEventSnapshot()} onReset={onReset} />);
    await user.click(screen.getByRole("button", { name: /préparer la réinitialisation/i }));
    expect(screen.getByText(/configuration.*médias.*conservés/i)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: /^réinitialiser$/i });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/saisissez reinitialiser/i), "REINITIALISER");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onReset).toHaveBeenCalledWith("event-1");
  });
});
