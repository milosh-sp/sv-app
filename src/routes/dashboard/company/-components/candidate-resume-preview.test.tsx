import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

import { sampleResumeData } from "@/schema/resume/sample";

const queries = vi.hoisted(() => ({
  resume: {
    isPending: true,
    isError: false,
    data: undefined as
      | {
          id: string;
          name: string;
          slug: string;
          tags: string[];
          data: typeof sampleResumeData;
          isLocked: boolean;
        }
      | undefined,
  },
}));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { enabled?: boolean }) =>
    options.enabled === undefined ? queries.resume : { isPending: false, isError: false, data: [] },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    resume: { getBySlug: { queryOptions: () => ({ queryKey: ["resume"] }) } },
    verification: { getPublicStatus: { queryOptions: () => ({ queryKey: ["verification"] }) } },
  },
}));
vi.mock("@/components/resume/preview", () => ({
  ResumePreview: () => <div>preview</div>,
}));
vi.mock("react-zoom-pan-pinch", () => ({
  TransformWrapper: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TransformComponent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import { useResumeStore } from "@/components/resume/store/resume";

import { CandidateResumePreview } from "./candidate-resume-preview";

describe("candidate resume preview", () => {
  it("loads a resume into the store and shows an error when the query fails", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CandidateResumePreview username="ada" slug="sample" />);
    });
    expect(container.textContent).toContain("Loading resume");

    queries.resume = {
      isPending: false,
      isError: false,
      data: {
        id: "resume-1",
        name: "Ada",
        slug: "sample",
        tags: [],
        data: sampleResumeData,
        isLocked: false,
      },
    };
    await act(async () => {
      root.render(<CandidateResumePreview username="ada" slug="sample" />);
    });
    expect(useResumeStore.getState().resume?.id).toBe("resume-1");
    expect(container.textContent).toContain("preview");

    queries.resume = { isPending: false, isError: true, data: undefined };
    await act(async () => {
      root.render(<CandidateResumePreview username="ada" slug="sample" />);
    });
    expect(container.textContent).toContain("Could not load");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
