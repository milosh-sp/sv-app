import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "./avatar";

describe("avatar", () => {
  it("renders the badge and the overflow count", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <AvatarGroup>
          <Avatar>
            <AvatarImage src="/a.png" alt="" />
            <AvatarFallback>A</AvatarFallback>
            <AvatarBadge>1</AvatarBadge>
          </Avatar>
          <AvatarGroupCount>+2</AvatarGroupCount>
        </AvatarGroup>,
      );
    });
    expect(container.textContent).toContain("+2");
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
