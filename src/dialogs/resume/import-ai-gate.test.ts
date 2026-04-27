import { describe, expect, it } from "vite-plus/test";

import { getAiAssistedImportGateState } from "./import-ai-gate";

describe("getAiAssistedImportGateState", () => {
  const jsonTypes = ["skill-verdict-json", "skill-verdict-v4-json", "json-resume-json"] as const;

  it.each(["pdf", "docx"] as const)(
    "returns waiting_for_availability for %s when availability has not loaded yet (regression: not ai_disabled)",
    (importType) => {
      expect(getAiAssistedImportGateState(importType, false, false)).toEqual({
        status: "waiting_for_availability",
      });
      expect(getAiAssistedImportGateState(importType, false, true)).toEqual({
        status: "waiting_for_availability",
      });
    },
  );

  it.each(["pdf", "docx"] as const)("returns ai_disabled for %s when loaded and AI is not configured", (importType) => {
    expect(getAiAssistedImportGateState(importType, true, false)).toEqual({ status: "ai_disabled" });
  });

  it.each(["pdf", "docx"] as const)("returns ready for %s when loaded and AI is available", (importType) => {
    expect(getAiAssistedImportGateState(importType, true, true)).toEqual({ status: "ready" });
  });

  it.each(jsonTypes)("returns ready for %s regardless of loading or canUse", (importType) => {
    expect(getAiAssistedImportGateState(importType, false, false)).toEqual({ status: "ready" });
    expect(getAiAssistedImportGateState(importType, false, true)).toEqual({ status: "ready" });
    expect(getAiAssistedImportGateState(importType, true, false)).toEqual({ status: "ready" });
  });

  it("returns ready for empty type (no AI gate)", () => {
    expect(getAiAssistedImportGateState("", false, false)).toEqual({ status: "ready" });
  });
});
