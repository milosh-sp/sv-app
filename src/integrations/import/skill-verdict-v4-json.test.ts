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

  it("maps every section and clamps design values", () => {
    const parsed = importer.parse(
      JSON.stringify({
        basics: {
          name: "Ada Lovelace",
          email: "ada@example.com",
          url: { href: "https://ada.dev", label: "ada.dev" },
          customFields: [
            { icon: "star", text: "Notes" },
            { id: "field-1", text: "Known" },
          ],
          picture: {
            url: "https://ada.dev/a.png",
            size: 1,
            aspectRatio: 9,
            borderRadius: -4,
            effects: { hidden: true, border: true, grayscale: false },
          },
        },
        sections: {
          summary: { name: "About", columns: 2, visible: true, content: "<p>Math</p>" },
          profiles: {
            name: "Profiles",
            items: [
              { id: "p1", network: "GitHub", username: "ada", url: { href: "https://github.com/ada", label: "gh" } },
              { network: "" },
            ],
          },
          experience: {
            name: "Work",
            visible: false,
            items: [
              { company: "", position: "Ghost" },
              {
                id: "e1",
                visible: false,
                company: "Analytical Engines",
                position: "Programmer",
                location: "London",
                date: "1843",
                summary: "<p>Notes</p>",
                url: { href: "https://ada.dev/work", label: "work" },
              },
            ],
          },
          education: { items: [{ institution: "" }, { institution: "University", studyType: "BA", area: "Maths" }] },
          projects: { items: [{ name: "" }, { name: "Engine", description: "Difference" }] },
          skills: {
            items: [
              { name: "", keywords: ["x"] },
              { name: "Analysis", level: 9, keywords: ["proofs"] },
              { name: "Poetry", level: -2 },
            ],
          },
          languages: { items: [{ name: "English", description: "Native", level: 5 }, { name: "" }] },
          interests: { items: [{ name: "Maths", keywords: ["algebra"] }, {}] },
          awards: { items: [{ title: "Medal", awarder: "Royal", date: "1843" }, { awarder: "Nobody" }] },
          certifications: { items: [{ name: "Fellow" }, {}] },
          publications: { items: [{ name: "Notes", publisher: "Taylor", summary: "<p>Sketch</p>" }] },
          volunteer: { items: [{ organization: "Society", location: "London" }, {}] },
          references: { items: [{ name: "Babbage", description: "Colleague", summary: "Reliable" }, {}] },
          custom: {
            "side-work": {
              id: "side-work",
              name: "Side",
              visible: true,
              items: [
                { visible: false, name: "Hidden" },
                { name: "  ", description: "Untitled", date: "1842", location: "Home" },
              ],
            },
          },
        },
        metadata: {
          template: "not-a-template",
          layout: [[["summary", "custom.side-work"], []], [["experience"]]],
          css: { visible: true, value: ".page{}" },
          page: { margin: -3, format: "letter" },
          theme: { background: "#fff", text: "rgb(1, 2, 3)", primary: "nope" },
          typography: {
            font: { family: "Source Serif", variants: ["bold-italic", "200", "nope"], size: 1 },
            lineHeight: 0.1,
            hideIcons: true,
          },
          notes: "private",
        },
      }),
    );

    expect(parsed.picture).toMatchObject({
      hidden: true,
      size: 32,
      aspectRatio: 2.5,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: "rgba(0, 0, 0, 0.5)",
    });
    expect(parsed.basics.website).toEqual({ url: "https://ada.dev", label: "ada.dev" });
    expect(parsed.basics.customFields).toHaveLength(2);
    expect(parsed.summary).toMatchObject({ title: "About", columns: 2, hidden: false, content: "<p>Math</p>" });
    expect(parsed.sections.profiles.items).toHaveLength(1);
    expect(parsed.sections.experience).toMatchObject({ hidden: true });
    expect(parsed.sections.experience.items[0]).toMatchObject({ company: "Analytical Engines", hidden: true });
    expect(parsed.sections.education.items[0]).toMatchObject({ school: "University", degree: "BA", area: "Maths" });
    expect(parsed.sections.projects.items[0]).toMatchObject({ name: "Engine", description: "Difference" });
    expect(parsed.sections.skills.items.map((item) => item.level)).toEqual([5, 0]);
    expect(parsed.sections.languages.items[0]).toMatchObject({ language: "English", fluency: "Native", level: 5 });
    expect(parsed.sections.interests.items[0]).toMatchObject({ name: "Maths", keywords: ["algebra"] });
    expect(parsed.sections.awards.items[0]).toMatchObject({ title: "Medal", awarder: "Royal" });
    expect(parsed.sections.certifications.items[0]).toMatchObject({ title: "Fellow" });
    expect(parsed.sections.publications.items[0]).toMatchObject({ title: "Notes", publisher: "Taylor" });
    expect(parsed.sections.volunteer.items[0]).toMatchObject({ organization: "Society", location: "London" });
    expect(parsed.sections.references.items[0]).toMatchObject({ name: "Babbage", position: "Colleague" });
    expect(parsed.customSections[0]?.items.map((item) => ("company" in item ? item.company : undefined))).toEqual([
      "#1",
    ]);
    expect(parsed.metadata.template).toBe("onyx");
    expect(parsed.metadata.layout.pages[0]).toMatchObject({
      fullWidth: true,
      main: ["summary", "side-work"],
      sidebar: [],
    });
    expect(parsed.metadata.design.colors).toEqual({
      primary: "rgba(0, 0, 0, 1)",
      text: "rgba(1, 2, 3, 1)",
      background: "rgba(255, 255, 255, 1)",
    });
    expect(parsed.metadata.typography.body).toMatchObject({
      fontFamily: "Source Serif",
      fontWeights: ["700", "200", "400"],
      fontSize: 6,
      lineHeight: 0.5,
    });
    expect(parsed.metadata.typography.heading.fontWeights).toEqual(["700", "600"]);
    expect(parsed.metadata.page).toMatchObject({ marginX: 0, marginY: 0, format: "letter", hideIcons: true });
    expect(parsed.metadata.css).toEqual({ enabled: true, value: ".page{}" });
  });

  it("throws on invalid JSON and on data the resume schema rejects", () => {
    expect(() => importer.parse("{")).toThrow();
    expect(() =>
      importer.parse(JSON.stringify({ ...v4Resume({ email: "ada@example.com" }), metadata: { notes: 1 } })),
    ).toThrow(Error);
  });
});
