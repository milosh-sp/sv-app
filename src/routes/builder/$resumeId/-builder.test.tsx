import { i18n } from "@lingui/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Reorder } from "motion/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vite-plus/test";

import { sampleResumeData } from "@/schema/resume/sample";

const mobile = vi.hoisted(() => ({ value: false }));
const droppableOver = vi.hoisted(() => ({ value: false }));
const sessionState = vi.hoisted(() => ({
  data: { user: { username: "ada", name: "Ada Lovelace" } } as {
    user: { username?: string; name?: string; image?: string };
  } | null,
}));
const statisticsState = vi.hoisted(() => ({
  current: {
    isPublic: false,
    views: 2,
    downloads: 1,
    lastViewedAt: undefined as Date | undefined,
    lastDownloadedAt: undefined as Date | undefined,
  },
}));
const navigate = vi.hoisted(() => vi.fn(async () => undefined));
const cookies = vi.hoisted(() => new Map<string, string>());
const printResume = vi.hoisted(() => vi.fn(async () => ({ url: "https://example.com/cv.pdf" })));
const deleteUpload = vi.hoisted(() => vi.fn(async () => undefined));
const updateResume = vi.hoisted(() => vi.fn(async () => ({})));
const setResumePassword = vi.hoisted(() => vi.fn(async () => ({})));
const removeResumePassword = vi.hoisted(() => vi.fn(async () => ({})));
const deleteResume = vi.hoisted(() => vi.fn(async () => ({})));
const setLocked = vi.hoisted(() => vi.fn(async () => ({})));
const sharingResume = vi.hoisted(() => ({
  id: "resume-1",
  name: "Ada",
  slug: "sample",
  isPublic: true,
  hasPassword: true,
  data: undefined as unknown,
}));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray | { message?: string }, ...values: Array<string | number>) => {
    if (!Array.isArray(strings)) return "message" in strings ? (strings.message ?? "") : "";
    return strings.reduce((result, part, index) => result + part + (values[index] ?? ""), "");
  },
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
  plural: (value: number, forms: { one?: string; other?: string }) =>
    (value === 1 ? forms.one : forms.other)?.replace("#", String(value)) ?? "",
}));

vi.mock("@lingui/react", () => ({
  useLingui: () => ({
    i18n: {
      locale: "en-US",
      t: (message: unknown) => (typeof message === "string" ? message : ""),
      _: (message: unknown) => (typeof message === "string" ? message : ""),
    },
  }),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
  Plural: ({ one, other, value }: { one?: React.ReactNode; other?: React.ReactNode; value: number }) =>
    value === 1 ? one : other,
}));

vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    resume: {
      update: { call: vi.fn(), mutationOptions: () => ({ mutationFn: updateResume }) },
      getById: {
        queryOptions: () => ({ queryKey: ["resume", "get"], queryFn: async () => sharingResume }),
      },
      setPassword: { mutationOptions: () => ({ mutationFn: setResumePassword }) },
      removePassword: { mutationOptions: () => ({ mutationFn: removeResumePassword }) },
      delete: { mutationOptions: () => ({ mutationFn: deleteResume }) },
      setLocked: { mutationOptions: () => ({ mutationFn: setLocked }) },
      statistics: {
        getById: {
          queryOptions: () => ({
            queryKey: ["resume", "statistics"],
            queryFn: async () => statisticsState.current,
          }),
        },
      },
    },
    auth: {
      getAdminRole: {
        queryOptions: () => ({ queryKey: ["admin-role"], queryFn: async () => null }),
      },
    },
    verification: {
      getStatus: {
        queryOptions: () => ({ queryKey: ["verification"], queryFn: async () => [] }),
      },
    },
    storage: {
      uploadFile: {
        mutationOptions: () => ({
          mutationFn: async (file: File) => {
            if (file.name === "bad.png") throw new Error("upload failed");
            return { url: "https://example.com/picture.png" };
          },
        }),
      },
      deleteFile: { mutationOptions: () => ({ mutationFn: deleteUpload }) },
    },
    printer: {
      printResumeAsPDF: {
        mutationOptions: () => ({ mutationFn: printResume }),
      },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), loading: vi.fn(() => "toast"), dismiss: vi.fn() },
}));

vi.mock("react-zoom-pan-pinch", () => ({
  useControls: () => ({ zoomIn: vi.fn(), zoomOut: vi.fn(), centerView: vi.fn() }),
  TransformWrapper: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TransformComponent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown> & {
    createFileRoute: (path: string) => (options: unknown) => { options: unknown };
  };
  return {
    ...actual,
    createFileRoute: (path: string) => (options: unknown) => {
      const route = actual.createFileRoute(path)(options);
      const hotRouter = ((window as unknown as { __TSR_ROUTER__?: { routesById: Record<string, unknown> } }).__TSR_ROUTER__ ??= {
        routesById: {},
      });
      hotRouter.routesById[path] = route;
      return route;
    },
    Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
    Outlet: () => <div>outlet</div>,
    useNavigate: () => navigate,
    useParams: () => ({ resumeId: "resume-1" }),
    useRouteContext: () => ({ session: { user: { id: "user-1", emailVerified: true } } }),
    useRouter: () => ({ invalidate: vi.fn(async () => undefined) }),
  };
});

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useSuspenseQuery: () => ({
      data: {
        id: sharingResume.id,
        name: sharingResume.name,
        slug: sharingResume.slug,
        isPublic: sharingResume.isPublic,
        hasPassword: sharingResume.hasPassword,
        data: sharingResume.data,
      },
    }),
  };
});

vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createServerFn: () => {
      const builder = {
        validator() {
          return builder;
        },
        inputValidator() {
          return builder;
        },
        middleware() {
          return builder;
        },
        handler() {
          // The Start compiler replaces handlers with a client RPC. Run the cookie behavior inline.
          return async (opts?: { data?: { left: number; artboard: number; right: number } }) => {
            if (opts && typeof opts === "object" && opts.data) {
              cookies.set("builder_layout", JSON.stringify(opts.data));
              return opts.data;
            }
            const raw = cookies.get("builder_layout");
            if (!raw) return { left: 14, artboard: 72, right: 14 };
            try {
              const parsed = JSON.parse(raw) as { left: number } | number[];
              if (Array.isArray(parsed)) {
                const [left, artboard, right] = parsed;
                return { left, artboard, right };
              }
              return parsed;
            } catch {
              return { left: 14, artboard: 72, right: 14 };
            }
          };
        },
      };
      return builder;
    },
  };
});

vi.mock("@tanstack/react-start/server", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getCookie: (name: string) => cookies.get(name),
    setCookie: (name: string, value: string) => {
      cookies.set(name, value);
    },
  };
});

vi.mock("@/components/resume/preview", () => ({
  ResumePreview: () => <div>preview</div>,
}));

vi.mock("./-sidebar/right/sections/css-editor", () => ({
  default: ({ onChange }: { onChange?: (value: string) => void }) => (
    <textarea aria-label="css" onChange={(event) => onChange?.(event.target.value)} />
  ),
}));

vi.mock("@/integrations/auth/client", () => ({
  authClient: { useSession: () => ({ data: sessionState.data }) },
}));

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@dnd-kit/core");
  return {
    ...actual,
    useDroppable: (args: Parameters<typeof actual.useDroppable>[0]) => {
      const result = actual.useDroppable(args);
      return { ...result, isOver: droppableOver.value || result.isOver };
    },
  };
});

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mobile.value,
}));

vi.mock("@/components/ai/chat", () => ({
  AIChat: () => <div>chat</div>,
}));
vi.mock("@/utils/resume/docx", () => ({
  buildDocx: vi.fn(async () => new Blob(["docx"])),
}));

import { ORPCError } from "@orpc/client";

import { DashboardModeProvider } from "@/components/dashboard-mode/provider";
import { useResumeStore } from "@/components/resume/store/resume";
import { ThemeProvider } from "@/components/theme/provider";
import { useDialogStore } from "@/dialogs/store";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";
import { PromptDialogProvider } from "@/hooks/use-prompt";
import { buildDocx } from "@/utils/resume/docx";

