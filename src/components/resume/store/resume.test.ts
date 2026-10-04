import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { defaultResumeData } from "@/schema/resume/data";

const update = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/orpc/client", () => ({
  orpc: { resume: { update: { call: update } } },
}));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

import { flushResumeSave, useResumeStore } from "./resume";

function readyResume(isLocked: boolean) {
  return {
    id: "resume-1",
    name: "CV",
    slug: "cv",
    tags: [] as string[],
    data: structuredClone(defaultResumeData),
    isLocked,
  };
}

describe("resume editor store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    update.mockReset();
    useResumeStore.getState().initialize(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not edit or save a locked resume", () => {
    useResumeStore.getState().initialize(readyResume(true));

    useResumeStore.getState().updateResumeData((draft) => {
      draft.summary.content = "<p>Nope</p>";
    });
    vi.advanceTimersByTime(500);

    expect(useResumeStore.getState().resume.data.summary.content).toBe("");
    expect(update).not.toHaveBeenCalled();
  });

  it("sends immediately on flush and does not send the debounced copy later", () => {
    useResumeStore.getState().initialize(readyResume(false));

    useResumeStore.getState().updateResumeData((draft) => {
      draft.summary.content = "<p>Next</p>";
    });
    flushResumeSave();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      id: "resume-1",
      data: { summary: { content: "<p>Next</p>" } },
    });

    vi.advanceTimersByTime(500);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("restores the previous resume on undo and saves it", () => {
    useResumeStore.getState().initialize(readyResume(false));

    useResumeStore.getState().updateResumeData((draft) => {
      draft.summary.content = "<p>Next</p>";
    });
    useResumeStore.getState().undo();

    expect(useResumeStore.getState().resume.data.summary.content).toBe("");
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      id: "resume-1",
      data: { summary: { content: "" } },
    });
  });

  it("clears readiness and history when initialized with nothing", () => {
    useResumeStore.getState().initialize(readyResume(false));
    useResumeStore.getState().updateResumeData((draft) => {
      draft.summary.content = "<p>Next</p>";
    });

    useResumeStore.getState().initialize(null);

    expect(useResumeStore.getState().isReady).toBe(false);
    expect(useResumeStore.temporal.getState().pastStates).toEqual([]);
  });
});
