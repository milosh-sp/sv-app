import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "./alert";

describe("alert", () => {
  it("renders the action", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <Alert>
          <AlertTitle>Title</AlertTitle>
          <AlertDescription>Body</AlertDescription>
          <AlertAction>Go</AlertAction>
        </Alert>,
      );
    });
    expect(container.textContent).toContain("Go");
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
