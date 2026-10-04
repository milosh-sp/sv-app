import { describe, expect, it } from "vite-plus/test";

import { resumeDataSchema } from "@/schema/resume/data";

import { JSONResumeImporter } from "./json-resume";

const importer = new JSONResumeImporter();

describe("JSONResumeImporter", () => {
  it("maps work, a GitHub profile, and an expert skill into resume data", () => {
    const parsed = importer.parse(
      JSON.stringify({
        basics: {
          name: "Ada Lovelace",
          profiles: [{ network: "GitHub", username: "ada", url: "https://github.com/ada" }],
        },
        work: [
          {
            name: "TechCorp",
            position: "Engineer",
            startDate: "2020-03",
            summary: "Built things",
            highlights: ["Shipped"],
          },
        ],
        skills: [{ name: "TypeScript", level: "Expert", keywords: ["types"] }],
      }),
    );

    expect(resumeDataSchema.safeParse(parsed).success).toBe(true);
    expect(parsed.sections.experience.items[0]).toMatchObject({
      company: "TechCorp",
      position: "Engineer",
      period: "01/03/2020 - Present",
      description: "<p>Built things</p><ul><li>Shipped</li></ul>",
    });
    expect(parsed.sections.profiles.items[0]).toMatchObject({
      icon: "github-logo",
      network: "GitHub",
      username: "ada",
    });
    expect(parsed.sections.skills.items[0]).toMatchObject({
      name: "TypeScript",
      level: 5,
      proficiency: "Expert",
    });
  });

  it("throws when the JSON is invalid or fails the resume schema", () => {
    expect(() => importer.parse("{")).toThrow();
    expect(() => importer.parse(JSON.stringify({ basics: { email: "not-an-email" } }))).toThrow(Error);
    const bare = importer.parse(JSON.stringify({ basics: { name: "Ada", location: { countryCode: "GB" } } }));
    expect(bare.basics.location).toBe("GB");
    const cityOnly = importer.parse(JSON.stringify({ basics: { name: "Ada", location: { city: "London" } } }));
    expect(cityOnly.basics.location).toBe("London");
    const empty = importer.parse(
      JSON.stringify({ basics: { name: "Ada" }, work: [{ name: "Lab", highlights: [] }], skills: [{ name: "Math" }] }),
    );
    expect(empty.basics.location).toBe("");
    expect(empty.sections.experience.items[0]?.description).not.toContain("<ul>");
  });

  it("fills blanks when optional JSON Resume fields are missing", () => {
    const parsed = importer.parse(
      JSON.stringify({
        basics: { profiles: [{ network: "GitHub" }] },
        work: [{ name: "Lab", endDate: "2020-03-04" }],
        education: [{ institution: "UCL" }],
        projects: [{ name: "Engine" }],
        skills: [{ name: "Math" }],
        languages: [{ language: "English" }],
        interests: [{ name: "Chess" }],
        awards: [{ title: "Prize" }],
        certificates: [{ name: "Cert" }],
        publications: [{ name: "Paper" }],
        volunteer: [{ organization: "RAS" }],
        references: [{ name: "Charles" }],
      }),
    );

    expect(parsed.basics.name).toBe("");
    expect(parsed.sections.experience.items[0]?.period).toBe("04/03/2020");
    expect(parsed.sections.education.items[0]?.degree).toBe("");
    expect(parsed.sections.languages.items[0]?.fluency).toBe("");
    expect(parsed.sections.skills.items[0]?.keywords).toEqual([]);
    expect(parsed.sections.awards.items[0]?.awarder).toBe("");
    expect(parsed.sections.certifications.items[0]?.issuer).toBe("");
    expect(parsed.sections.publications.items[0]?.publisher).toBe("");
    expect(parsed.sections.publications.items[0]?.description).toBe("");
    expect(parsed.sections.references.items[0]?.description).toBe("");
  });

  it("maps the remaining sections, dates, networks, and levels", () => {
    const parsed = importer.parse(
      JSON.stringify({
        basics: {
          name: "Ada Lovelace",
          label: "Mathematician",
          image: "https://ada.dev/a.png",
          email: "ada@example.com",
          phone: "123",
          url: "https://ada.dev",
          summary: "First programmer",
          location: { city: "London", region: "England", countryCode: "GB" },
          profiles: [
            { network: "LinkedIn", username: "ada" },
            { network: "Twitter", username: "ada" },
            { network: "x.com", username: "ada", url: "https://x.com/ada" },
            { network: "Facebook" },
            { network: "Instagram" },
            { network: "YouTube" },
            { network: "StackOverflow" },
            { network: "stack-overflow" },
            { network: "Medium" },
            { network: "dev.to" },
            { network: "devto" },
            { network: "Dribbble" },
            { network: "Behance" },
            { network: "GitLab" },
            { network: "Bitbucket" },
            { network: "CodePen" },
            { network: "Website" },
            { username: "ignored" },
          ],
        },
        work: [
          { name: "Engines", position: "Lead", startDate: "2020-03-15", endDate: "2021-01", url: "https://ada.dev/w" },
          { name: "Consulting", startDate: "2018" },
          { name: "Archive", endDate: "2019-06-02" },
          { name: "Quiet" },
          { name: "Summary", summary: "Only a summary" },
          { name: "Highlights", highlights: ["Only a highlight"] },
          {},
        ],
        education: [
          {
            institution: "University",
            area: "Maths",
            studyType: "BA",
            score: "1st",
            startDate: "2016-09",
            endDate: "2018",
            url: "https://uni.edu",
            courses: ["Algebra"],
          },
          { institution: "School", studyType: "A-level" },
          { area: "Dropped" },
        ],
        projects: [
          { name: "Engine", description: "Difference", startDate: "1842", endDate: "1843", highlights: ["Gears"] },
          { description: "Nameless" },
        ],
        skills: [
          { name: "Numeric", level: "3" },
          { name: "Native", level: "Native speaker" },
          { name: "Fluent", level: "Fluent" },
          { name: "Mid", level: "Intermediate" },
          { name: "Beginner", level: "Beginner" },
          { name: "Novice", level: "Novice" },
          { name: "C2", level: "C2" },
          { name: "C1", level: "C1" },
          { name: "B2", level: "B2" },
          { name: "B1", level: "B1" },
          { name: "A2", level: "A2" },
          { name: "A1", level: "A1" },
          { name: "Too high", level: "6" },
          { name: "Unknown", level: "wizard" },
          { name: "Unset" },
          { level: "Expert" },
        ],
        languages: [
          { language: "English", fluency: "Master" },
          { language: "French", fluency: "Conversational" },
          { language: "Latin", fluency: "Elementary" },
          { fluency: "Basic" },
        ],
        interests: [{ name: "Maths", keywords: ["algebra"] }, { keywords: ["none"] }],
        awards: [
          { title: "Medal", awarder: "Royal", date: "1843-08-15", summary: "For the notes" },
          { awarder: "Nobody" },
          { title: "Undated" },
        ],
        certificates: [
          { name: "Fellow", issuer: "Society", date: "1844", url: "https://ada.dev/cert" },
          { issuer: "Missing name" },
        ],
        publications: [
          { name: "Sketch", publisher: "Taylor", releaseDate: "1843-10", summary: "Notes", url: "https://ada.dev/p" },
          { publisher: "Orphan" },
        ],
        volunteer: [
          { organization: "Society", startDate: "1840-01-02", highlights: ["Taught"] },
          { position: "Helper" },
        ],
        references: [{ name: "Babbage", reference: "Colleague" }, {}],
        meta: { version: "1.0.0" },
      }),
    );

    expect(parsed.basics).toMatchObject({
      headline: "Mathematician",
      location: "London, England, GB",
      website: { url: "https://ada.dev", label: "https://ada.dev" },
    });
    expect(parsed.picture.url).toBe("https://ada.dev/a.png");
    expect(parsed.summary.content).toBe("<p>First programmer</p>");
    expect(parsed.sections.experience.items.map((item) => item.period)).toEqual([
      "15/03/2020 - 01/01/2021",
      "2018 - Present",
      "02/06/2019",
      "",
      "",
      "",
    ]);
    expect(parsed.sections.experience.items[0]?.description).toBe("");
    expect(parsed.sections.experience.items[4]?.description).toBe("<p>Only a summary</p>");
    expect(parsed.sections.experience.items[5]?.description).toBe("<ul><li>Only a highlight</li></ul>");
    expect(parsed.sections.education.items[0]).toMatchObject({
      school: "University",
      degree: "BA in Maths",
      grade: "1st",
      period: "01/09/2016 - 2018",
      description: "<ul><li>Algebra</li></ul>",
    });
    expect(parsed.sections.education.items[1]?.degree).toBe("A-level");
    expect(parsed.sections.projects.items).toHaveLength(1);
    expect(parsed.sections.projects.items[0]?.period).toBe("1842 - 1843");
    expect(parsed.sections.skills.items.map((item) => [item.name, item.level])).toEqual([
      ["Numeric", 3],
      ["Native", 5],
      ["Fluent", 4],
      ["Mid", 3],
      ["Beginner", 2],
      ["Novice", 1],
      ["C2", 5],
      ["C1", 4],
      ["B2", 3],
      ["B1", 2],
      ["A2", 1],
      ["A1", 1],
      ["Too high", 0],
      ["Unknown", 0],
      ["Unset", 0],
    ]);
    expect(parsed.sections.languages.items.map((item) => item.level)).toEqual([5, 3, 2]);
    expect(parsed.sections.interests.items).toHaveLength(1);
    expect(parsed.sections.awards.items[0]).toMatchObject({ date: "15/08/1843", description: "<p>For the notes</p>" });
    expect(parsed.sections.awards.items[1]?.date).toBe("");
    expect(parsed.sections.certifications.items[0]).toMatchObject({
      title: "Fellow",
      date: "1844",
      website: { url: "https://ada.dev/cert", label: "https://ada.dev/cert" },
    });
    expect(parsed.sections.publications.items[0]).toMatchObject({ date: "01/10/1843", publisher: "Taylor" });
    expect(parsed.sections.volunteer.items[0]?.description).toBe("<ul><li>Taught</li></ul>");
    expect(parsed.sections.references.items.map((item) => item.name)).toEqual(["Babbage"]);
    expect(() => importer.parse(JSON.stringify({ work: [{ position: "Consultant" }] }))).toThrow(Error);
    expect(() => importer.parse(JSON.stringify({ references: [{ reference: "Anonymous" }] }))).toThrow(Error);
    expect(parsed.sections.profiles.items.map((item) => item.icon)).toEqual([
      "linkedin-logo",
      "twitter-logo",
      "twitter-logo",
      "facebook-logo",
      "instagram-logo",
      "youtube-logo",
      "stack-overflow-logo",
      "stack-overflow-logo",
      "medium-logo",
      "code",
      "code",
      "dribbble-logo",
      "behance-logo",
      "git-branch",
      "code",
      "code",
      "star",
    ]);
    expect(parsed.sections.profiles.items[2]?.website).toEqual({ url: "https://x.com/ada", label: "ada" });
  });
});
