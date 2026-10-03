import { describe, expect, it } from "vite-plus/test";

import { resumeDataSchema } from "@/schema/resume/data";

import { SkillVerdictV4JSONImporter } from "./skill-verdict-v4-json";

const importer = new SkillVerdictV4JSONImporter();

function v4Resume(overrides: { email: string }) {
  return {
    basics: {
      name: "Ada Lovelace",
      email: overrides.email,
      picture: { size: 900, borderRadius: 200, aspectRatio: 1 },
    },
    sections: {},
    metadata: {
      template: "onyx",
      layout: [[["summary", "custom.11111111-1111-1111-1111-111111111111", "experience"], ["skills"]]],
    },
  };
}

describe("SkillVerdictV4JSONImporter", () => {
  it("clamps picture fields and strips legacy layout ids", () => {
    const parsed = importer.parse(JSON.stringify(v4Resume({ email: "not-an-email" })));

    expect(resumeDataSchema.safeParse(parsed).success).toBe(true);
    expect(parsed.basics.email).toBe("");
    expect(parsed.picture.size).toBe(512);
    expect(parsed.picture.borderRadius).toBe(100);
    expect(parsed.metadata.layout.pages[0]).toMatchObject({
      main: ["11111111-1111-1111-1111-111111111111", "experience"],
      sidebar: ["skills"],
    });
    expect(parsed.metadata.layout.pages[0]?.main).not.toContain("summary");
  });

  it("keeps a valid email", () => {
    const parsed = importer.parse(JSON.stringify(v4Resume({ email: "ada@example.com" })));

    expect(parsed.basics.email).toBe("ada@example.com");
  });
});