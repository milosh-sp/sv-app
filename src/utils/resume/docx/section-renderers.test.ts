import { describe, expect, it } from "vite-plus/test";

import { sampleResumeData } from "@/schema/resume/sample";

function blankOptionals(value: unknown) {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const key of ["description", "location", "grade", "username", "content", "recipient"]) {
    if (key in record) record[key] = "";
  }
  if (record.website && typeof record.website === "object") {
    const website = record.website as { url: string; label: string };
    website.url = "";
    website.label = "";
  }
  if (Array.isArray(record.roles)) {
    for (const role of record.roles) blankOptionals(role);
  }
  if (Array.isArray(record.items)) {
    for (const item of record.items) blankOptionals(item);
  }
}

describe("section renderers", () => {
  it("renders sparse sections before typography is configured", async () => {
    const { renderBuiltInSection, renderCustomSection, renderSummary, setRenderConfig } =
      await import("./section-renderers");
    const data = structuredClone(sampleResumeData);
    blankOptionals(data.sections);
    for (const section of Object.values(data.sections)) blankOptionals(section);
    data.summary.content = "";

    expect(renderSummary(data.summary, "000000")).toEqual([]);
    expect(renderSummary({ ...data.summary, content: "<p>Hi</p>", title: "" }, "000000").length).toBeGreaterThan(0);
    data.sections.experience.items[0] = {
      ...data.sections.experience.items[0]!,
      location: "",
      description: "",
      roles: [],
    };
    renderBuiltInSection("experience", data.sections.experience, "000000");
    data.sections.experience.items[0] = {
      ...data.sections.experience.items[0]!,
      roles: [{ id: "role-1", position: "Dev", period: "", description: "" }],
    };
    renderBuiltInSection("experience", data.sections.experience, "000000");
    setRenderConfig({
      headingFont: "",
      headingSizeHalfPt: 0,
      bodyFont: "",
      bodySizeHalfPt: 0,
      textColorHex: "",
      primaryColorHex: "",
    });
    data.sections.experience.items[0] = {
      ...data.sections.experience.items[0]!,
      location: "Seattle",
      website: { url: "https://example.com", label: "" },
    };
    expect(renderBuiltInSection("experience", data.sections.experience, "000000").length).toBeGreaterThan(0);
    for (const type of Object.keys(data.sections)) {
      const section = data.sections[type as keyof typeof data.sections];
      expect(renderBuiltInSection(type as keyof typeof data.sections, section, "000000")).toEqual(expect.any(Array));
    }

    const custom = data.customSections[0];
    if (!custom) throw new Error("sample resume has no custom section");
    expect(renderCustomSection({ ...custom, hidden: true }, "000000")).toEqual([]);
    expect(renderCustomSection({ ...custom, items: [] }, "000000")).toEqual([]);
    expect(
      renderCustomSection(
        { ...custom, type: "summary", items: [{ id: custom.id, hidden: false, content: "" }] },
        "000000",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      renderCustomSection(
        { ...custom, type: "cover-letter", items: [{ id: custom.id, hidden: false, content: "", recipient: "" }] },
        "000000",
      ).length,
    ).toBeGreaterThan(0);
    expect(renderCustomSection({ ...custom, type: "not-a-section" as never }, "000000")).toEqual([]);
    expect(renderBuiltInSection("not-a-section" as never, data.sections.experience, "000000")).toEqual([]);
  });
});
