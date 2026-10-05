import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

describe("dialog", () => {
  it("renders the trigger", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <Dialog open>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent showClose>
            <DialogHeader>
              <DialogTitle>Title</DialogTitle>
              <DialogDescription>Body</DialogDescription>
            </DialogHeader>
            <DialogFooter>Done</DialogFooter>
          </DialogContent>
        </Dialog>,
      );
    });
    expect(document.body.textContent).toContain("Open");
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
