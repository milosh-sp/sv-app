import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

import { RedactedExperiencePanel, ReviewerSkillContextPanel } from "./reviewer-context-panels";

const skill = {
  sectionType: "skill",
  itemLabel: "C#",
  parentItemLabel: "Unity",
  proficiency: "Expert",
  level: 5,
  keywords: ["Editor"],
} as never;

describe("reviewer context panels", () => {
  it("shows project and skill details and expands redacted experience", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <>
          <ReviewerSkillContextPanel
            skillContext={
              {
                sectionType: "project",
                name: "Game",
                itemLabel: "Game",
                period: "2020",
                description: "<p>Built</p>",
              } as never
            }
          />
          <ReviewerSkillContextPanel
            skillContext={{ sectionType: "project", itemLabel: "Untitled" } as never}
          />
          <ReviewerSkillContextPanel skillContext={skill} />
          <ReviewerSkillContextPanel
            skillContext={
              { sectionType: "skill", itemLabel: "Go", parentItemLabel: "", proficiency: "", level: 0, keywords: [] } as never
            }
          />
          <RedactedExperiencePanel relatedExperience={[]} />
          <RedactedExperiencePanel
            relatedExperience={
              [
                {
                  position: "Engineer",
                  period: "2020",
                  description: "<p>Work</p>",
                  roles: [{ position: "Lead", period: "2021", description: "<p>Led</p>" }],
                },
                { position: "", period: "", description: "", roles: [{ position: "IC", period: "", description: "" }] },
              ] as never
            }
          />
        </>,
      );
    });
    expect(container.textContent).toContain("Game");
    expect(container.textContent).toContain("Show");
    const toggle = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Show"));
    await act(async () => {
      toggle?.click();
    });
    expect(container.textContent).toContain("Engineer");
    expect(container.textContent).toContain("Role");
    const hide = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Hide"));
    await act(async () => {
      hide?.click();
    });
    root.unmount();
    container.remove();
  });
});
