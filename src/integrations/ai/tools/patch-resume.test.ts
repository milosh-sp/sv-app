import { describe, expect, it } from "vite-plus/test";

import { defaultResumeData } from "@/schema/resume/data";
import { ResumePatchError } from "@/utils/resume/patch";

import { executePatchResume } from "./patch-resume";

describe("executePatchResume", () => {
  it("returns the patched resume and rejects a missing path", () => {
    const result = executePatchResume(defaultResumeData, [
      { op: "replace", path: "/summary/content", value: "<p>Hi</p>" },
    ]);

    expect(result.success).toBe(true);
    expect(result.appliedOperations).toHaveLength(1);
    expect(result.data.summary.content).toBe("<p>Hi</p>");
    expect(defaultResumeData.summary.content).not.toBe("<p>Hi</p>");

    expect(() => executePatchResume(defaultResumeData, [{ op: "replace", path: "/missing", value: "x" }])).toThrow(
      ResumePatchError,
    );
  });
});
