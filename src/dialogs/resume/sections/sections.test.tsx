import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

import type { CustomSectionType, SectionType } from "@/schema/resume/data";

import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";
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
  useLingui: () => ({
    i18n: {
      locale: "en-US",
      t: (message: { id?: string } | string) => (typeof message === "string" ? message : (message.id ?? "")),
    },
  }),
}));

vi.mock("@/integrations/orpc/client", () => ({
  orpc: { resume: { update: { call: vi.fn() } } },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/components/input/rich-input", () => ({
  RichInput: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea aria-label="rich" value={value ?? ""} onChange={(event) => onChange?.(event.target.value)} />
  ),
}));

import { useResumeStore } from "@/components/resume/store/resume";
import { useDialogStore } from "@/dialogs/store";

import { CreateAwardDialog, UpdateAwardDialog } from "./award";
import { CreateCertificationDialog, UpdateCertificationDialog } from "./certification";
import { CreateCoverLetterDialog, UpdateCoverLetterDialog } from "./cover-letter";
import { CreateCustomSectionDialog, UpdateCustomSectionDialog } from "./custom";
import { CreateEducationDialog, UpdateEducationDialog } from "./education";
import { CreateExperienceDialog, UpdateExperienceDialog } from "./experience";
import { CreateInterestDialog, UpdateInterestDialog } from "./interest";
import { CreateLanguageDialog, UpdateLanguageDialog } from "./language";
import { CreateProfileDialog, UpdateProfileDialog } from "./profile";
import { CreateProjectDialog, UpdateProjectDialog } from "./project";
import { CreatePublicationDialog, UpdatePublicationDialog } from "./publication";
import { CreateReferenceDialog, UpdateReferenceDialog } from "./reference";
import { CreateSkillDialog, UpdateSkillDialog } from "./skill";
import { CreateSummaryItemDialog, UpdateSummaryItemDialog } from "./summary-item";
import { CreateVolunteerDialog, UpdateVolunteerDialog } from "./volunteer";

const blankUrl = { url: "", label: "" };

type DialogCase = {
  name: string;
  section?: SectionType;
  type: CustomSectionType;
  label?: string;
  field: string;
  create: React.ComponentType<{ data?: { customSectionId?: string } }>;
  update: React.ComponentType<{ data: { item: Record<string, unknown>; customSectionId?: string } }>;
  item: (id: string) => Record<string, unknown>;
};

