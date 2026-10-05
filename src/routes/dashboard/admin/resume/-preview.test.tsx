import { act, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: ReactNode }) => children ?? null,
}));
vi.mock("@/components/layout/loading-screen", () => ({
  LoadingScreen: () => <p>loading-screen</p>,
}));
vi.mock("@/components/resume/preview", () => ({
  ResumePreview: () => <p>resume-preview</p>,
}));

const store = vi.hoisted(() => ({
  isReady: false,
  initialize: vi.fn(),
}));
const loaded = vi.hoisted(() => ({
  resume: {
    id: "resume-1",
    name: "CV",
    slug: "cv",
    tags: [] as string[],
    data: { basics: { name: "Ada" } },
    isLocked: false,
  },
}));

vi.mock("@/components/resume/store/resume", () => ({
  useResumeStore: (selector: (state: typeof store) => unknown) => selector(store),
}));
vi.mock("@/integrations/orpc/client", () => ({
  getORPCClient: () => ({
    resume: {
      getByIdForPrinter: async ({ id }: { id: string }) => ({ ...loaded.resume, id }),
    },
  }),
}));

import { Route } from "./$resumeId";

describe("admin resume preview", () => {
  it("loads a resume, waits for the store, and navigates back", async () => {
    const loader = Route.options.loader;
    if (!loader) throw new Error("missing loader");
    await expect(loader({ params: { resumeId: "resume-9" } } as never)).resolves.toMatchObject({
      resume: { id: "resume-9" },
    });

    const navigate = vi.fn();
    vi.spyOn(Route, "useLoaderData").mockReturnValue({ resume: loaded.resume } as never);
    vi.spyOn(Route, "useNavigate").mockReturnValue(navigate as never);
    store.isReady = false;
    const Screen = Route.options.component as ComponentType & { preload?: () => Promise<void> };
    await Screen.preload?.();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<Screen />);
    });
    expect(container.textContent).toContain("loading-screen");
    expect(store.initialize).toHaveBeenCalledWith(loaded.resume);
    store.isReady = true;
    await act(async () => {
      root.render(<Screen />);
    });
    expect(container.textContent).toContain("resume-preview");
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Back to users"))?.click();
    });
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard/admin/users" });
    act(() => root.unmount());
    expect(store.initialize).toHaveBeenCalledWith(null);
    container.remove();
  });
});