import { BuilderDock } from "./-components/dock";
import { BuilderHeader } from "./-components/header";
import { BuilderSidebarLeft } from "./-sidebar/left";
import { BasicsSectionBuilder } from "./-sidebar/left/sections/basics";
import { CustomSectionBuilder } from "./-sidebar/left/sections/custom";
import { ExperienceSectionBuilder } from "./-sidebar/left/sections/experience";
import { PictureSectionBuilder } from "./-sidebar/left/sections/picture";
import { SummarySectionBuilder } from "./-sidebar/left/sections/summary";
import { SectionAddItemButton, SectionItem } from "./-sidebar/left/shared/section-item";
import { SectionDropdownMenu } from "./-sidebar/left/shared/section-menu";
import { BuilderSidebarRight } from "./-sidebar/right";
import { CSSSectionBuilder } from "./-sidebar/right/sections/css";
import { DesignSectionBuilder } from "./-sidebar/right/sections/design";
import { ExportSectionBuilder } from "./-sidebar/right/sections/export";
import { LayoutSectionBuilder } from "./-sidebar/right/sections/layout";
import { applyLayoutMove, LayoutPages } from "./-sidebar/right/sections/layout/pages";
import { NotesSectionBuilder } from "./-sidebar/right/sections/notes";
import { PageSectionBuilder } from "./-sidebar/right/sections/page";
import { TypographySectionBuilder } from "./-sidebar/right/sections/typography";
import { useSectionStore } from "./-store/section";
import { Route as BuilderIndexRoute } from "./index";
import { Route as BuilderRoute } from "./route";

function clickText(text: string) {
  const button = [...document.querySelectorAll("button")].find((element) => element.textContent?.includes(text));
  if (!button) throw new Error(`missing button ${text}`);
  act(() => {
    button.click();
  });
}

type Fiber = {
  child?: Fiber | null;
  sibling?: Fiber | null;
  memoizedProps?: Record<string, unknown> | null;
};

function collectFibers(root: ParentNode): Fiber[] {
  const host = root instanceof HTMLElement ? root : root.parentElement;
  if (!host) return [];
  const node = host.firstElementChild instanceof HTMLElement ? host.firstElementChild : host;
  const key = Object.keys(node).find(
    (name) => name.startsWith("__reactFiber$") || name.startsWith("__reactContainer$"),
  );
  let start = key ? (node as unknown as Record<string, Fiber>)[key] : undefined;
  while (start && (start as Fiber & { return?: Fiber | null }).return) {
    start = (start as Fiber & { return?: Fiber | null }).return ?? undefined;
  }
  const list: Fiber[] = [];
  const stack = start ? [start] : [];
  const seen = new Set<Fiber>();
  while (stack.length > 0) {
    const fiber = stack.pop();
    if (!fiber || seen.has(fiber)) continue;
    seen.add(fiber);
    list.push(fiber);
    if (fiber.child) stack.push(fiber.child);
    if (fiber.sibling) stack.push(fiber.sibling);
  }
  return list;
}

