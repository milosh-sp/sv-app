import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

import { useResumeStore } from "@/components/resume/store/resume";
import { defaultResumeData } from "@/schema/resume/data";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@lingui/react", () => ({
  useLingui: () => ({ i18n: { locale: "en-US", t: () => "", _: (message: { id?: string }) => message.id ?? "" } }),
}));
vi.mock("@/integrations/orpc/client", () => ({ orpc: { resume: { update: { call: vi.fn() } } } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/input/rich-input", () => ({
  RichInput: () => <textarea aria-label="rich" />,
}));
vi.mock("@/hooks/use-form-blocker", () => ({ useFormBlocker: () => ({ blockEvents: {} }) }));

import { DialogManager } from "./manager";
import { useDialogStore } from "./store";

const blankUrl = { url: "", label: "" };
const updates = [
  {
    type: "resume.sections.profiles.update",
    data: { item: { id: "p", hidden: false, icon: "", network: "GitHub", username: "ada", website: blankUrl } },
  },
  {
    type: "resume.sections.experience.update",
    data: {
      item: {
        id: "e",
        hidden: false,
        company: "Lab",
        position: "Eng",
        location: "",
        period: "",
        website: blankUrl,
        description: "",
        roles: [],
      },
    },
  },
  {
    type: "resume.sections.education.update",
    data: {
      item: {
        id: "ed",
        hidden: false,
        school: "U",
        degree: "",
        area: "",
        grade: "",
        location: "",
        period: "",
        website: blankUrl,
        description: "",
      },
    },
  },
  {
    type: "resume.sections.skills.update",
    data: { item: { id: "s", hidden: false, icon: "", name: "Math", proficiency: "", level: 1, keywords: [] } },
  },
  {
    type: "resume.sections.projects.update",
    data: { item: { id: "pr", hidden: false, name: "Engine", period: "", website: blankUrl, description: "" } },
  },
  {
    type: "resume.sections.certifications.update",
    data: { item: { id: "c", hidden: false, title: "Cert", issuer: "", date: "", website: blankUrl, description: "" } },
  },
  {
    type: "resume.sections.languages.update",
    data: { item: { id: "l", hidden: false, language: "English", fluency: "", level: 1 } },
  },
  {
    type: "resume.sections.publications.update",
    data: {
      item: { id: "pu", hidden: false, title: "Paper", publisher: "", date: "", website: blankUrl, description: "" },
    },
  },
  {
    type: "resume.sections.awards.update",
    data: {
      item: { id: "a", hidden: false, title: "Prize", awarder: "", date: "", website: blankUrl, description: "" },
    },
  },
  {
    type: "resume.sections.interests.update",
    data: { item: { id: "i", hidden: false, icon: "", name: "Chess", keywords: [] } },
  },
  {
    type: "resume.sections.volunteer.update",
    data: {
      item: {
        id: "v",
        hidden: false,
        organization: "RAS",
        location: "",
        period: "",
        website: blankUrl,
        description: "",
      },
    },
  },
  {
    type: "resume.sections.references.update",
    data: {
      item: { id: "r", hidden: false, name: "Charles", position: "", website: blankUrl, phone: "", description: "" },
    },
  },
  { type: "resume.sections.summary.update", data: { item: { id: "summary-1", hidden: false, content: "Old" } } },
  {
    type: "resume.sections.cover-letter.update",
    data: { item: { id: "letter-1", hidden: false, recipient: "", content: "Old" } },
  },
] as const;

describe("DialogManager", () => {
  it("renders every section update dialog", async () => {
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: "CV",
      slug: "cv",
      tags: [],
      data: structuredClone(defaultResumeData),
      isLocked: false,
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    for (const activeDialog of updates) {
      useDialogStore.setState({ open: true, activeDialog: activeDialog as never });
      await act(async () => {
        root.render(<DialogManager />);
      });
      expect(document.body.textContent?.length).toBeGreaterThan(0);
    }

    const custom = {
      id: "custom-1",
      type: "experience" as const,
      title: "Extra",
      columns: 1 as const,
      hidden: false,
      items: [],
    };
    useDialogStore.setState({ open: true, activeDialog: { type: "resume.sections.custom.update", data: custom } });
    await act(async () => {
      root.render(<DialogManager />);
    });
    expect(document.body.textContent).toContain("custom section");

    useDialogStore.setState({ open: true, activeDialog: null });
    await act(async () => {
      root.render(<DialogManager />);
    });
    expect(document.querySelector("[data-slot='dialog-content']")).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
