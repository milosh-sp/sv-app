import { IconContext } from "@phosphor-icons/react";
import { act, type ContextType } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

import { sampleResumeData } from "@/schema/resume/sample";

import { useResumeStore } from "../store/resume";
import { PageIcon } from "./page-icon";
import { PageLink } from "./page-link";
import { PagePicture } from "./page-picture";
import { PageSection } from "./page-section";
import { PageSummary } from "./page-summary";

function mount(node: React.ReactNode) {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

function initResume() {
  const data = structuredClone(sampleResumeData);
  useResumeStore.getState().initialize({
    id: "resume-1",
    name: data.basics.name,
    slug: "sample",
    tags: [],
    data,
    isLocked: false,
  });
}

describe("page primitives", () => {
  it("hides an icon when it is missing or the icon context is hidden", () => {
    const missing = mount(<PageIcon icon="" />);
    expect(missing.container.innerHTML).toBe("");
    missing.unmount();

    const hidden = mount(
      <IconContext.Provider
        value={{ hidden: true, size: 16, color: "#000", weight: "regular" } as ContextType<typeof IconContext>}
      >
        <PageIcon icon="star" />
      </IconContext.Provider>,
    );
    expect(hidden.container.innerHTML).toBe("");
    hidden.unmount();
  });

  it("uses the url when a link has no label", () => {
    const link = mount(<PageLink url="https://example.com/path" />);
    expect(link.container.querySelector("a")?.textContent).toBe("https://example.com/path");
    link.unmount();

    const empty = mount(<PageLink url="" />);
    expect(empty.container.innerHTML).toBe("");
    empty.unmount();
  });

  it("hides an empty picture and paints a bordered hidden picture", () => {
    initResume();
    useResumeStore.setState((state) => {
      state.resume.data.picture.url = "";
    });
    const empty = mount(<PagePicture />);
    expect(empty.container.querySelector(".page-picture")).toBeNull();
    empty.unmount();

    useResumeStore.setState((state) => {
      state.resume.data.picture.url = "https://example.com/a.png";
      state.resume.data.picture.hidden = true;
      state.resume.data.picture.borderWidth = 2;
      state.resume.data.picture.shadowWidth = 4;
    });
    const picture = mount(<PagePicture />);
    const node = picture.container.querySelector(".page-picture");
    expect(node?.className).toContain("hidden");
    expect((node as HTMLElement).style.border).toContain("2pt");
    expect((node as HTMLElement).style.boxShadow).toContain("4pt");
    picture.unmount();
  });

  it("skips a hidden section and a section with no visible items", () => {
    initResume();
    useResumeStore.setState((state) => {
      state.resume.data.sections.awards.hidden = true;
    });
    const hidden = mount(<PageSection type="awards">{() => "award"}</PageSection>);
    expect(hidden.container.innerHTML).toBe("");
    hidden.unmount();

    useResumeStore.setState((state) => {
      state.resume.data.sections.awards.hidden = false;
      state.resume.data.sections.awards.items = [];
    });
    const empty = mount(<PageSection type="awards">{() => "award"}</PageSection>);
    expect(empty.container.innerHTML).toBe("");
    empty.unmount();
  });

  it("skips a hidden or empty summary", () => {
    initResume();
    useResumeStore.setState((state) => {
      state.resume.data.summary.hidden = true;
    });
    const hidden = mount(<PageSummary />);
    expect(hidden.container.innerHTML).toBe("");
    hidden.unmount();

    useResumeStore.setState((state) => {
      state.resume.data.summary.hidden = false;
      state.resume.data.summary.content = "";
    });
    const empty = mount(<PageSummary />);
    expect(empty.container.innerHTML).toBe("");
    empty.unmount();
  });
});
