import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const ai = vi.hoisted(() => ({ canUse: true }));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@/integrations/ai/use-ai-integration", () => ({
  useAiIntegration: () => ({ canUse: ai.canUse }),
}));
vi.mock("./tailor-dialog", () => ({
  TailorDialog: ({ open }: { open: boolean }) => (open ? <div>tailor-open</div> : null),
}));
vi.mock("./job-utils", async (importOriginal) => importOriginal());

import { JobDetailSheet } from "./job-detail";

const full = {
  job_title: "Engineer",
  employer_name: "Example",
  employer_logo: "https://cdn.example/logo.png",
  job_city: "Berlin",
  job_state: "BE",
  job_country: "Germany",
  job_is_remote: true,
  job_employment_type: "FULLTIME",
  job_min_salary: 80_000,
  job_max_salary: 120_000,
  job_salary_currency: "USD",
  job_salary_period: "year",
  job_posted_at_datetime_utc: "2024-01-02T00:00:00.000Z",
  job_apply_link: "https://example.com/apply",
  job_description: "Build compilers",
  job_highlights: { Qualifications: ["TypeScript"] },
  job_required_skills: ["React"],
  job_benefits: ["Remote"],
  apply_options: [
    { publisher: "LinkedIn", apply_link: "https://example.com/a", is_direct: true },
    { publisher: "", apply_link: "https://example.com/b", is_direct: false },
  ],
} as never;

const sparse = {
  job_title: "Intern",
  employer_name: "None",
  employer_logo: null,
  job_city: "",
  job_state: "",
  job_country: "",
  job_is_remote: false,
  job_employment_type: "",
  job_min_salary: null,
  job_max_salary: null,
  job_salary_currency: null,
  job_salary_period: null,
  job_posted_at_datetime_utc: "",
  job_apply_link: "javascript:alert(1)",
  job_description: "",
  job_highlights: {},
  job_required_skills: [],
  job_benefits: [],
  apply_options: [],
} as never;

describe("job detail sheet", () => {
  it("renders a full posting, a sparse posting, and no job", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onOpenChange = vi.fn();

    await act(async () => {
      root.render(<JobDetailSheet job={null} open onOpenChange={onOpenChange} />);
    });
    expect(container.textContent).toBe("");

    await act(async () => {
      root.render(<JobDetailSheet job={full} open onOpenChange={onOpenChange} />);
    });
    expect(document.body.textContent).toContain("Qualifications");
    expect(document.body.textContent).toContain("Direct");
    expect(document.body.textContent).toContain("Apply Link");
    const tailor = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Tailor"));
    await act(async () => {
      tailor?.click();
    });
    expect(document.body.textContent).toContain("tailor-open");

    await act(async () => {
      root.render(<JobDetailSheet job={sparse} open={false} onOpenChange={onOpenChange} />);
    });
    expect(document.body.textContent).not.toContain("Qualifications");

    root.unmount();
    container.remove();
  });
});
