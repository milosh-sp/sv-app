import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "./popover";

describe("popover", () => {
  it("renders the header slots", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <Popover open>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>
            <PopoverHeader>
              <PopoverTitle>Title</PopoverTitle>
              <PopoverDescription>Body</PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>,
      );
    });
    expect(document.body.textContent).toContain("Title");
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
