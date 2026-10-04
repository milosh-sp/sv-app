import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Reorder } from "motion/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vite-plus/test";

import { sampleResumeData } from "@/schema/resume/sample";

const mobile = vi.hoisted(() => ({ value: false }));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray | { message?: string }, ...values: Array<string | number>) => {
    if (!Array.isArray(strings)) return "message" in strings ? (strings.message ?? "") : "";
    return strings.reduce((result, part, index) => result + part + (values[index] ?? ""), "");
  },
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
  Plural: ({ one, other, value }: { one?: React.ReactNode; other?: React.ReactNode; value: number }) =>
    value === 1 ? one : other,
}));

vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    resume: { update: { call: vi.fn() } },
    storage: {
      uploadFile: {
        mutationOptions: () => ({
          mutationFn: async (file: File) => {
            if (file.name === "bad.png") throw new Error("upload failed");
            return { url: "https://example.com/picture.png" };
          },
        }),
      },
      deleteFile: { mutationOptions: () => ({ mutationFn: async () => undefined }) },
    },
    printer: {
      printResumeAsPDF: {
        mutationOptions: () => ({ mutationFn: async () => ({ url: "https://example.com/cv.pdf" }) }),
      },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => "toast"), dismiss: vi.fn() },
}));

vi.mock("react-zoom-pan-pinch", () => ({
  useControls: () => ({ zoomIn: vi.fn(), zoomOut: vi.fn(), centerView: vi.fn() }),
}));

vi.mock("@/integrations/auth/client", () => ({
  authClient: { useSession: () => ({ data: { user: { username: "ada" } } }) },
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mobile.value,
}));

vi.mock("@/components/ai/chat", () => ({
  AIChat: () => <div>chat</div>,
}));

import { useResumeStore } from "@/components/resume/store/resume";
import { useDialogStore } from "@/dialogs/store";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";
import { PromptDialogProvider } from "@/hooks/use-prompt";

import { BuilderDock } from "./-components/dock";
import { CustomSectionBuilder } from "./-sidebar/left/sections/custom";
import { PictureSectionBuilder } from "./-sidebar/left/sections/picture";
import { SectionItem } from "./-sidebar/left/shared/section-item";
import { SectionDropdownMenu } from "./-sidebar/left/shared/section-menu";
import { DesignSectionBuilder } from "./-sidebar/right/sections/design";
import { ExportSectionBuilder } from "./-sidebar/right/sections/export";
import { applyLayoutMove, LayoutPages } from "./-sidebar/right/sections/layout/pages";
import { TypographySectionBuilder } from "./-sidebar/right/sections/typography";

function clickText(text: string) {
  const button = [...document.querySelectorAll("button")].find((element) => element.textContent?.includes(text));
  if (!button) throw new Error(`missing button ${text}`);
  act(() => {
    button.click();
  });
}

function clickMenu(label: string, root: ParentNode = document) {
  const trigger = root.querySelector("[data-slot='dropdown-menu-trigger']");
  if (!(trigger instanceof HTMLElement)) throw new Error("missing menu");
  const before = new Set(document.querySelectorAll("[data-slot='dropdown-menu-item']"));
  act(() => {
    trigger.click();
  });
  const items = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].filter(
    (element) => !before.has(element) && element.textContent?.includes(label),
  );
  if (items.length === 0) throw new Error(`missing menu item ${label}`);
  for (const item of items) {
    if (!(item instanceof HTMLElement)) continue;
    act(() => {
      item.click();
    });
  }
}

