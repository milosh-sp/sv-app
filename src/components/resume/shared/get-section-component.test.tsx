import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

import type { CustomSection } from "@/schema/resume/data";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
  msg: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useQuery: () => ({ data: undefined }) };
});

import { sampleResumeData } from "@/schema/resume/sample";
import { deriveSkillKeywordId } from "@/utils/verification/skills";

import { useResumeStore } from "../store/resume";
import { getSectionComponent } from "./get-section-component";
import { VerificationProvider } from "./verification-context";

const sections = [
  ["summary", "PageSummary"],
  ["profiles", "ProfilesItem"],
  ["experience", "ExperienceItem"],
  ["education", "EducationItem"],
  ["projects", "ProjectsItem"],
  ["skills", "SkillsItem"],
  ["languages", "LanguagesItem"],
  ["interests", "InterestsItem"],
  ["awards", "AwardsItem"],
  ["certifications", "CertificationsItem"],
  ["publications", "PublicationsItem"],
  ["volunteer", "VolunteerItem"],
  ["references", "ReferencesItem"],
] as const;

describe("getSectionComponent", () => {
  it("resolves each section type to its item component", () => {
    for (const [type, item] of sections) {
      const Component = getSectionComponent(type, { sectionClassName: "section", itemClassName: "item" });
      expect(Component).toEqual(expect.any(Function));
      expect(Function.prototype.toString.call(Component)).toContain(item);
    }

    const custom = getSectionComponent("custom-1");
    expect(Function.prototype.toString.call(custom)).toContain("customSections");
  });

  it("renders every custom section type and skips empty ones", () => {
    const url = { url: "", label: "" };
    const keywordId = deriveSkillKeywordId("skill-kw", "TypeScript");
    const custom = (
      id: string,
      type: CustomSection["type"],
      items: CustomSection["items"],
      hidden = false,
    ): CustomSection => ({ id, type, title: type, columns: 1, hidden, items });

    const sections: CustomSection[] = [
      custom("hidden-section", "summary", [{ id: "h1", hidden: false, content: "<p>x</p>" }], true),
      custom("empty-items", "summary", []),
      custom("all-hidden-items", "summary", [{ id: "ah", hidden: true, content: "<p>x</p>" }]),
      custom("sec-summary", "summary", [
        { id: "sum-empty", hidden: false, content: "" },
        { id: "sum-full", hidden: false, content: "<p>Hello</p>" },
      ]),
      custom("sec-profiles", "profiles", [
        {
          id: "prof-1",
          hidden: false,
          icon: "",
          network: "Web",
          username: "",
          website: { url: "https://example.com", label: "" },
        },
      ]),
      custom("sec-experience", "experience", [
        {
          id: "exp-roles",
          hidden: false,
          company: "Acme",
          position: "",
          location: "Remote",
          period: "2020 - 2024",
          website: url,
          description: "<p>Ignored</p>",
          roles: [
            { id: "role-1", position: "Engineer", period: "2020 - 2022", description: "<p>Shipped</p>" },
            { id: "role-2", position: "Lead", period: "2022 - 2024", description: "" },
          ],
        },
        {
          id: "exp-plain",
          hidden: false,
          company: "Beta",
          position: "Dev",
          location: "",
          period: "2019",
          website: url,
          description: "",
          roles: [],
        },
      ]),
      custom("sec-education", "education", [
        {
          id: "edu-1",
          hidden: false,
          school: "State",
          degree: "",
          area: "",
          grade: "",
          location: "",
          period: "2014",
          website: url,
          description: "",
        },
      ]),
      custom("sec-projects", "projects", [
        { id: "proj-1", hidden: false, name: "Widget", period: "2024", website: url, description: "" },
      ]),
      custom("sec-skills", "skills", [
        { id: "skill-plain", hidden: false, icon: "star", name: "Go", proficiency: "", level: 0, keywords: [] },
        {
          id: "skill-kw",
          hidden: false,
          icon: "star",
          name: "Languages",
          proficiency: "Strong",
          level: 0,
          keywords: ["TypeScript"],
        },
      ]),
      custom("sec-languages", "languages", [
        { id: "lang-1", hidden: false, language: "English", fluency: "Native", level: 0 },
      ]),
      custom("sec-interests", "interests", [{ id: "int-1", hidden: false, icon: "star", name: "Chess", keywords: [] }]),
      custom("sec-awards", "awards", [
        { id: "award-1", hidden: false, title: "Prize", awarder: "Org", date: "2020", website: url, description: "" },
      ]),
      custom("sec-certifications", "certifications", [
        {
          id: "cert-1",
          hidden: false,
          title: "Cert",
          issuer: "Org",
          date: "2020",
          website: url,
          description: "<p>d</p>",
        },
      ]),
      custom("sec-publications", "publications", [
        { id: "pub-1", hidden: false, title: "Paper", publisher: "ACM", date: "2020", website: url, description: "" },
      ]),
      custom("sec-volunteer", "volunteer", [
        {
          id: "vol-1",
          hidden: false,
          organization: "Org",
          location: "",
          period: "2020",
          website: url,
          description: "",
        },
      ]),
      custom("sec-references", "references", [
        { id: "ref-1", hidden: false, name: "Ann", position: "Mgr", website: url, phone: "", description: "" },
      ]),
      custom("sec-letter", "cover-letter", [
        { id: "cl-empty", hidden: false, recipient: "", content: "" },
        { id: "cl-body", hidden: false, recipient: "", content: "<p>Hello hiring</p>" },
        { id: "cl-recipient", hidden: false, recipient: "<p>HR</p>", content: "" },
      ]),
    ];

    const data = structuredClone(sampleResumeData);
    data.customSections = sections;
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: data.basics.name,
      slug: "sample",
      tags: [],
      data,
      isLocked: false,
    });

    const ids = ["does-not-exist", ...sections.map((section) => section.id)];
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <VerificationProvider
          statuses={[
            {
              id: "v-exp",
              sectionType: "experience",
              itemId: "exp-roles",
              itemLabel: "Acme",
              status: "verified",
              badgeVisible: true,
            },
            {
              id: "v-proj",
              sectionType: "project",
              itemId: "proj-1",
              itemLabel: "Widget",
              status: "verified",
              badgeVisible: true,
            },
            {
              id: "v-skill",
              sectionType: "skill",
              itemId: "skill-plain",
              itemLabel: "Go",
              status: "verified",
              badgeVisible: true,
            },
            {
              id: "v-kw",
              sectionType: "skill",
              itemId: keywordId,
              itemLabel: "TypeScript",
              status: "verified",
              badgeVisible: true,
            },
          ]}
        >
          {ids.map((id) => {
            const Component = getSectionComponent(
              id,
              id === "does-not-exist" ? undefined : { sectionClassName: "section", itemClassName: "item" },
            );
            return <Component key={id} id={id} />;
          })}
        </VerificationProvider>,
      );
    });

    expect(container.textContent).toContain("Hello");
    expect(container.textContent).toContain("Acme");
    expect(container.textContent).toContain("Shipped");
    expect(container.textContent).toContain("Widget");
    expect(container.textContent).toContain("TypeScript");
    expect(container.textContent).toContain("https://example.com");
    expect(container.querySelectorAll(".cover-letter-item")).toHaveLength(2);
    expect(container.querySelector(".awards-item-description")?.className).toContain("hidden");
    expect(container.querySelector(".experience-item-role-description")).toBeTruthy();
    expect(container.querySelectorAll("[data-testid='verification-badge-verified']").length).toBeGreaterThan(0);

    act(() => {
      root.unmount();
    });
  });
});
