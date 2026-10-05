import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ResumeData } from "@/schema/resume/data";

import { sampleResumeData } from "@/schema/resume/sample";

const mounted = vi.hoisted(() => ({ value: true }));
const isMounted = vi.hoisted(() => () => mounted.value);

vi.mock("usehooks-ts", () => ({
  useIsMounted: () => isMounted,
}));

import { useWebfonts } from "./use-webfonts";

const originalFontFace = window.FontFace;
const fonts = { has: false, added: 0 };
let savedBody: HTMLElement;

function typography(bodyFamily: string, headingFamily: string): ResumeData["metadata"]["typography"] {
  const base = sampleResumeData.metadata.typography;
  return {
    body: { ...base.body, fontFamily: bodyFamily, fontWeights: ["400"] },
    heading: { ...base.heading, fontFamily: headingFamily, fontWeights: ["400"] },
  };
}

function Probe({ typography: value }: { typography: ResumeData["metadata"]["typography"] }) {
  useWebfonts(value);
  return null;
}

async function render(value: ResumeData["metadata"]["typography"]) {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(<Probe typography={value} />);
  });
  return root;
}

describe("useWebfonts", () => {
  beforeEach(() => {
    mounted.value = true;
    fonts.has = false;
    fonts.added = 0;
    savedBody = document.body;
    savedBody.removeAttribute("data-wf-loaded");
    window.FontFace = class FakeFontFace {
      family: string;
      source: string;
      descriptors?: FontFaceDescriptors;
      constructor(family: string, source: string, descriptors?: FontFaceDescriptors) {
        this.family = family;
        this.source = source;
        this.descriptors = descriptors;
      }
      load() {
        return Promise.resolve(this);
      }
    } as unknown as typeof FontFace;
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        has: () => fonts.has,
        add: () => {
          fonts.added += 1;
        },
      },
    });
  });

  afterEach(() => {
    if (!document.body) document.documentElement.append(savedBody);
    savedBody.removeAttribute("data-wf-loaded");
  });

  afterAll(() => {
    window.FontFace = originalFontFace;
    Reflect.deleteProperty(document, "fonts");
  });

  it("returns before loading when the effect runs before mount", async () => {
    mounted.value = false;
    const root = await render(typography("Roboto", "Roboto"));

    expect(document.body.hasAttribute("data-wf-loaded")).toBe(false);
    expect(fonts.added).toBe(0);
    await act(async () => {
      root.unmount();
    });
  });

  it("skips unknown fonts and fonts already on the document", async () => {
    fonts.has = true;
    const root = await render(typography("Roboto", "Not A Real Font"));

    expect(document.body.getAttribute("data-wf-loaded")).toBe("true");
    expect(fonts.added).toBe(0);
    await act(async () => {
      root.unmount();
    });
  });

  it("ignores a missing document body and cleans up without one", async () => {
    fonts.has = true;
    savedBody.remove();
    expect(document.body).toBeNull();

    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Probe typography={typography("Roboto", "Roboto")} />);
    });
    await act(async () => {
      root.render(<Probe typography={typography("Open Sans", "Roboto")} />);
    });
    await act(async () => {
      root.unmount();
    });
  });

  it("loads a missing font and clears the flag on cleanup", async () => {
    const root = await render(typography("Roboto", "Roboto"));
    expect(fonts.added).toBeGreaterThan(0);
    expect(document.body.getAttribute("data-wf-loaded")).toBe("true");

    await act(async () => {
      root.render(<Probe typography={typography("Open Sans", "Roboto")} />);
    });
    expect(document.body.getAttribute("data-wf-loaded")).toBe("true");

    mounted.value = false;
    await act(async () => {
      root.unmount();
    });
  });
});