const cases = [
  {
    name: "award",
    section: "awards",
    type: "awards",
    label: "Title",
    field: "title",
    create: CreateAwardDialog,
    update: UpdateAwardDialog,
    item: (id: string) => ({
      id,
      hidden: false,
      title: "Old",
      awarder: "",
      date: "",
      website: blankUrl,
      description: "",
    }),
  },
  {
    name: "certification",
    section: "certifications",
    type: "certifications",
    label: "Title",
    field: "title",
    create: CreateCertificationDialog,
    update: UpdateCertificationDialog,
    item: (id: string) => ({
      id,
      hidden: false,
      title: "Old",
      issuer: "",
      date: "",
      website: blankUrl,
      description: "",
    }),
  },
  {
    name: "education",
    section: "education",
    type: "education",
    label: "School",
    field: "school",
    create: CreateEducationDialog,
    update: UpdateEducationDialog,
    item: (id: string) => ({
      id,
      hidden: false,
      school: "Old",
      degree: "",
      area: "",
      grade: "",
      location: "",
      period: "",
      website: blankUrl,
      description: "",
    }),
  },
  {
    name: "experience",
    section: "experience",
    type: "experience",
    label: "Company",
    field: "company",
    create: CreateExperienceDialog,
    update: UpdateExperienceDialog,
    item: (id: string) => ({
      id,
      hidden: false,
      company: "Old",
      position: "",
      location: "",
      period: "",
      website: blankUrl,
      description: "",
      roles: [],
    }),
  },
  {
    name: "interest",
    section: "interests",
    type: "interests",
    label: "Name",
    field: "name",
    create: CreateInterestDialog,
    update: UpdateInterestDialog,
    item: (id: string) => ({ id, hidden: false, icon: "", name: "Old", keywords: [] }),
  },
  {
    name: "language",
    section: "languages",
    type: "languages",
    label: "Language",
    field: "language",
    create: CreateLanguageDialog,
    update: UpdateLanguageDialog,
    item: (id: string) => ({ id, hidden: false, language: "Old", fluency: "", level: 0 }),
  },
  {
    name: "profile",
    section: "profiles",
    type: "profiles",
    label: "Network",
    field: "network",
    create: CreateProfileDialog,
    update: UpdateProfileDialog,
    item: (id: string) => ({ id, hidden: false, icon: "", network: "Old", username: "", website: blankUrl }),
  },
  {
    name: "project",
    section: "projects",
    type: "projects",
    label: "Name",
    field: "name",
    create: CreateProjectDialog,
    update: UpdateProjectDialog,
    item: (id: string) => ({ id, hidden: false, name: "Old", period: "", website: blankUrl, description: "" }),
  },
  {
    name: "publication",
    section: "publications",
    type: "publications",
    label: "Title",
    field: "title",
    create: CreatePublicationDialog,
    update: UpdatePublicationDialog,
    item: (id: string) => ({
      id,
      hidden: false,
      title: "Old",
      publisher: "",
      date: "",
      website: blankUrl,
      description: "",
    }),
  },
  {
    name: "reference",
    section: "references",
    type: "references",
    label: "Name",
    field: "name",
    create: CreateReferenceDialog,
    update: UpdateReferenceDialog,
    item: (id: string) => ({
      id,
      hidden: false,
      name: "Old",
      position: "",
      website: blankUrl,
      phone: "",
      description: "",
    }),
  },
  {
    name: "skill",
    section: "skills",
    type: "skills",
    label: "Name",
    field: "name",
    create: CreateSkillDialog,
    update: UpdateSkillDialog,
    item: (id: string) => ({ id, hidden: false, icon: "", name: "Old", proficiency: "", level: 0, keywords: [] }),
  },
  {
    name: "volunteer",
    section: "volunteer",
    type: "volunteer",
    label: "Organization",
    field: "organization",
    create: CreateVolunteerDialog,
    update: UpdateVolunteerDialog,
    item: (id: string) => ({
      id,
      hidden: false,
      organization: "Old",
      location: "",
      period: "",
      website: blankUrl,
      description: "",
    }),
  },
  {
    name: "summary",
    type: "summary",
    field: "content",
    create: CreateSummaryItemDialog,
    update: UpdateSummaryItemDialog,
    item: (id: string) => ({ id, hidden: false, content: "Old" }),
  },
  {
    name: "cover letter",
    type: "cover-letter",
    field: "content",
    create: CreateCoverLetterDialog,
    update: UpdateCoverLetterDialog,
    item: (id: string) => ({ id, hidden: false, recipient: "", content: "Old" }),
  },
] as unknown as DialogCase[];

function setNativeValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function fillLabel(label: string, value: string) {
  const match = [...document.querySelectorAll("label")].find((element) => element.textContent?.trim() === label);
  if (!match) throw new Error(`missing label ${label}`);
  const input = document.getElementById(match.htmlFor);
  if (!(input instanceof HTMLInputElement)) throw new Error(`missing input for ${label}`);
  setNativeValue(input, value);
}

function fillRich(value: string, label = "Content") {
  const match = [...document.querySelectorAll("label")].find((element) => element.textContent?.trim() === label);
  const item = match?.closest("[data-slot='form-item']");
  const input = item?.querySelector("textarea");
  if (!(input instanceof HTMLTextAreaElement)) throw new Error(`missing rich input for ${label}`);
  setNativeValue(input, value);
}

async function mount(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ConfirmDialogProvider>
        <Dialog open>{node}</Dialog>
      </ConfirmDialogProvider>,
    );
  });
  return () => {
    act(() => {
      root.unmount();
    });
    container.remove();
  };
}

async function submitForm() {
  const form = document.querySelector("form");
  if (!(form instanceof HTMLFormElement)) throw new Error("missing form");
  form.noValidate = true;
  await act(async () => {
    form.requestSubmit();
  });
}

function prepare(entry: DialogCase, existing?: Record<string, unknown>) {
  const data = structuredClone(defaultResumeData);
  data.customSections = [
    {
      id: "custom-1",
      type: entry.type,
      title: "Extra",
      columns: 1,
      hidden: false,
      items: existing && !entry.section ? [existing as never] : [],
    },
  ];
  if (entry.section) {
    data.sections[entry.section].items = existing ? [existing as never] : [];
  }
  useResumeStore.getState().initialize({
    id: "resume-1",
    name: "CV",
    slug: "cv",
    tags: [],
    data,
    isLocked: false,
  });
  useDialogStore.getState().openDialog("resume.create", undefined);
}

