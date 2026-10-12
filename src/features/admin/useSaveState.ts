import { useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useSaveState() {
  const [state, setState] = useState<SaveState>("idle");

  const run = async (action: () => Promise<void>): Promise<boolean> => {
    setState("saving");
    try {
      await action();
      setState("saved");
      return true;
    } catch {
      setState("error");
      return false;
    }
  };

  return { state, run };
}
