import { dehydrate, hydrate } from "@tanstack/react-query";
import Cookies from "js-cookie";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { CustomSection, SectionType } from "@/schema/resume/data";

import { createJobSearchProvider } from "@/integrations/jobs/factory";
import { JSearchProvider } from "@/integrations/jobs/providers/jsearch";
import { getQueryClient } from "@/integrations/query/client";
import { defaultResumeData } from "@/schema/resume/data";
import { sampleResumeData } from "@/schema/resume/sample";
import { formatDefaultDate, formatDefaultDateTime } from "@/utils/format-date";
import { hashPassword, verifyPassword } from "@/utils/password";
import { buildDocx } from "@/utils/resume/docx";
import { toSafeDocxLink } from "@/utils/resume/docx/link-utils";
import { renderBuiltInSection, renderCustomSection } from "@/utils/resume/docx/section-renderers";
import { removeItemFromSource } from "@/utils/resume/move-item";
import { applyResumePatches, ResumePatchError } from "@/utils/resume/patch";
import { generateRandomName } from "@/utils/string";
import { getTheme, isTheme } from "@/utils/theme";

vi.mock("@lingui/core/macro", () => ({
  msg: (strings: TemplateStringsArray) => ({ id: strings[0] }),
  t: (strings: TemplateStringsArray) => strings.join(""),
}));

const jsonpatch = vi.hoisted(() => ({
  validate: vi.fn((): undefined => undefined),
  applyPatch: vi.fn(),
}));

vi.mock("fast-json-patch", () => ({
  default: jsonpatch,
}));

describe("leftover pure logic", () => {
  beforeEach(() => {
    jsonpatch.validate.mockReset();
    jsonpatch.validate.mockReturnValue(undefined);
    jsonpatch.applyPatch.mockReset();
  });

  it("exports the sample resume, including a hidden section, an empty section, and a link", async () => {
    const data = structuredClone(sampleResumeData);
    data.sections.awards.hidden = true;
    data.sections.publications.items = [];
    const role = data.sections.experience.items[0];
    if (!role) throw new Error("sample resume has no experience item");
    data.sections.experience.items[0] = {
      ...role,
      website: { url: "https://example.com/role", label: "Role" },
    };

    const blob = await buildDocx(data);

    expect(blob.size).toBeGreaterThan(100);
    expect(renderBuiltInSection("nope" as SectionType, data.sections.experience, "#000")).toEqual([]);
    expect(
      renderCustomSection(
        {
          id: "custom-unknown",
          title: "Unknown",
          columns: 1,
          hidden: false,
          type: "nope",
          items: [{ id: "item-1", hidden: false }],
        } as unknown as CustomSection,
        "#000",
      ),
    ).toEqual([]);
    expect(toSafeDocxLink("not a url")).toBeNull();
  });

  it("hashes a password and rejects a different one", async () => {
    const hash = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("builds a JSearch provider", () => {
    expect(createJobSearchProvider("key")).toBeInstanceOf(JSearchProvider);
  });

  it("formats dates and treats invalid input as empty", () => {
    expect(formatDefaultDate(new Date("2024-03-05T00:00:00.000Z"))).toBe("05/03/2024");
    expect(formatDefaultDate("nope")).toBe("");
    expect(formatDefaultDateTime(new Date("2024-03-05T15:04:00.000Z"))).toBe("05/03/2024, 15:04");
    expect(formatDefaultDateTime(Number.NaN)).toBe("");
  });

  it("generates a three-word name", () => {
    expect(generateRandomName().split(" ")).toHaveLength(3);
  });

  it("reads a theme cookie and ignores junk", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("sepia")).toBe(false);
    Cookies.set("theme", "light");
    expect(getTheme()).toBe("light");
    Cookies.set("theme", "sepia");
    expect(getTheme()).toBe("dark");
    Cookies.remove("theme");
  });

  it("round-trips query data and skips invalidation when a mutation asks", async () => {
    const at = new Date("2024-01-02T00:00:00.000Z");
    const client = getQueryClient();
    client.setQueryData(["resume", { id: "1" }], { at });

    const next = getQueryClient();
    hydrate(next, dehydrate(client));
    expect(next.getQueryData(["resume", { id: "1" }])).toEqual({ at });

    const invalidate = vi.spyOn(client, "invalidateQueries");
    await client.getMutationCache().build(client, { mutationFn: async () => "ok" }).execute({});
    expect(invalidate).toHaveBeenCalledOnce();

    invalidate.mockClear();
    await client
      .getMutationCache()
      .build(client, { mutationFn: async () => "ok", meta: { noInvalidate: true } })
      .execute({});
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("removes an item from a custom section", () => {
    const resume = structuredClone(defaultResumeData);
    const item = {
      id: "exp-custom",
      hidden: false,
      company: "Acme",
      position: "Engineer",
      location: "",
      period: "",
      website: { url: "", label: "" },
      description: "",
      roles: [],
    };
    resume.customSections = [
      { id: "custom-1", type: "experience", title: "Contracts", columns: 1, hidden: false, items: [item] },
    ];

    expect(removeItemFromSource(resume, item.id, "experience", "custom-1")).toMatchObject({ id: item.id });
    expect(resume.customSections[0]?.items).toEqual([]);
  });

  it("converts a thrown patch error and rethrows anything else", () => {
    const operation = { op: "replace" as const, path: "/basics/name", value: "Ada" };
    const mismatch = new Error("mismatch");
    mismatch.name = "TEST_OPERATION_FAILED";
    Object.assign(mismatch, { index: 4, operation });
    jsonpatch.applyPatch.mockImplementation(() => {
      throw mismatch;
    });

    expect(() => applyResumePatches(defaultResumeData, [operation])).toThrow(ResumePatchError);

    jsonpatch.applyPatch.mockImplementation(() => {
      throw new Error("disk");
    });
    expect(() => applyResumePatches(defaultResumeData, [operation])).toThrow("disk");
  });
});