function readItems(entry: DialogCase, custom: boolean) {
  const data = useResumeStore.getState().resume.data;
  const items = custom || !entry.section ? data.customSections[0]?.items : data.sections[entry.section].items;
  return (items ?? []) as Array<Record<string, unknown>>;
}

const builtInCases = cases.filter((entry): entry is DialogCase & { section: SectionType; label: string } =>
  Boolean(entry.section && entry.label),
);
const customOnlyCases = cases.filter((entry) => !entry.section);

describe("resume section dialogs", () => {
  it.each(builtInCases)("$name writes the built-in section, the custom section, and an update", async (entry) => {
    prepare(entry);
    const unmountCreate = await mount(<entry.create />);
    fillLabel(entry.label, "New");
    await submitForm();
    expect(useDialogStore.getState().open).toBe(false);
    expect(readItems(entry, false).map((item) => item[entry.field])).toEqual(["New"]);
    expect(readItems(entry, true)).toEqual([]);
    unmountCreate();

    prepare(entry);
    const unmountCustom = await mount(<entry.create data={{ customSectionId: "custom-1" }} />);
    fillLabel(entry.label, "Custom");
    await submitForm();
    expect(readItems(entry, true).map((item) => item[entry.field])).toEqual(["Custom"]);
    expect(readItems(entry, false)).toEqual([]);
    unmountCustom();

    const existing = entry.item("item-1");
    prepare(entry, existing);
    const unmountUpdate = await mount(<entry.update data={{ item: existing }} />);
    fillLabel(entry.label, "Edited");
    await submitForm();
    const updated = readItems(entry, false);
    expect(updated).toHaveLength(1);
    expect(updated[0]?.[entry.field]).toBe("Edited");
    unmountUpdate();
  });

  it.each(customOnlyCases)("$name writes a custom section item and an update", async (entry) => {
    prepare(entry);
    const unmountCustom = await mount(<entry.create data={{ customSectionId: "custom-1" }} />);
    fillRich("Custom");
    await submitForm();
    expect(readItems(entry, true).map((item) => item[entry.field])).toEqual(["Custom"]);
    unmountCustom();

    const existing = entry.item("item-1");
    prepare(entry, existing);
    const unmountUpdate = await mount(<entry.update data={{ item: existing, customSectionId: "custom-1" }} />);
    fillRich("Edited");
    await submitForm();
    const updated = readItems(entry, true);
    expect(updated).toHaveLength(1);
    expect(updated[0]?.[entry.field]).toBe("Edited");
    unmountUpdate();
  });

  it("asks before closing a dirty award form and keeps the resume unchanged", async () => {
    const entry = cases[0];
    if (!entry) throw new Error("missing award case");
    prepare(entry);
    const unmount = await mount(<entry.create />);
    fillLabel("Title", "Unsaved");

    const cancel = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Cancel");
    await act(async () => {
      cancel?.click();
    });
    const leave = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Leave");
    expect(leave).toBeTruthy();
    await act(async () => {
      leave?.click();
    });

    expect(useDialogStore.getState().open).toBe(false);
    expect(readItems(entry, false)).toEqual([]);
    unmount();
  });

  it("creates and updates a custom section on the last page", async () => {
    const data = structuredClone(defaultResumeData);
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: "CV",
      slug: "cv",
      tags: [],
      data,
      isLocked: false,
    });
    useDialogStore.getState().openDialog("resume.create", undefined);

    const unmountCreate = await mount(<CreateCustomSectionDialog data={undefined} />);
    fillLabel("Title", "Contracts");
    await submitForm();
    const created = useResumeStore.getState().resume.data.customSections.at(-1);
    expect(created?.title).toBe("Contracts");
    expect(created?.type).toBe("experience");
    expect(useResumeStore.getState().resume.data.metadata.layout.pages.at(-1)?.main).toContain(created?.id);
    unmountCreate();

    if (!created) throw new Error("custom section was not created");
    useDialogStore.getState().openDialog("resume.create", undefined);
    const unmountUpdate = await mount(<UpdateCustomSectionDialog data={created} />);
    fillLabel("Title", "Freelance");
    await submitForm();
    expect(
      useResumeStore.getState().resume.data.customSections.find((section) => section.id === created.id)?.title,
    ).toBe("Freelance");
    unmountUpdate();
  });
});
