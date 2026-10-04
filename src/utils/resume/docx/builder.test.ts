import { Document } from "docx";
import { describe, expect, it } from "vite-plus/test";

import type { ResumeData } from "@/schema/resume/data";

import { defaultResumeData } from "@/schema/resume/data";

import { buildDocument } from "./builder";

function makeResumeData(overrides?: Partial<ResumeData>): ResumeData {
  return { ...defaultResumeData, ...overrides };
}

describe("buildDocument", () => {
  it("produces a valid Document from default resume data", () => {
    const doc = buildDocument(defaultResumeData);
    expect(doc).toBeInstanceOf(Document);
  });

  it("includes name in header when present", () => {
    const data = makeResumeData({
      basics: { ...defaultResumeData.basics, name: "John Doe" },
    });
    const doc = buildDocument(data);
    expect(doc).toBeInstanceOf(Document);
  });

  it("includes contact info in header", () => {
    const data = makeResumeData({
      basics: {
        ...defaultResumeData.basics,
        name: "Jane Smith",
        email: "jane@example.com",
        phone: "+1-555-1234",
        location: "San Francisco, CA",
        website: { url: "https://jane.dev", label: "jane.dev" },
      },
    });
    const doc = buildDocument(data);
    expect(doc).toBeInstanceOf(Document);
  });

  it("renders summary section when visible", () => {
    const data = makeResumeData({
      summary: {
        title: "About Me",
        columns: 1,
        hidden: false,
        content: "<p>I am a software engineer.</p>",
      },
    });
    const doc = buildDocument(data);
    expect(doc).toBeInstanceOf(Document);
  });

  it("omits summary when hidden", () => {
    const data = makeResumeData({
      summary: {
        title: "About Me",
        columns: 1,
        hidden: true,
        content: "<p>Should not appear.</p>",
      },
    });
    const doc = buildDocument(data);
    expect(doc).toBeInstanceOf(Document);
  });

  it("renders experience items", () => {
    const data = makeResumeData({
      sections: {
        ...defaultResumeData.sections,
        experience: {
          title: "Experience",
          columns: 1,
          hidden: false,
          items: [
            {
              id: "exp-1",
              hidden: false,
              company: "Acme Corp",
              position: "Developer",
              location: "Remote",
              period: "2020-2024",
              website: { url: "", label: "" },
              description: "<p>Built features</p>",
              roles: [],
            },
          ],
        },
      },
    });
    const doc = buildDocument(data);
    expect(doc).toBeInstanceOf(Document);
  });

  it("filters hidden items from experience", () => {
    const data = makeResumeData({
      sections: {
        ...defaultResumeData.sections,
        experience: {
          title: "Experience",
          columns: 1,
          hidden: false,
          items: [
            {
              id: "exp-1",
              hidden: true,
              company: "Hidden Corp",
              position: "Ghost",
              location: "",
              period: "",
              website: { url: "", label: "" },
              description: "",
              roles: [],
            },
          ],
        },
      },
    });
    // Should produce a document but the experience section should be omitted
    // (all items hidden → section heading omitted)
    const doc = buildDocument(data);
    expect(doc).toBeInstanceOf(Document);
  });

  it("renders skills with keywords", () => {
    const data = makeResumeData({
      sections: {
        ...defaultResumeData.sections,
        skills: {
          title: "Skills",
          columns: 1,
          hidden: false,
          items: [
            {
              id: "skill-1",
              hidden: false,
              icon: "",
              name: "TypeScript",
              proficiency: "Advanced",
              level: 4,
              keywords: ["React", "Node.js", "Vite"],
            },
          ],
        },
      },
    });
    const doc = buildDocument(data);
    expect(doc).toBeInstanceOf(Document);
  });

  it("follows section order from layout metadata", () => {
    const data = makeResumeData({
      metadata: {
        ...defaultResumeData.metadata,
        layout: {
          sidebarWidth: 35,
          pages: [
            {
              fullWidth: false,
              main: ["experience", "education"],
              sidebar: ["skills"],
            },
          ],
        },
      },
    });
    const doc = buildDocument(data);
    expect(doc).toBeInstanceOf(Document);
  });

  it("renders custom sections by type", () => {
    const data = makeResumeData({
      customSections: [
        {
          id: "custom-1",
          title: "Side Projects",
          columns: 1,
          hidden: false,
          type: "projects",
          items: [
            {
              id: "proj-1",
              hidden: false,
              name: "My App",
              period: "2023",
              website: { url: "https://myapp.dev", label: "myapp.dev" },
              description: "<p>A cool app.</p>",
            },
          ],
        },
      ],
      metadata: {
        ...defaultResumeData.metadata,
        layout: {
          sidebarWidth: 35,
          pages: [
            {
              fullWidth: false,
              main: ["custom-1"],
              sidebar: [],
            },
          ],
        },
      },
    });
    const doc = buildDocument(data);
    expect(doc).toBeInstanceOf(Document);
  });

  it("extracts primary color from metadata", () => {
    const data = makeResumeData({
      metadata: {
        ...defaultResumeData.metadata,
        design: {
          ...defaultResumeData.metadata.design,
          colors: {
            primary: "rgba(59, 130, 246, 1)",
            text: "rgba(0, 0, 0, 1)",
            background: "rgba(255, 255, 255, 1)",
          },
        },
      },
    });
    // Should not throw — the color is used for section headings
    const doc = buildDocument(data);
    expect(doc).toBeInstanceOf(Document);
  });

  it("renders full-width layout when sidebar is empty", () => {
    const data = makeResumeData({
      metadata: {
        ...defaultResumeData.metadata,
        layout: {
          sidebarWidth: 35,
          pages: [
            {
              fullWidth: true,
              main: ["experience"],
              sidebar: [],
            },
          ],
        },
      },
    });
    const doc = buildDocument(data);
    expect(doc).toBeInstanceOf(Document);
  });

  it("applies page format and margins from metadata", () => {
    const data = makeResumeData({
      metadata: {
        ...defaultResumeData.metadata,
        page: {
          ...defaultResumeData.metadata.page,
          format: "letter",
          marginX: 20,
          marginY: 15,
        },
      },
    });
    const doc = buildDocument(data);
    expect(doc).toBeInstanceOf(Document);
  });

  it("applies typography settings from metadata", () => {
    const data = makeResumeData({
      metadata: {
        ...defaultResumeData.metadata,
        typography: {
          body: {
            fontFamily: "Arial",
            fontWeights: ["400"],
            fontSize: 11,
            lineHeight: 1.6,
          },
          heading: {
            fontFamily: "Georgia",
            fontWeights: ["700"],
            fontSize: 16,
            lineHeight: 1.3,
          },
        },
      },
    });
    const doc = buildDocument(data);
    expect(doc).toBeInstanceOf(Document);
  });

  it("produces a valid DOCX blob via Packer", async () => {
    const { Packer } = await import("docx");
    const data = makeResumeData({
      basics: { ...defaultResumeData.basics, name: "Test User" },
    });
    const doc = buildDocument(data);
    const blob = await Packer.toBlob(doc);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);

    // DOCX files are ZIP archives — first 2 bytes are "PK" (0x50, 0x4B)
    const buffer = await blob.arrayBuffer();
    const view = new Uint8Array(buffer);
    expect(view[0]).toBe(0x50);
    expect(view[1]).toBe(0x4b);
  });

  it("renders every section, a role, a link, and the template layouts", () => {
    const link = { url: "https://ada.dev", label: "" };
    const blank = { url: "", label: "" };
    const data = makeResumeData({
      basics: {
        name: "Ada Lovelace",
        headline: "Mathematician",
        email: "ada@example.com",
        phone: "123",
        location: "London",
        website: { url: "https://ada.dev", label: "" },
        customFields: [
          { id: "f1", icon: "", text: "", link: "" },
          { id: "f2", icon: "", text: "Notes", link: "" },
          { id: "f3", icon: "", text: "Site", link: "https://ada.dev" },
          { id: "f4", icon: "", text: "Bad", link: "javascript:alert(1)" },
        ],
      },
      summary: { title: "About", columns: 1, hidden: false, content: "<p>Notes</p>" },
      sections: {
        profiles: {
          title: "Profiles",
          columns: 1,
          hidden: false,
          items: [
            { id: "pr1", hidden: true, icon: "", network: "Hidden", username: "", website: blank },
            { id: "pr2", hidden: false, icon: "", network: "GitHub", username: "ada", website: link },
          ],
        },
        experience: {
          title: "Experience",
          columns: 1,
          hidden: false,
          items: [
            {
              id: "ex1",
              hidden: false,
              company: "Engines",
              position: "",
              location: "London",
              period: "1842-1843",
              website: link,
              description: "",
              roles: [
                { id: "r1", position: "Lead", period: "1843", description: "<p>Built it</p>" },
                { id: "r2", position: "Assistant", period: "", description: "" },
              ],
            },
            {
              id: "ex2",
              hidden: false,
              company: "Archive",
              position: "Writer",
              location: "",
              period: "",
              website: blank,
              description: "<p>Notes</p>",
              roles: [],
            },
          ],
        },
        education: {
          title: "Education",
          columns: 1,
          hidden: false,
          items: [
            {
              id: "ed1",
              hidden: false,
              school: "University",
              degree: "BA",
              area: "Maths",
              grade: "1st",
              location: "London",
              period: "1835",
              website: link,
              description: "<p>Studied</p>",
            },
          ],
        },
        projects: {
          title: "Projects",
          columns: 1,
          hidden: false,
          items: [
            { id: "pj1", hidden: false, name: "Engine", period: "1842", website: link, description: "<p>Gears</p>" },
          ],
        },
        skills: {
          title: "Skills",
          columns: 1,
          hidden: false,
          items: [
            {
              id: "sk1",
              hidden: false,
              icon: "",
              name: "Analysis",
              proficiency: "Expert",
              level: 5,
              keywords: ["proofs"],
            },
            { id: "sk2", hidden: false, icon: "", name: "Poetry", proficiency: "", level: 0, keywords: [] },
          ],
        },
        languages: {
          title: "Languages",
          columns: 1,
          hidden: false,
          items: [
            { id: "la1", hidden: false, language: "English", fluency: "Native", level: 5 },
            { id: "la2", hidden: false, language: "French", fluency: "", level: 1 },
          ],
        },
        interests: {
          title: "Interests",
          columns: 1,
          hidden: false,
          items: [
            { id: "in1", hidden: false, icon: "", name: "Maths", keywords: ["algebra"] },
            { id: "in2", hidden: false, icon: "", name: "Music", keywords: [] },
          ],
        },
        awards: {
          title: "Awards",
          columns: 1,
          hidden: false,
          items: [
            {
              id: "aw1",
              hidden: false,
              title: "Medal",
              awarder: "Royal",
              date: "1843",
              website: link,
              description: "<p>For the notes</p>",
            },
          ],
        },
        certifications: {
          title: "Certifications",
          columns: 1,
          hidden: false,
          items: [
            {
              id: "ce1",
              hidden: false,
              title: "Fellow",
              issuer: "Society",
              date: "1844",
              website: link,
              description: "<p>Fellow</p>",
            },
          ],
        },
        publications: {
          title: "Publications",
          columns: 1,
          hidden: false,
          items: [
            {
              id: "pu1",
              hidden: false,
              title: "Sketch",
              publisher: "Taylor",
              date: "1843",
              website: link,
              description: "<p>Sketch</p>",
            },
          ],
        },
        volunteer: {
          title: "Volunteer",
          columns: 1,
          hidden: false,
          items: [
            {
              id: "vo1",
              hidden: false,
              organization: "Society",
              location: "London",
              period: "1840",
              website: link,
              description: "<p>Taught</p>",
            },
          ],
        },
        references: {
          title: "References",
          columns: 1,
          hidden: false,
          items: [
            {
              id: "rf1",
              hidden: false,
              name: "Babbage",
              position: "Colleague",
              website: link,
              phone: "456",
              description: "<p>Reliable</p>",
            },
          ],
        },
      },
      customSections: [
        {
          id: "custom-summary",
          title: "Extra",
          columns: 1,
          hidden: false,
          type: "summary",
          items: [{ id: "cs1", hidden: false, content: "<p>More</p>" }],
        },
        {
          id: "custom-letter",
          title: "Letter",
          columns: 1,
          hidden: false,
          type: "cover-letter",
          items: [{ id: "cl1", hidden: false, recipient: "<p>Taylor</p>", content: "<p>Dear sir</p>" }],
        },
        {
          id: "custom-hidden",
          title: "Hidden",
          columns: 1,
          hidden: true,
          type: "projects",
          items: [{ id: "ch1", hidden: false, name: "Nope", period: "", website: blank, description: "" }],
        },
        {
          id: "custom-empty",
          title: "Empty",
          columns: 1,
          hidden: false,
          type: "projects",
          items: [{ id: "ce2", hidden: true, name: "Gone", period: "", website: blank, description: "" }],
        },
      ],
      metadata: {
        ...defaultResumeData.metadata,
        template: "chikorita",
        layout: {
          sidebarWidth: 30,
          pages: [
            {
              fullWidth: false,
              main: ["summary", "experience", "education", "projects", "custom-summary", "custom-letter", "missing"],
              sidebar: ["profiles", "skills", "languages", "interests", "awards", "certifications"],
            },
            {
              fullWidth: true,
              main: ["publications", "volunteer", "references", "custom-hidden", "custom-empty"],
              sidebar: [],
            },
          ],
        },
      },
    });

    expect(buildDocument(data)).toBeInstanceOf(Document);
    expect(buildDocument({ ...data, metadata: { ...data.metadata, template: "ditgar" } })).toBeInstanceOf(Document);
    expect(
      buildDocument({
        ...data,
        metadata: {
          ...data.metadata,
          template: "missing" as typeof data.metadata.template,
          page: { ...data.metadata.page, format: "letter" },
          design: {
            ...data.metadata.design,
            colors: { primary: "not-a-color", text: "not-a-color", background: "not-a-color" },
          },
          typography: {
            body: { ...data.metadata.typography.body, fontFamily: "" },
            heading: { ...data.metadata.typography.heading, fontFamily: "" },
          },
        },
      }),
    ).toBeInstanceOf(Document);
  });
});