describe("builder chrome", () => {
  it("reorders a column and moves a section into another column", () => {
    const pages = [
      { fullWidth: false, main: ["summary", "experience"], sidebar: ["skills"] },
      { fullWidth: false, main: ["education"], sidebar: [] },
    ];

    expect(applyLayoutMove(pages, "summary", "summary")).toBe(pages);
    expect(applyLayoutMove(pages, "missing", "experience")).toBe(pages);

    const reordered = applyLayoutMove(pages, "summary", "experience");
    expect(reordered[0]?.main).toEqual(["experience", "summary"]);
    expect(pages[0]?.main).toEqual(["summary", "experience"]);

    const moved = applyLayoutMove(pages, "summary", "page-0-sidebar");
    expect(moved[0]?.main).toEqual(["experience"]);
    expect(moved[0]?.sidebar).toEqual(["skills", "summary"]);

    const ontoEmpty = applyLayoutMove(pages, "education", "page-1-sidebar");
    expect(ontoEmpty[1]?.sidebar).toEqual(["education"]);
    expect(ontoEmpty[1]?.main).toEqual([]);

    const ontoSection = applyLayoutMove(pages, "education", "skills");
    expect(ontoSection[0]?.sidebar).toContain("education");
    expect(ontoSection[1]?.main).toEqual([]);
  });

  it("renders the sidebar editors and adds or deletes a layout page", async () => {
    const data = structuredClone(sampleResumeData);
    const sectionTypes = [
      "profiles",
      "education",
      "projects",
      "skills",
      "languages",
      "interests",
      "awards",
      "certifications",
      "publications",
      "volunteer",
      "references",
    ] as const;
    for (const type of sectionTypes) {
      const item = data.sections[type].items[0];
      if (!item) continue;
      data.customSections.push({
        title: type,
        columns: 1,
        hidden: false,
        id: `custom-${type}`,
        type,
        items: [structuredClone(item)],
      } as (typeof data.customSections)[number]);
    }
    data.customSections.push({
      title: "Summary",
      columns: 1,
      hidden: false,
      id: "custom-summary",
      type: "summary",
      items: [{ id: "sum-1", hidden: false, content: "<p>Short summary</p>" }],
    } as (typeof data.customSections)[number]);
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: data.basics.name,
      slug: "sample",
      tags: [],
      data,
      isLocked: false,
    });

    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const experience = data.sections.experience.items[0];
    if (!experience) throw new Error("sample resume has no experience");

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ConfirmDialogProvider>
            <PromptDialogProvider>
              <PictureSectionBuilder />
              <CustomSectionBuilder />
              <TypographySectionBuilder />
              <DesignSectionBuilder />
              <LayoutPages />
              <SectionDropdownMenu type="experience" />
              <Reorder.Group values={[experience]} onReorder={() => undefined}>
                <SectionItem
                  type="experience"
                  item={experience}
                  title={experience.company}
                  subtitle={experience.position}
                />
              </Reorder.Group>
            </PromptDialogProvider>
          </ConfirmDialogProvider>
        </QueryClientProvider>,
      );
    });

    const layoutItem = [...container.querySelectorAll("div")].find((element) =>
      element.className.includes("cursor-grab"),
    );
    if (layoutItem) {
      const down = new PointerEvent("pointerdown", { bubbles: true, clientX: 0, clientY: 0, pointerId: 1 });
      const move = new PointerEvent("pointermove", { bubbles: true, clientX: 0, clientY: 30, pointerId: 1 });
      const up = new PointerEvent("pointerup", { bubbles: true, clientX: 0, clientY: 30, pointerId: 1 });
      act(() => {
        layoutItem.dispatchEvent(down);
        layoutItem.dispatchEvent(move);
        document.dispatchEvent(up);
      });
    }

    expect(container.textContent).toContain(experience.company);
    expect(container.textContent).toContain("Pixel Forge Interactive");
    expect(container.textContent).toContain("Short summary");
    expect(container.querySelector("input")).toBeTruthy();

    const experienceMenu = [...container.querySelectorAll("[data-slot='dropdown-menu-trigger']")].at(-1);
    if (experienceMenu instanceof HTMLElement) {
      act(() => {
        experienceMenu.click();
      });
      for (const label of ["Add a new item", "Hide", "Rename", "Reset"]) {
        const item = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((element) =>
          element.textContent?.includes(label),
        );
        if (item instanceof HTMLElement) {
          act(() => {
            item.click();
          });
        }
      }
      const confirmReset = [...document.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Reset",
      );
      if (confirmReset instanceof HTMLButtonElement) {
        await act(async () => {
          confirmReset.click();
        });
      }
    }

    const customHeader = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("Experience") && button.textContent?.includes("item"),
    );
    if (!(customHeader instanceof HTMLButtonElement)) throw new Error("missing custom section header");
    act(() => {
      customHeader.click();
    });
    expect(useDialogStore.getState().activeDialog?.type).toBe("resume.sections.custom.update");
    const customMenu = customHeader?.parentElement?.querySelector("[data-slot='dropdown-menu-trigger']");
    if (customMenu instanceof HTMLElement) {
      for (const label of ["Hide", "Update", "Duplicate", "Delete"]) {
        act(() => {
          customMenu.click();
        });
        const item = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((element) =>
          element.textContent?.includes(label),
        );
        if (item instanceof HTMLElement) {
          act(() => {
            item.click();
          });
        }
      }
      const confirmDelete = [...document.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Delete",
      );
      if (confirmDelete instanceof HTMLButtonElement) {
        await act(async () => {
          confirmDelete.click();
        });
      }
    }

    const before = useResumeStore.getState().resume.data.metadata.layout.pages.length;
    clickText("Add Page");
    expect(useResumeStore.getState().resume.data.metadata.layout.pages).toHaveLength(before + 1);

    clickText("Delete Page");
    expect(useResumeStore.getState().resume.data.metadata.layout.pages).toHaveLength(before);

    const fullWidth = [...container.querySelectorAll("label")].find((label) =>
      label.textContent?.includes("Full Width"),
    );
    const fullWidthControl = fullWidth?.querySelector("button, input");
    if (fullWidthControl instanceof HTMLElement) {
      act(() => {
        fullWidthControl.click();
      });
    }

    const titleButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes(experience.company),
    );
    const trigger = titleButton?.parentElement?.querySelector("[data-slot='dropdown-menu-trigger']");
    if (trigger instanceof HTMLElement) {
      act(() => {
        trigger.click();
      });
      const hide = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((item) =>
        item.textContent?.includes("Hide"),
      );
      if (hide instanceof HTMLElement) {
        act(() => {
          hide.click();
        });
      }
    }

    const pictureBox = () => container.querySelector(".cursor-pointer");
    act(() => {
      pictureBox()?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const picture = pictureBox();
    if (picture instanceof HTMLElement) {
      act(() => {
        picture.click();
      });
    }
    const urlLabel = [...container.querySelectorAll("label")].find((label) => label.textContent?.trim() === "URL");
    const eye = urlLabel?.parentElement?.querySelector("button");
    if (eye instanceof HTMLButtonElement) {
      act(() => {
        eye.click();
      });
    }
    clickText("Add a new custom section");
    expect(useDialogStore.getState().activeDialog?.type).toBe("resume.sections.custom.create");

    for (const title of ["Square", "Landscape", "Portrait", "0pt", "10pt", "100pt"]) {
      const button = [...container.querySelectorAll("button")].find((item) => item.getAttribute("title") === title);
      if (!(button instanceof HTMLButtonElement)) continue;
      act(() => {
        button.click();
      });
    }

    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    for (const input of [...container.querySelectorAll("input[type='number']")]) {
      if (!(input instanceof HTMLInputElement) || !setValue) continue;
      act(() => {
        setValue.call(input, "40");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    for (const trigger of container.querySelectorAll("[data-slot='dropdown-menu-trigger']")) {
      if (!(trigger instanceof HTMLElement)) continue;
      act(() => {
        trigger.click();
      });
      const add = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((element) =>
        element.textContent?.includes("Add a new item"),
      );
      if (!(add instanceof HTMLElement)) continue;
      act(() => {
        add.click();
      });
      for (const label of ["Hide", "Rename", "Reset"]) {
        act(() => {
          trigger.click();
        });
        const item = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((element) =>
          element.textContent?.includes(label),
        );
        if (item instanceof HTMLElement) {
          act(() => {
            item.click();
          });
        }
      }
      const confirmReset = [...document.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Reset",
      );
      if (confirmReset instanceof HTMLButtonElement) {
        await act(async () => {
          confirmReset.click();
        });
      }
      break;
    }
    for (const trigger of container.querySelectorAll("[data-slot='dropdown-menu-trigger']")) {
      if (!(trigger instanceof HTMLElement)) continue;
      const before = new Set(document.querySelectorAll("[data-slot='dropdown-menu-item']"));
      act(() => {
        trigger.click();
      });
      const add = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find(
        (element) => !before.has(element) && element.textContent?.includes("Add a new item"),
      );
      if (!(add instanceof HTMLElement)) continue;
      act(() => {
        add.click();
      });
      act(() => {
        trigger.click();
      });
      const hide = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find(
        (element) => !before.has(element) && element.textContent?.includes("Hide"),
      );
      if (hide instanceof HTMLElement) {
        act(() => {
          hide.click();
        });
      }
      break;
    }

    const pictureInput = container.querySelector("input[type='file']");
    if (pictureInput instanceof HTMLInputElement) {
      const bad = new File(["img"], "bad.png", { type: "image/png" });
      Object.defineProperty(pictureInput, "files", {
        configurable: true,
        value: { 0: bad, length: 1, item: () => bad },
      });
      await act(async () => {
        pictureInput.dispatchEvent(new Event("change", { bubbles: true }));
      });
      const file = new File(["img"], "photo.png", { type: "image/png" });
      Object.defineProperty(pictureInput, "files", {
        configurable: true,
        value: { 0: file, length: 1, item: () => file },
      });
      await act(async () => {
        pictureInput.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }

    act(() => {
      root.unmount();
    });
    container.remove();
  }, 30_000);

  it("hides, duplicates, and deletes an experience item", async () => {
    const data = structuredClone(sampleResumeData);
    const experience = data.sections.experience.items[0];
    if (!experience) throw new Error("sample resume has no experience");
    data.sections.experience.items = [experience];
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: data.basics.name,
      slug: "sample",
      tags: [],
      data,
      isLocked: false,
    });

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ConfirmDialogProvider>
          <Reorder.Group values={[experience]} onReorder={() => undefined}>
            <SectionItem type="experience" item={experience} title={experience.company} />
          </Reorder.Group>
        </ConfirmDialogProvider>,
      );
    });

    clickMenu("Hide", container);
    expect(useResumeStore.getState().resume.data.sections.experience.items[0]?.hidden).toBe(true);
    clickMenu("New page", container);
    expect(useResumeStore.getState().resume.data.metadata.layout.pages.length).toBeGreaterThan(
      data.metadata.layout.pages.length,
    );
    clickMenu("Duplicate", container);
    expect(useDialogStore.getState().activeDialog?.type).toBe("resume.sections.experience.create");
    clickMenu("Delete", container);
    const confirmDelete = [...document.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Delete",
    );
    await act(async () => {
      confirmDelete?.click();
    });
    expect(useResumeStore.getState().resume.data.sections.experience.items).toEqual([]);
    act(() => {
      root.unmount();
    });
    container.remove();
  }, 30_000);

  it("moves an experience item onto another section and a new one", async () => {
    const data = structuredClone(sampleResumeData);
    const experience = data.sections.experience.items[0];
    if (!experience) throw new Error("sample resume has no experience");
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: data.basics.name,
      slug: "sample",
      tags: [],
      data,
      isLocked: false,
    });

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ConfirmDialogProvider>
          <Reorder.Group values={[experience]} onReorder={() => undefined}>
            <SectionItem type="experience" item={experience} title={experience.company} />
          </Reorder.Group>
        </ConfirmDialogProvider>,
      );
    });

    clickMenu("New section on page", container);
    expect(useResumeStore.getState().resume.data.customSections.length).toBeGreaterThan(data.customSections.length);

    act(() => {
      root.unmount();
    });
    container.remove();
  }, 30_000);

  it("renders the desktop and mobile docks", async () => {
    const data = structuredClone(sampleResumeData);
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: data.basics.name,
      slug: "sample",
      tags: [],
      data,
      isLocked: false,
    });

    const queryClient = new QueryClient();
    const container = document.createElement("div");
    const root = createRoot(container);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Blob(["%PDF"]))),
    );
    URL.createObjectURL = () => "blob:resume";
    URL.revokeObjectURL = () => undefined;

    for (const isMobile of [false, true]) {
      mobile.value = isMobile;
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <BuilderDock />
          </QueryClientProvider>,
        );
      });
      expect(container.querySelectorAll("button").length).toBeGreaterThan(2);
      expect(container.textContent).toContain("chat");

      for (const button of [...container.querySelectorAll("button")]) {
        if (!(button instanceof HTMLButtonElement) || button.disabled) continue;
        await act(async () => {
          button.click();
        });
      }

      const menu = container.querySelector("[data-slot='dropdown-menu-trigger']");
      if (menu instanceof HTMLElement) {
        act(() => {
          menu.click();
        });
        for (const item of [...document.querySelectorAll("[data-slot='dropdown-menu-item']")]) {
          if (!(item instanceof HTMLElement)) continue;
          await act(async () => {
            item.click();
          });
        }
      }
    }

    expect(vi.mocked(toast.success)).toHaveBeenCalled();
    vi.unstubAllGlobals();

    act(() => {
      root.unmount();
    });
  });

  it("hides and deletes an item stored on a custom section", async () => {
    const data = structuredClone(sampleResumeData);
    const section = data.customSections[0];
    const item = section?.items[0];
    if (!section || !item || !("company" in item)) throw new Error("missing custom experience");
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: data.basics.name,
      slug: "sample",
      tags: [],
      data,
      isLocked: false,
    });

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ConfirmDialogProvider>
          <Reorder.Group values={[item]} onReorder={() => undefined}>
            <SectionItem type="experience" customSectionId={section.id} item={item} title={item.company} />
          </Reorder.Group>
        </ConfirmDialogProvider>,
      );
    });

    const title = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes(item.company),
    );
    if (!(title instanceof HTMLButtonElement)) throw new Error("missing item title");
    act(() => {
      title.click();
    });
    expect(useDialogStore.getState().activeDialog?.type).toBe("resume.sections.experience.update");

    clickMenu("Duplicate", container);
    expect(useDialogStore.getState().activeDialog?.type).toBe("resume.sections.experience.create");

    clickMenu("Hide", container);
    expect(useResumeStore.getState().resume.data.customSections[0]?.items[0]?.hidden).toBe(true);

    clickMenu("Delete", container);
    const confirm = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Delete");
    if (!(confirm instanceof HTMLButtonElement)) throw new Error("missing delete confirmation");
    await act(async () => {
      confirm.click();
    });
    expect(useResumeStore.getState().resume.data.customSections[0]?.items.some((entry) => entry.id === item.id)).toBe(
      false,
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("downloads json, docx, and pdf from the export section", async () => {
    const data = structuredClone(sampleResumeData);
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: data.basics.name,
      slug: "sample",
      tags: [],
      data,
      isLocked: false,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Blob(["%PDF"]))),
    );
    const createObjectURL = vi.fn(() => "blob:resume");
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = () => undefined;

    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ExportSectionBuilder />
        </QueryClientProvider>,
      );
    });

    for (const label of ["JSON", "DOCX", "PDF"]) {
      const button = [...container.querySelectorAll("button")].find((element) => element.textContent?.includes(label));
      if (!(button instanceof HTMLButtonElement)) throw new Error(`missing ${label} export`);
      await act(async () => {
        button.click();
      });
    }

    expect(createObjectURL).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });
});