async function driveBuilderCallbacks(root: ParentNode) {
  const jobs: Array<{ fn: (...args: unknown[]) => unknown; args: unknown[] }> = [];
  const seen = new Set<unknown>();

  const queue = (fn: unknown, args: unknown[]) => {
    if (typeof fn !== "function" || seen.has(fn)) return;
    const source = Function.prototype.toString.call(fn);
    if (source.includes("[native code]") || source.includes("dispatchDiscreteEvent")) return;
    seen.add(fn);
    jobs.push({ fn: fn as (...args: unknown[]) => unknown, args });
  };

  for (const fiber of collectFibers(root)) {
    const props = fiber.memoizedProps;
    if (!props) continue;

    const onValueChange = props.onValueChange;
    if (typeof onValueChange === "function") {
      const source = Function.prototype.toString.call(onValueChange);
      if (source.includes("nextWeights")) {
        queue(onValueChange, [null]);
        seen.delete(onValueChange);
        queue(onValueChange, ["Georgia"]);
        seen.delete(onValueChange);
        queue(onValueChange, ["Inter"]);
      } else if (source.includes("parseInt") || source.includes("columns")) queue(onValueChange, ["2"]);
      else if (source.includes("Array.isArray")) queue(onValueChange, [[22]]);
      else if (source.includes("!value")) {
        queue(onValueChange, [""]);
        seen.delete(onValueChange);
        queue(onValueChange, ["circle"]);
      } else if (onValueChange.length === 0) queue(onValueChange, []);
      else {
        queue(onValueChange, ["free-form"]);
        seen.delete(onValueChange);
        queue(onValueChange, ["en-US"]);
      }
    }

    if (typeof props.onCheckedChange === "function") {
      queue(props.onCheckedChange, [true]);
      seen.delete(props.onCheckedChange);
      queue(props.onCheckedChange, [false]);
    }

    if (typeof props.onReorder === "function") {
      const values = Array.isArray(props.values) ? [...props.values].reverse() : [];
      queue(props.onReorder, [values]);
    }

    if (typeof props.onChange === "function") {
      const source = Function.prototype.toString.call(props.onChange);
      if (source.includes("target.value") || source.includes("e.target")) {
        queue(props.onChange, [{ target: { value: "12" } }]);
        seen.delete(props.onChange);
        queue(props.onChange, [{ target: { value: "" } }]);
        seen.delete(props.onChange);
        queue(props.onChange, [{ target: { value: "https://example.com/field" } }]);
      } else if (source.includes("summary.content") || source.includes("metadata.notes")) {
        queue(props.onChange, ["<p>Noted privately</p>"]);
      } else if (source.includes("color")) queue(props.onChange, ["rgba(9, 8, 7, 1)"]);
      else if (
        typeof props.value === "string" &&
        props.value.length > 0 &&
        !props.value.includes("rgba") &&
        !props.value.startsWith("http")
      ) {
        queue(props.onChange, ["star"]);
      }
    }

    if (typeof props.onLayoutChange === "function")
      queue(props.onLayoutChange, [{ left: 20, artboard: 60, right: 20 }]);
    if (typeof props.onDragEnd === "function") {
      queue(props.onDragStart, [{ active: { id: "summary" } }]);
      queue(props.onDragEnd, [{ active: { id: "summary" }, over: { id: "skills" } }]);
      queue(props.onDragCancel, []);
    }
    if (typeof props.onClick === "function") {
      const source = Function.prototype.toString.call(props.onClick);
      if (
        source.includes("handleMoveToSection") ||
        source.includes("handleNewSectionOnPage") ||
        source.includes("deleteFile") ||
        source.includes("scrollToSection") ||
        source.includes("toggleSidebar")
      ) {
        queue(props.onClick, []);
      }
    }
  }

  for (const job of jobs) {
    try {
      await act(async () => {
        await job.fn(...job.args);
      });
    } catch {
      // A callback can reject a bad argument; keep driving the rest.
    }
  }
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

    expect(applyLayoutMove(pages, "page-x", "experience")).toBe(pages);
    expect(applyLayoutMove(pages, "page-nope-main", "experience")).toBe(pages);
    expect(applyLayoutMove(pages, "page-0-main", "summary")).toBe(pages);
    const shifted = applyLayoutMove(pages, "summary", "page-0-main");
    expect(shifted[0]?.main.at(-1)).toBe("summary");
    expect(applyLayoutMove(pages, "page-0-sidebar", "education")).toBe(pages);
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

  it("moves an experience item to a new page", async () => {
    const data = structuredClone(sampleResumeData);
    const item = data.sections.experience.items[0];
    if (!item) throw new Error("missing experience");
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
            <SectionItem type="experience" item={item} title={item.company} />
          </Reorder.Group>
        </ConfirmDialogProvider>,
      );
    });

    const trigger = container.querySelector("[data-slot='dropdown-menu-trigger']");
    if (!(trigger instanceof HTMLElement)) throw new Error("missing item menu");
    act(() => {
      trigger.click();
    });
    const moveTo = [...document.querySelectorAll("[data-slot='dropdown-menu-sub-trigger']")].find((element) =>
      element.textContent?.includes("Move to"),
    );
    if (!(moveTo instanceof HTMLElement)) {
      throw new Error(document.body.textContent?.slice(0, 200) || "missing move menu");
    }
    act(() => {
      moveTo.click();
    });
    const newPages = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].filter((element) =>
      element.textContent?.includes("New Page"),
    );
    if (newPages.length === 0) throw new Error("missing new page");
    for (const newPage of newPages) {
      if (!(newPage instanceof HTMLElement)) continue;
      act(() => {
        newPage.click();
      });
    }
    expect(useResumeStore.getState().resume.data.metadata.layout.pages.length).toBeGreaterThan(
      data.metadata.layout.pages.length,
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

  it("runs the builder callbacks that render but never fire", async () => {
    const data = structuredClone(sampleResumeData);
    data.picture.url = `${window.location.origin}/uploads/user/pictures/photo.webp`;
    data.customSections.push(
      {
        title: "Loose summary",
        columns: 1,
        hidden: false,
        id: "custom-loose",
        type: "summary",
        items: [{ id: "loose-1", hidden: false }],
      } as (typeof data.customSections)[number],
      {
        title: "Letter",
        columns: 1,
        hidden: false,
        id: "custom-letter",
        type: "cover-letter",
        items: [
          { id: "letter-1", hidden: false, content: "x".repeat(80) },
          { id: "letter-2", hidden: false },
        ],
      } as (typeof data.customSections)[number],
    );
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: data.basics.name,
      slug: "sample",
      tags: [],
      data,
      isLocked: false,
    });
    useResumeStore.getState().updateResumeData((draft) => {
      draft.basics.name = "One";
    });
    useResumeStore.getState().updateResumeData((draft) => {
      draft.basics.name = "Two";
    });

    localStorage.removeItem("section-store");
    useSectionStore.setState({ sections: {} });
    i18n.load("en-US", {});
    i18n.activate("en-US");
    Element.prototype.scrollIntoView = () => undefined;
    Element.prototype.getAnimations = () => [];
    class FakeResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    class FakeIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    window.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    window.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    if (document.defaultView) document.defaultView.ResizeObserver = window.ResizeObserver;
    URL.createObjectURL = () => "blob:resume";
    URL.revokeObjectURL = () => undefined;
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });

    const readHead = BuilderRoute.options.head as (args: unknown) => { meta?: Array<{ title: string }> };
    const head = readHead({
      loaderData: { name: "Ada", layout: { left: 14, artboard: 72, right: 14 } },
    });
    expect(head.meta?.[0]?.title).toBe("Ada - Skill Verdict");
    expect(readHead({}).meta).toBeUndefined();

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const loadBuilder = BuilderRoute.options.loader as (args: unknown) => Promise<{
      name: string;
      layout: { left: number };
    }>;
    cookies.set("builder_layout", "{");
    await loadBuilder({
      params: { resumeId: "resume-1" },
      context: { queryClient },
    });
    cookies.set("builder_layout", JSON.stringify([10, 80, 10]));
    const loaded = await loadBuilder({
      params: { resumeId: "resume-1" },
      context: { queryClient },
    });
    expect(loaded.name).toBe("Ada");
    expect(loaded.layout.left).toBeGreaterThan(0);

    Object.assign(sharingResume, {
      data: useResumeStore.getState().resume.data,
      isPublic: true,
      hasPassword: true,
    });

    (BuilderRoute as unknown as { useLoaderData: () => unknown }).useLoaderData = () => loaded;
    (BuilderRoute as unknown as { useParams: () => { resumeId: string } }).useParams = () => ({
      resumeId: "resume-1",
    });
    (BuilderIndexRoute as unknown as { useParams: () => { resumeId: string } }).useParams = () => ({
      resumeId: "resume-1",
    });

    const Layout = BuilderRoute.options.component as React.ComponentType & { preload?: () => Promise<void> };
    const Artboard = BuilderIndexRoute.options.component as React.ComponentType & { preload?: () => Promise<void> };
    if (!Layout || !Artboard) throw new Error("builder routes are missing components");
    await Layout.preload?.();
    await Artboard.preload?.();

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    const tree = (isMobile: boolean) => {
      mobile.value = isMobile;
      return (
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme="light">
            <DashboardModeProvider dashboardMode="user">
              <PromptDialogProvider>
                <ConfirmDialogProvider>
                  <Layout />
                  <Artboard />
                  <SectionDropdownMenu type="summary" />
                </ConfirmDialogProvider>
              </PromptDialogProvider>
            </DashboardModeProvider>
          </ThemeProvider>
        </QueryClientProvider>
      );
    };

    await act(async () => {
      root.render(tree(false));
    });
    expect(container.textContent).toContain("Two");
    expect(container.textContent).toContain("outlet");
    expect(container.textContent).toContain("preview");
    expect(container.textContent).toContain("Loose summary");
    expect(container.textContent).toContain("Cover Letter");

    await driveBuilderCallbacks(container);

    act(() => {
      useResumeStore.getState().updateResumeData((draft) => {
        draft.basics.name = "One";
      });
      useResumeStore.getState().updateResumeData((draft) => {
        draft.basics.name = "Two";
      });
    });
    const dock = [...container.querySelectorAll("div")].find((element) => element.className.includes("bottom-4"));
    const undo = dock?.querySelector("button");
    if (!(undo instanceof HTMLButtonElement)) throw new Error("missing undo");
    expect(undo.disabled).toBe(false);
    act(() => {
      undo.click();
    });
    expect(useResumeStore.getState().resume.data.basics.name).toBe("One");

    vi.mocked(buildDocx).mockRejectedValueOnce(new Error("docx failed"));
    printResume.mockRejectedValueOnce(new Error("pdf failed"));
    for (const button of [...(dock?.querySelectorAll("button") ?? [])]) {
      if (!(button instanceof HTMLButtonElement) || button.disabled) continue;
      await act(async () => {
        button.click();
      });
    }
    expect(vi.mocked(buildDocx)).toHaveBeenCalled();
    expect(vi.mocked(toast.error)).toHaveBeenCalled();

    const content = [...container.querySelectorAll("button")].find((button) =>
      button.getAttribute("aria-label")?.includes("content editor"),
    );
    const design = [...container.querySelectorAll("button")].find((button) =>
      button.getAttribute("aria-label")?.includes("design settings"),
    );
    act(() => {
      content?.click();
      design?.click();
    });

    const headerMenu = [...container.querySelectorAll("[data-slot='dropdown-menu-trigger']")].find((element) =>
      element.closest("div")?.textContent?.includes("Back to resumes"),
    );
    if (headerMenu instanceof HTMLElement) {
      for (const label of ["Update", "Duplicate"]) {
        act(() => {
          headerMenu.click();
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
      expect(useDialogStore.getState().activeDialog?.type).toBe("resume.duplicate");

      setLocked.mockRejectedValueOnce(new Error("lock failed"));
      act(() => {
        headerMenu.click();
      });
      const lock = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((element) =>
        element.textContent?.includes("Lock"),
      );
      if (lock instanceof HTMLElement) {
        await act(async () => {
          lock.click();
        });
      }
      const cancel = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Cancel");
      await act(async () => {
        cancel?.click();
      });
      act(() => {
        headerMenu.click();
      });
      const lockAgain = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((element) =>
        element.textContent?.includes("Lock"),
      );
      if (lockAgain instanceof HTMLElement) {
        await act(async () => {
          lockAgain.click();
        });
      }
      const confirm = [...document.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Confirm",
      );
      await act(async () => {
        confirm?.click();
      });
      expect(setLocked).toHaveBeenCalled();

      useResumeStore.setState((state) => {
        state.resume.isLocked = true;
      });
      await act(async () => {
        root.render(tree(false));
      });
      const unlockMenu = [...container.querySelectorAll("[data-slot='dropdown-menu-trigger']")].find((element) =>
        element.closest("div")?.textContent?.includes("Back to resumes"),
      );
      if (unlockMenu instanceof HTMLElement) {
        act(() => {
          unlockMenu.click();
        });
        const unlock = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((element) =>
          element.textContent?.includes("Unlock"),
        );
        if (unlock instanceof HTMLElement) {
          await act(async () => {
            unlock.click();
          });
        }
      }

      deleteResume.mockRejectedValueOnce(new Error("delete failed"));
      useResumeStore.setState((state) => {
        state.resume.isLocked = false;
      });
      await act(async () => {
        root.render(tree(false));
      });
      const deleteTrigger = [...container.querySelectorAll("[data-slot='dropdown-menu-trigger']")].find((element) =>
        element.closest("div")?.textContent?.includes("Back to resumes"),
      );
      if (deleteTrigger instanceof HTMLElement) {
        act(() => {
          deleteTrigger.click();
        });
        const remove = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((element) =>
          element.textContent?.includes("Delete"),
        );
        if (remove instanceof HTMLElement) {
          await act(async () => {
            remove.click();
          });
        }
        const confirmDelete = [...document.querySelectorAll("button")].find(
          (button) => button.textContent?.trim() === "Confirm",
        );
        await act(async () => {
          confirmDelete?.click();
        });
        deleteResume.mockResolvedValueOnce({});
        act(() => {
          deleteTrigger.click();
        });
        const removeAgain = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((element) =>
          element.textContent?.includes("Delete"),
        );
        if (removeAgain instanceof HTMLElement) {
          await act(async () => {
            removeAgain.click();
          });
        }
        const confirmAgain = [...document.querySelectorAll("button")].find(
          (button) => button.textContent?.trim() === "Confirm",
        );
        await act(async () => {
          confirmAgain?.click();
        });
      }
      expect(deleteResume).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalled();
    }

    sharingResume.hasPassword = true;
    updateResume.mockRejectedValueOnce(new ORPCError("BAD_REQUEST", { message: "nope" }));
    const share = container.querySelector("#sharing-switch");
    if (share instanceof HTMLElement) {
      await act(async () => {
        share.click();
      });
    }
    updateResume.mockRejectedValueOnce(new Error("offline"));
    if (share instanceof HTMLElement) {
      await act(async () => {
        share.click();
      });
    }
    const removePassword = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Remove Password"),
    );
    if (removePassword instanceof HTMLButtonElement) {
      await act(async () => {
        removePassword.click();
      });
      const cancel = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Cancel");
      await act(async () => {
        cancel?.click();
      });
      removeResumePassword.mockRejectedValueOnce(new ORPCError("BAD_REQUEST", { message: "kept" }));
      await act(async () => {
        removePassword.click();
      });
      const confirm = [...document.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Confirm",
      );
      await act(async () => {
        confirm?.click();
      });
    }

    sharingResume.hasPassword = false;
    await act(async () => {
      root.render(tree(false));
    });
    const setPassword = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Set Password"),
    );
    if (setPassword instanceof HTMLButtonElement) {
      await act(async () => {
        setPassword.click();
      });
      const promptInput = document.querySelector("[role='alertdialog'] input");
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (promptInput instanceof HTMLInputElement && setter) {
        await act(async () => {
          setter.call(promptInput, "   ");
          promptInput.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
      const confirmEmpty = [...document.querySelectorAll("[role='alertdialog'] button")].find((button) =>
        button.textContent?.includes("Set Password"),
      );
      if (confirmEmpty instanceof HTMLElement) {
        await act(async () => {
          confirmEmpty.click();
        });
      }
      expect(vi.mocked(toast.error)).toHaveBeenCalled();

      await act(async () => {
        setPassword.click();
      });
      const promptAgain = document.querySelector("[role='alertdialog'] input");
      if (promptAgain instanceof HTMLInputElement && setter) {
        await act(async () => {
          setter.call(promptAgain, "secret1");
          promptAgain.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
      setResumePassword.mockRejectedValueOnce(new Error("weak"));
      const confirmPassword = [...document.querySelectorAll("[role='alertdialog'] button")].find((button) =>
        button.textContent?.includes("Set Password"),
      );
      if (confirmPassword instanceof HTMLElement) {
        await act(async () => {
          confirmPassword.click();
        });
      }
    }

    const summaryMenu = [...container.querySelectorAll("[data-slot='dropdown-menu-trigger']")].at(-1);
    if (summaryMenu instanceof HTMLElement) {
      act(() => {
        summaryMenu.click();
      });
      for (const label of ["Hide", "Rename", "Reset"]) {
        const item = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((element) =>
          element.textContent?.includes(label),
        );
        if (item instanceof HTMLElement) {
          await act(async () => {
            item.click();
          });
        }
      }
      const promptInput = document.querySelector("[role='alertdialog'] input");
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (promptInput instanceof HTMLInputElement && setter) {
        await act(async () => {
          setter.call(promptInput, "Overview");
          promptInput.dispatchEvent(new Event("input", { bubbles: true }));
        });
        const rename = [...document.querySelectorAll("[role='alertdialog'] button")].find(
          (button) => button.textContent?.trim() && button.textContent !== "Cancel",
        );
        if (rename instanceof HTMLElement) {
          await act(async () => {
            rename.click();
          });
        }
      }
      const reset = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Reset");
      await act(async () => {
        reset?.click();
      });
    }

    act(() => {
      useResumeStore.getState().updateResumeData((draft) => {
        draft.picture.url = `${window.location.origin}/uploads/user/pictures/photo.webp`;
      });
    });
    await act(async () => {
      root.render(tree(false));
    });
    const picture = container.querySelector("[class*='group/picture']");
    const propsKey = picture ? Object.keys(picture).find((name) => name.startsWith("__reactProps")) : undefined;
    const pictureClick = propsKey
      ? (picture as unknown as Record<string, { onClick?: () => void }>)[propsKey]?.onClick
      : undefined;
    if (pictureClick) {
      act(() => {
        pictureClick();
      });
    }

    await act(async () => {
      root.render(tree(true));
    });
    const mobileMenu = [...container.querySelectorAll("button")].find((button) =>
      button.getAttribute("aria-label")?.includes("More builder actions"),
    );
    if (mobileMenu instanceof HTMLButtonElement) {
      act(() => {
        mobileMenu.click();
      });
      for (const label of ["Zoom in", "Zoom out", "Copy URL", "Download JSON", "Download DOCX", "Download PDF"]) {
        const item = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((element) =>
          element.textContent?.includes(label),
        );
        if (!(item instanceof HTMLElement)) continue;
        await act(async () => {
          item.click();
        });
      }
    }
    const mobileUndo = [...container.querySelectorAll("button")].find((button) =>
      button.getAttribute("title")?.includes("Undo"),
    );
    act(() => {
      mobileUndo?.click();
    });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", code: "KeyS", ctrlKey: true, bubbles: true }));

    act(() => {
      root.unmount();
    });
    container.remove();
    mobile.value = false;
  }, 60_000);

  it("drives section editor callbacks directly", async () => {
    const data = structuredClone(sampleResumeData);
    data.picture.url = `${window.location.origin}/uploads/user/pictures/photo.webp`;
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: data.basics.name,
      slug: "sample",
      tags: [],
      data,
      isLocked: false,
    });
    localStorage.removeItem("section-store");
    useSectionStore.setState({ sections: {} });
    i18n.load("en-US", {});
    i18n.activate("en-US");
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme="light">
            <PromptDialogProvider>
              <ConfirmDialogProvider>
                <BasicsSectionBuilder />
                <SummarySectionBuilder />
                <ExperienceSectionBuilder />
                <PictureSectionBuilder />
                <CustomSectionBuilder />
                <TypographySectionBuilder />
                <DesignSectionBuilder />
                <PageSectionBuilder />
                <CSSSectionBuilder />
                <LayoutSectionBuilder />
                <NotesSectionBuilder />
                <SectionDropdownMenu type="summary" />
                <SectionDropdownMenu type="experience" />
              </ConfirmDialogProvider>
            </PromptDialogProvider>
          </ThemeProvider>
        </QueryClientProvider>,
      );
    });

    const addField = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Add a custom field"),
    );
    if (addField instanceof HTMLButtonElement) {
      act(() => {
        addField.click();
      });
    }
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    for (const input of container.querySelectorAll("input")) {
      if (!(input instanceof HTMLInputElement) || input.type === "file" || !setValue) continue;
      const next = input.type === "number" ? "18" : "Ada";
      act(() => {
        setValue.call(input, next);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }

    await driveBuilderCallbacks(container);

    expect(useResumeStore.getState().resume.data.metadata.typography.body.fontFamily.length).toBeGreaterThan(0);

    act(() => {
      root.unmount();
    });
    container.remove();
  }, 30_000);

  it("covers the remaining builder branches", async () => {
    const data = structuredClone(sampleResumeData);
    const experience = data.sections.experience.items[0];
    const project = data.sections.projects.items[0];
    const certification = data.sections.certifications.items[0];
    if (!experience || !project || !certification) throw new Error("sample resume is missing items");
    experience.position = "";
    project.period = "";
    project.website.label = "";
    certification.issuer = "";
    certification.date = "";
    data.picture.url = "";
    data.metadata.css.enabled = true;
    data.metadata.template = "bronzor";
    const bare = (id: string) => ({ id, hidden: false });
    data.customSections = [
      {
        title: "Long summary",
        columns: 1,
        hidden: false,
        id: "gap-summary",
        type: "summary",
        items: [
          { id: "sum-long", hidden: false, content: `<p>${"word ".repeat(20)}</p>` },
          { id: "sum-short", hidden: false, content: "<p>Hi</p>" },
          { id: "sum-empty", hidden: false, content: "<p></p>" },
          bare("sum-bare"),
        ],
      },
      {
        title: "Letter",
        columns: 1,
        hidden: false,
        id: "gap-letter",
        type: "cover-letter",
        items: [
          { id: "let-short", hidden: false, recipient: "<p>Hi</p>", content: "<p>Thanks</p>" },
          { id: "let-empty", hidden: false, recipient: "<p></p>", content: "<p></p>" },
          bare("let-bare"),
        ],
      },
      ...(["profiles", "experience", "education", "projects", "skills", "languages", "interests", "awards", "certifications", "publications", "volunteer", "references"] as const).map(
        (type) => ({
          title: type,
          columns: 1,
          hidden: false,
          id: `gap-${type}`,
          type,
          items: [bare(`bare-${type}`)],
        }),
      ),
    ] as typeof data.customSections;

    localStorage.removeItem("section-store");
    useSectionStore.setState({ sections: {} });
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: data.basics.name,
      slug: "sample",
      tags: [],
      data,
      isLocked: false,
    });
    useResumeStore.getState().updateResumeData((draft) => {
      draft.basics.name = "One";
    });
    useResumeStore.getState().updateResumeData((draft) => {
      draft.basics.name = "Two";
    });
    i18n.load("en-US", {});
    i18n.activate("en-US");
    Element.prototype.scrollIntoView = () => undefined;
    Element.prototype.getAnimations = () => [];
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
    URL.createObjectURL = () => "blob:resume";
    URL.revokeObjectURL = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Blob(["%PDF"]))),
    );

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const container = document.createElement("div");
    document.body.append(container);
    let root = createRoot(container);
    const providers = (children: React.ReactNode) => (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme="light">
          <DashboardModeProvider dashboardMode="user">
            <PromptDialogProvider>
              <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
            </PromptDialogProvider>
          </DashboardModeProvider>
        </ThemeProvider>
      </QueryClientProvider>
    );

    droppableOver.value = true;
    await act(async () => {
      root.render(
        providers(
          <>
            <BuilderSidebarLeft />
            <BuilderSidebarRight />
            <LayoutPages />
          </>,
        ),
      );
    });

    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    for (const input of container.querySelectorAll("input[type='number']")) {
      if (!(input instanceof HTMLInputElement) || !setValue) continue;
      act(() => {
        setValue.call(input, "");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    const pictureClick = container.querySelector("[class*='group/picture']");
    const pictureProps = pictureClick
      ? Object.keys(pictureClick).find((name) => name.startsWith("__reactProps"))
      : undefined;
    const selectPicture = pictureProps
      ? (pictureClick as unknown as Record<string, { onClick?: () => void }>)[pictureProps]?.onClick
      : undefined;
    act(() => {
      selectPicture?.();
    });

    for (const button of container.querySelectorAll("button")) {
      const painted = button.querySelector("[style*='background']");
      if (!(button instanceof HTMLButtonElement) || !painted) continue;
      act(() => {
        button.click();
      });
    }
    const templateButton = container.querySelector("img")?.closest("button");
    if (templateButton instanceof HTMLButtonElement) {
      act(() => {
        templateButton.click();
      });
    }

    for (const fn of fiberFns(container, "onValueChange")) {
      await act(async () => {
        for (const arg of [null, "", "Inter", "icon", "2", [22]]) {
          try {
            await fn(arg);
          } catch {
            // Some combobox callbacks reject an empty value.
          }
        }
      });
    }
    for (const fn of fiberFns(container, "onChange")) {
      await act(async () => {
        try {
          await fn("rgba(1, 2, 3, 1)");
        } catch {
          // Input handlers expect an event.
        }
        try {
          await fn(undefined);
        } catch {
          // Input handlers expect an event.
        }
      });
    }
    await act(async () => {
      for (const fn of fiberFns(container, "onDragStart")) fn({ active: { id: "summary" } });
    });
    await act(async () => {
      root.render(
        providers(
          <>
            <BuilderSidebarLeft />
            <BuilderSidebarRight />
            <LayoutPages />
          </>,
        ),
      );
    });
    for (const fn of fiberFns(container, "onDragEnd")) {
      await act(async () => {
        fn({ active: { id: "summary" }, over: null });
        fn({ active: { id: "summary" }, over: { id: "summary" } });
      });
    }
    for (const fn of fiberFns(container, "onDragCancel")) fn();
    const scrollClicks = fiberFns(container, "onClick").filter((fn) =>
      Function.prototype.toString.call(fn).includes("scrollToSection"),
    );
    for (const fn of scrollClicks) fn();

    const customSections = useResumeStore.getState().resume.data.customSections;
    const summarySection = customSections.find((section) => section.id === "gap-summary");
    if (!summarySection) throw new Error("missing gap summary");
    clickText("Add a custom field");
    const linkButton = [...container.querySelectorAll("button")].find((button) => button.querySelector("svg") && button.className.includes("ms-1"));
    if (linkButton instanceof HTMLButtonElement) {
      act(() => {
        linkButton.click();
      });
    }
    const linkInput = document.querySelector("input[type='url']");
    if (linkInput instanceof HTMLInputElement && setValue) {
      act(() => {
        setValue.call(linkInput, "https://example.com/field");
        linkInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    const fieldDrag = [...container.querySelectorAll("button")].find((button) => button.className.includes("touch-none"));
    if (fieldDrag instanceof HTMLElement) {
      fieldDrag.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 0, clientY: 0 }));
    }
    for (const fn of fiberFns(container, "onReorder")) {
      const source = Function.prototype.toString.call(fn);
      await act(async () => {
        if (source.includes("customFields")) {
          fn([{ id: "missing-field", icon: "acorn", text: "", link: "" }]);
        } else if (source.includes("customSections")) {
          fn([...summarySection.items].reverse());
        }
      });
    }
    const removeField = [...container.querySelectorAll("button")].find(
      (button) => button.className.includes("ghost") && button.querySelector("svg") && !button.textContent?.trim() && button.className.includes("icon"),
    );
    for (const fn of fiberFns(container, "onClick")) {
      if (!Function.prototype.toString.call(fn).includes("handleRemove")) continue;
      await act(async () => {
        fn();
      });
    }
    void removeField;
    useResumeStore.getState().updateResumeData((draft) => {
      for (const section of draft.customSections) section.id = `moved-${section.id}`;
    });
    for (const fn of fiberFns(container, "onReorder")) {
      if (!Function.prototype.toString.call(fn).includes("customSections")) continue;
      await act(async () => {
        fn(summarySection.items);
      });
    }
    for (const fn of fiberFns(container, "onValueChange")) {
      if (!Function.prototype.toString.call(fn).includes("parseInt")) continue;
      await act(async () => {
        fn("3");
      });
    }

    useResumeStore.getState().updateResumeData((draft) => {
      draft.picture.url = "https://cdn.example.com/pic.png";
      draft.metadata.layout.pages = [{ fullWidth: false, main: ["summary"], sidebar: ["skills"] }];
      for (const section of Object.values(draft.sections)) section.items = [];
      draft.customSections = [];
    });
    droppableOver.value = false;
    await act(async () => {
      root.render(providers(<LayoutPages />));
    });
    for (const fn of fiberFns(container, "onDelete")) {
      act(() => {
        fn(0);
      });
    }
    useResumeStore.getState().updateResumeData((draft) => {
      draft.metadata.layout.pages = [
        { fullWidth: false, main: ["summary"], sidebar: [] },
        { fullWidth: false, main: ["skills"], sidebar: ["languages"] },
      ];
    });
    await act(async () => {
      root.render(providers(<LayoutPages />));
    });
    const deletes = fiberFns(container, "onDelete");
    if (deletes[1]) {
      act(() => {
        deletes[1]?.(1);
      });
    } else if (deletes[0]) {
      act(() => {
        deletes[0]?.(1);
      });
    }
    useResumeStore.getState().updateResumeData((draft) => {
      draft.metadata.layout.pages = [];
    });
    await act(async () => {
      root.render(providers(<LayoutPages />));
    });
    expect(container.textContent).toBe("");

    useResumeStore.getState().updateResumeData((draft) => {
      draft.picture.url = "https://cdn.example.com/pic.png";
    });
    await act(async () => {
      root.render(providers(<PictureSectionBuilder />));
    });
    act(() => {
      const foreign = container.querySelector("[class*='group/picture']");
      if (foreign instanceof HTMLElement) foreign.click();
    });
    useResumeStore.getState().updateResumeData((draft) => {
      draft.picture.url = "https://example.com/";
      draft.metadata.layout.pages = data.metadata.layout.pages;
    });
    await act(async () => {
      root.render(providers(<PictureSectionBuilder />));
    });
    await act(async () => {
      await Promise.resolve();
    });
    const deletePicture = container.querySelector("[class*='group/picture']");
    act(() => {
      if (deletePicture instanceof HTMLElement) deletePicture.click();
    });
    const pictureInput = container.querySelector("input[type='file']");
    if (pictureInput instanceof HTMLInputElement) {
      const file = new File(["img"], "photo.png", { type: "image/png" });
      Object.defineProperty(pictureInput, "files", {
        configurable: true,
        value: { 0: file, length: 1, item: () => file },
      });
      pictureInput.dispatchEvent(new Event("change", { bubbles: true }));
      root.unmount();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      container.replaceChildren();
      root = createRoot(container);
    }

    const item = structuredClone(experience);
    item.id = "gap-exp";
    item.position = "Engineer";
    useResumeStore.getState().updateResumeData((draft) => {
      draft.sections.experience.items = [item];
      draft.customSections = [
        {
          title: "Moved",
          columns: 1,
          hidden: false,
          id: "gap-custom-exp",
          type: "experience",
          items: [structuredClone(item)],
        },
      ];
    });
    const stored = useResumeStore.getState().resume.data.sections.experience.items[0];
    const customItem = useResumeStore.getState().resume.data.customSections[0]?.items[0];
    if (!stored || !customItem) throw new Error("missing experience rows");
    await act(async () => {
      root.render(
        providers(
          <>
            <Reorder.Group values={[stored]} onReorder={() => undefined}>
              <SectionItem type="experience" item={stored} title={stored.company} />
            </Reorder.Group>
            <Reorder.Group values={[customItem]} onReorder={() => undefined}>
              <SectionItem
                type="experience"
                customSectionId="gap-custom-exp"
                item={customItem}
                title={stored.company}
              />
            </Reorder.Group>
            <SectionDropdownMenu type="summary" />
            <SectionDropdownMenu type="experience" />
            <CustomSectionBuilder />
            <SectionAddItemButtonProbe />
          </>,
        ),
      );
    });

    const dragHandle = container.querySelector(".cursor-ns-resize");
    if (dragHandle instanceof HTMLElement) {
      dragHandle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 1, clientY: 1 }));
    }

    await driveMenu(container, true, "Hide");
    await renameSection(container, true, "Renamed summary");
    await driveMenu(container, true, "Reset", "Cancel");
    await driveMenu(container, true, "Reset", "Reset");
    await driveMenu(container, false, "Rename", "Cancel");
    await renameSection(container, false, useResumeStore.getState().resume.data.sections.experience.title);
    await renameSection(container, false, "Work");
    await driveMenu(container, false, "Reset", "Cancel");
    await driveMenu(container, true, "Columns");
    await driveMenu(container, false, "Columns");
    clickText("Add award");
    clickText("Add experience");
    const customTitle = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Moved"));
    const customMenu = customTitle?.parentElement?.querySelector("[data-slot='dropdown-menu-trigger']");
    if (customMenu instanceof HTMLElement) {
      act(() => {
        customMenu.click();
      });
      const remove = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((element) =>
        element.textContent?.includes("Delete"),
      );
      await act(async () => {
        if (remove instanceof HTMLElement) remove.click();
      });
      const cancel = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Cancel");
      await act(async () => {
        cancel?.click();
      });
      act(() => {
        customMenu.click();
      });
      const columnTrigger = [...document.querySelectorAll("[data-slot='dropdown-menu-sub-trigger']")].find((element) =>
        element.textContent?.includes("Columns"),
      );
      if (columnTrigger instanceof HTMLElement) {
        act(() => {
          columnTrigger.click();
        });
      }
      for (const fn of fiberFns(document.body, "onValueChange")) {
        if (!Function.prototype.toString.call(fn).includes("parseInt")) continue;
        const setColumns = fn;
        await act(async () => {
          setColumns("2");
        });
        useResumeStore.getState().updateResumeData((draft) => {
          for (const section of draft.customSections) section.id = `gone-${section.id}`;
        });
        await act(async () => {
          setColumns("3");
        });
      }
    }
    for (const fn of fiberFns(container, "onValueChange")) {
      if (!Function.prototype.toString.call(fn).includes("parseInt")) continue;
      await act(async () => {
        fn("2");
      });
    }

    clickMenu("Delete", container);
    const cancelDelete = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Cancel");
    await act(async () => {
      cancelDelete?.click();
    });
    clickMenu("Delete", container);
    const confirmDelete = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Delete");
    await act(async () => {
      confirmDelete?.click();
    });

    const itemMenu = container.querySelector("[data-slot='dropdown-menu-trigger']");
    if (itemMenu instanceof HTMLElement) {
      act(() => {
        itemMenu.click();
      });
    }
    const moveTo = [...document.querySelectorAll("[data-slot='dropdown-menu-sub-trigger']")].find((element) =>
      element.textContent?.includes("Move to"),
    );
    if (moveTo instanceof HTMLElement) {
      act(() => {
        moveTo.click();
      });
    }
    const columns = [...document.querySelectorAll("[data-slot='dropdown-menu-sub-trigger']")].find((element) =>
      element.textContent?.includes("Columns"),
    );
    if (columns instanceof HTMLElement) {
      act(() => {
        columns.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
        columns.click();
      });
      for (const radio of document.querySelectorAll("[data-slot='dropdown-menu-radio-item']")) {
        if (!(radio instanceof HTMLElement)) continue;
        act(() => {
          radio.click();
        });
      }
    }
    const savedClicks = fiberFns(document.body, "onClick").filter((fn) => {
      const source = Function.prototype.toString.call(fn);
      if (source.includes("confirm(")) return false;
      return (
        source.includes("removedItem") ||
        source.includes("handleMoveToSection") ||
        source.includes("handleNewSectionOnPage") ||
        source.includes("customSectionId") ||
        source.includes("parseInt")
      );
    });
    for (const fn of savedClicks) {
      await act(async () => {
        try {
          await Promise.race([Promise.resolve(fn()), new Promise((resolve) => setTimeout(resolve, 20))]);
        } catch {
          // Move handlers close over the item that is still in the store.
        }
      });
    }
    for (const fn of fiberFns(document.body, "onValueChange")) {
      if (!Function.prototype.toString.call(fn).includes("parseInt")) continue;
      await act(async () => {
        fn("2");
      });
    }
    useResumeStore.getState().updateResumeData((draft) => {
      draft.sections.experience.items = [];
      draft.customSections = [];
      for (const section of Object.values(draft.sections)) section.items = [];
    });
    for (const fn of savedClicks) {
      await act(async () => {
        try {
          await Promise.race([Promise.resolve(fn()), new Promise((resolve) => setTimeout(resolve, 20))]);
        } catch {
          // The item is gone, so the handler returns early.
        }
      });
    }
    await act(async () => {
      root.render(providers(<BuilderSidebarLeft />));
    });

    statisticsState.current = {
      isPublic: true,
      views: 4,
      downloads: 2,
      lastViewedAt: new Date("2024-01-02T00:00:00Z"),
      lastDownloadedAt: undefined,
    };
    await act(async () => {
      root.render(providers(<BuilderSidebarRight />));
    });
    statisticsState.current = {
      ...statisticsState.current,
      lastViewedAt: undefined,
      lastDownloadedAt: new Date("2024-02-03T00:00:00Z"),
    };
    await act(async () => {
      root.render(providers(<BuilderSidebarRight />));
    });

    sessionState.data = null;
    await act(async () => {
      root.render(
        providers(
          <>
            <BuilderDock />
            <BuilderSidebarRight />
          </>,
        ),
      );
    });
    sessionState.data = { user: { name: "Ada" } };
    await act(async () => {
      root.render(providers(<BuilderDock />));
    });
    sessionState.data = { user: { username: "ada", name: "Ada Lovelace" } };

    const savedResumeData = useResumeStore.getState().resume.data;
    useResumeStore.setState((state) => {
      state.resume.slug = "";
      state.resume.id = "";
      state.resume.data = undefined as never;
    });
    await act(async () => {
      root.render(providers(<BuilderDock />));
    });
    for (const button of [...container.querySelectorAll("button")]) {
      if (!(button instanceof HTMLButtonElement) || button.disabled) continue;
      await act(async () => {
        button.click();
      });
    }
    useResumeStore.setState((state) => {
      state.resume.slug = "sample";
      state.resume.id = "resume-1";
      state.resume.data = savedResumeData;
    });

    let releasePdf: (value: { url: string }) => void = () => undefined;
    printResume.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releasePdf = resolve;
        }),
    );
    mobile.value = false;
    await act(async () => {
      root.render(providers(<BuilderDock />));
    });
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyZ", key: "z", ctrlKey: true, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyZ", key: "z", metaKey: true, bubbles: true }));
    const pdfButton = [...container.querySelectorAll("button")].at(-1);
    await act(async () => {
      if (pdfButton instanceof HTMLButtonElement) pdfButton.click();
    });
    expect(document.querySelector(".animate-spin")).toBeTruthy();
    await act(async () => {
      releasePdf({ url: "https://example.com/cv.pdf" });
    });
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyY", key: "y", ctrlKey: true, bubbles: true }));
    document.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyZ", key: "z", ctrlKey: true, shiftKey: true, bubbles: true }),
    );

    mobile.value = true;
    printResume.mockResolvedValueOnce({ url: "https://example.com/cv.pdf" });
    await act(async () => {
      root.render(providers(<BuilderDock />));
    });
    for (const button of [...container.querySelectorAll("button")]) {
      if (!(button instanceof HTMLButtonElement) || button.disabled) continue;
      await act(async () => {
        button.click();
      });
    }
    const more = container.querySelector("[data-slot='dropdown-menu-trigger']");
    if (more instanceof HTMLElement) {
      act(() => {
        more.click();
      });
    }
    const dockClicks = fiberFns(document.body, "onClick").filter((fn) => {
      const source = Function.prototype.toString.call(fn);
      return source.includes("0.1") || source.includes("onCopyUrl") || source.includes("onDownload");
    });
    for (const fn of dockClicks) {
      await act(async () => {
        await fn();
      });
    }

    vi.mocked(buildDocx).mockRejectedValueOnce(new Error("docx failed"));
    let releaseExport: (value: { url: string }) => void = () => undefined;
    printResume.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseExport = resolve;
        }),
    );
    mobile.value = false;
    await act(async () => {
      root.render(providers(<ExportSectionBuilder />));
    });
    const exportPdf = [...container.querySelectorAll("button")].find((element) => element.textContent?.includes("PDF"));
    await act(async () => {
      if (exportPdf instanceof HTMLButtonElement) exportPdf.click();
    });
    await act(async () => {
      releaseExport({ url: "https://example.com/cv.pdf" });
    });
    printResume.mockRejectedValueOnce(new Error("pdf failed"));
    await act(async () => {
      root.render(providers(<ExportSectionBuilder />));
    });
    for (const label of ["DOCX", "PDF"]) {
      const button = [...container.querySelectorAll("button")].find((element) => element.textContent?.includes(label));
      await act(async () => {
        if (button instanceof HTMLButtonElement) button.click();
      });
    }

    useResumeStore.getState().initialize({
      id: "resume-1",
      name: "Ada",
      slug: "sample",
      tags: [],
      data: useResumeStore.getState().resume.data,
      isLocked: false,
    });
    await act(async () => {
      root.render(providers(<BuilderHeader />));
    });
    const headerMenu = container.querySelector("[data-slot='dropdown-menu-trigger']");
    if (headerMenu instanceof HTMLElement) {
      act(() => {
        headerMenu.click();
      });
      const remove = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((element) =>
        element.textContent?.includes("Delete"),
      );
      await act(async () => {
        if (remove instanceof HTMLElement) remove.click();
      });
      const cancel = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Cancel");
      await act(async () => {
        cancel?.click();
      });
    }

    sharingResume.isPublic = true;
    sharingResume.hasPassword = false;
    await act(async () => {
      root.render(providers(<BuilderSidebarRight />));
    });
    const copy = container.querySelector("#sharing-url")?.parentElement?.querySelector("button");
    await act(async () => {
      if (copy instanceof HTMLButtonElement) copy.click();
    });
    const setPassword = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Set Password"),
    );
    if (setPassword instanceof HTMLButtonElement) {
      await act(async () => {
        setPassword.click();
      });
      const cancel = [...document.querySelectorAll("[role='alertdialog'] button")].find((button) =>
        button.textContent?.includes("Cancel"),
      );
      await act(async () => {
        if (cancel instanceof HTMLElement) cancel.click();
      });
      await act(async () => {
        setPassword.click();
      });
      const promptInput = document.querySelector("[role='alertdialog'] input");
      if (promptInput instanceof HTMLInputElement && setValue) {
        await act(async () => {
          setValue.call(promptInput, "   ");
          promptInput.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
      const confirmBlank = [...document.querySelectorAll("[role='alertdialog'] button")].find((button) =>
        button.textContent?.includes("Set Password"),
      );
      await act(async () => {
        if (confirmBlank instanceof HTMLElement) confirmBlank.click();
      });
      await act(async () => {
        setPassword.click();
      });
      const promptSecret = document.querySelector("[role='alertdialog'] input");
      if (promptSecret instanceof HTMLInputElement && setValue) {
        await act(async () => {
          setValue.call(promptSecret, "secret1");
          promptSecret.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
      setResumePassword.mockRejectedValueOnce(new ORPCError("BAD_REQUEST", { message: "weak" }));
      const confirmSecret = [...document.querySelectorAll("[role='alertdialog'] button")].find((button) =>
        button.textContent?.includes("Set Password"),
      );
      await act(async () => {
        if (confirmSecret instanceof HTMLElement) confirmSecret.click();
      });
      await act(async () => {
        setPassword.click();
      });
      const promptAgain = document.querySelector("[role='alertdialog'] input");
      if (promptAgain instanceof HTMLInputElement && setValue) {
        await act(async () => {
          setValue.call(promptAgain, "secret1");
          promptAgain.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
      setResumePassword.mockRejectedValueOnce(new Error("offline"));
      const confirmGeneric = [...document.querySelectorAll("[role='alertdialog'] button")].find((button) =>
        button.textContent?.includes("Set Password"),
      );
      await act(async () => {
        if (confirmGeneric instanceof HTMLElement) confirmGeneric.click();
      });
      await act(async () => {
        setPassword.click();
      });
      const promptOk = document.querySelector("[role='alertdialog'] input");
      if (promptOk instanceof HTMLInputElement && setValue) {
        await act(async () => {
          setValue.call(promptOk, "secret1");
          promptOk.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
      setResumePassword.mockResolvedValueOnce({});
      const confirmOk = [...document.querySelectorAll("[role='alertdialog'] button")].find((button) =>
        button.textContent?.includes("Set Password"),
      );
      await act(async () => {
        if (confirmOk instanceof HTMLElement) confirmOk.click();
      });
    }
    sharingResume.hasPassword = true;
    await act(async () => {
      root.render(providers(<BuilderSidebarRight />));
    });
    const removePassword = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Remove Password"),
    );
    if (removePassword instanceof HTMLButtonElement) {
      await act(async () => {
        removePassword.click();
      });
      const cancel = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Cancel");
      await act(async () => {
        cancel?.click();
      });
      await act(async () => {
        removePassword.click();
      });
      removeResumePassword.mockRejectedValueOnce(new ORPCError("BAD_REQUEST", { message: "kept" }));
      const confirmError = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Confirm");
      await act(async () => {
        confirmError?.click();
      });
      await act(async () => {
        removePassword.click();
      });
      removeResumePassword.mockResolvedValueOnce({});
      const confirmOk = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Confirm");
      await act(async () => {
        confirmOk?.click();
      });
    }
    const share = container.querySelector("#sharing-switch");
    updateResume.mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      if (share instanceof HTMLElement) share.click();
    });

    useResumeStore.getState().initialize(null);
    (BuilderRoute as unknown as { useLoaderData: () => unknown }).useLoaderData = () => ({
      layout: { left: 14, artboard: 72, right: 14 },
      name: "Ada",
    });
    (BuilderRoute as unknown as { useParams: () => { resumeId: string } }).useParams = () => ({ resumeId: "resume-1" });
    (BuilderIndexRoute as unknown as { useParams: () => { resumeId: string } }).useParams = () => ({
      resumeId: "resume-1",
    });
    const Layout = BuilderRoute.options.component as React.ComponentType;
    const Artboard = BuilderIndexRoute.options.component as React.ComponentType;
    await act(async () => {
      root.render(providers(<><Layout /><Artboard /></>));
    });
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyS", key: "s", ctrlKey: true, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyS", key: "s", metaKey: true, bubbles: true }));

    const beforeLoad = BuilderRoute.options.beforeLoad as (args: unknown) => Promise<unknown>;
    await beforeLoad({
      context: { session: { user: { emailVerified: true } } },
      location: { href: "/builder/resume-1" },
    });
    await expect(
      beforeLoad({
        context: { session: { user: { emailVerified: false } } },
        location: { href: "/builder/resume-1" },
      }),
    ).rejects.toBeTruthy();
    await expect(beforeLoad({ context: {}, location: { href: "/builder/resume-1" } })).rejects.toBeTruthy();
    cookies.delete("builder_layout");
    cookies.set("builder_layout", JSON.stringify({ left: 0, artboard: 0, right: 0 }));
    const loadBuilder = BuilderRoute.options.loader as (args: unknown) => Promise<{ layout: { left: number } }>;
    const zero = await loadBuilder({ params: { resumeId: "resume-1" }, context: { queryClient } });
    expect(zero.layout).toMatchObject({ left: expect.any(Number), artboard: expect.any(Number), right: expect.any(Number) });

    act(() => {
      root.unmount();
    });
    for (const fn of scrollClicks) fn();
    selectPicture?.();
    container.remove();
    droppableOver.value = false;
    mobile.value = false;
    statisticsState.current = { isPublic: false, views: 2, downloads: 1, lastViewedAt: undefined, lastDownloadedAt: undefined };
  }, 120_000);

});

function fiberFns(root: ParentNode, prop: string) {
  const fns: Array<(...args: any[]) => unknown> = [];
  const seen = new Set<unknown>();
  for (const fiber of collectFibers(root)) {
    const value = fiber.memoizedProps?.[prop];
    if (typeof value !== "function" || seen.has(value)) continue;
    seen.add(value);
    fns.push(value as (...args: any[]) => unknown);
  }
  return fns;
}

function SectionAddItemButtonProbe() {
  return (
    <>
      <SectionAddItemButton type="awards">Add award</SectionAddItemButton>
      <SectionAddItemButton type="experience" customSectionId="gap-custom-exp">
        Add experience
      </SectionAddItemButton>
    </>
  );
}

async function driveMenu(root: ParentNode, summary: boolean, label: string, confirmLabel?: string) {
  let matched = false;
  for (const trigger of root.querySelectorAll("[data-slot='dropdown-menu-trigger']")) {
    if (!(trigger instanceof HTMLElement)) continue;
    const before = new Set(document.querySelectorAll("[data-slot='dropdown-menu-item']"));
    act(() => {
      trigger.click();
    });
    const items = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].filter((element) => !before.has(element));
    if (!items.some((element) => element.textContent?.includes("Rename"))) continue;
    const hasAdd = items.some((element) => element.textContent?.includes("Add a new item"));
    if (hasAdd !== !summary) continue;
    matched = true;
    const item = items.find((element) => element.textContent?.includes(label));
    const sub = [...document.querySelectorAll("[data-slot='dropdown-menu-sub-trigger']")].find((element) =>
      element.textContent?.includes(label),
    );
    await act(async () => {
      if (item instanceof HTMLElement) item.click();
      if (sub instanceof HTMLElement) {
        sub.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
        sub.click();
      }
    });
    break;
  }
  if (!matched) throw new Error(`missing ${summary ? "summary" : "experience"} menu`);
  if (!confirmLabel) return;
  const button = [...document.querySelectorAll("button")].find((element) => element.textContent?.trim() === confirmLabel);
  await act(async () => {
    button?.click();
  });
}

async function renameSection(root: ParentNode, summary: boolean, next: string) {
  await driveMenu(root, summary, "Rename");
  const input = document.querySelector("[role='alertdialog'] input");
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (input instanceof HTMLInputElement && setValue) {
    await act(async () => {
      setValue.call(input, next);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  const confirm = [...document.querySelectorAll("[role='alertdialog'] button")].find((button) =>
    button.textContent?.includes("Confirm"),
  );
  await act(async () => {
    if (confirm instanceof HTMLElement) confirm.click();
  });
}
