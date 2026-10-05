import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const fail = vi.hoisted(() => ({ saved: false, contact: false, message: "nope" as string }));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("./candidate-resume-preview", () => ({
  CandidateResumePreview: () => <div>preview</div>,
}));
vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    company: {
      setSaved: {
        mutationOptions: () => ({
          mutationFn: async () => {
            if (fail.saved) throw new Error(fail.message);
          },
        }),
      },
      createContactRequest: {
        mutationOptions: () => ({
          mutationFn: async () => {
            if (fail.contact) throw new Error(fail.message);
          },
        }),
      },
      listSaved: { key: () => ["saved"] },
      listContactRequests: { key: () => ["contacts"] },
    },
  },
}));

import { toast } from "sonner";

import { CandidateActions } from "./candidate-actions";
import { CandidateCard } from "./candidate-card";
import { CandidateDetailSheet } from "./candidate-detail-sheet";
import { CandidateVerificationSummary, IdentityVerifiedBadge } from "./candidate-verification-summary";

const base = {
  candidateUserId: "user-1",
  resumeId: "resume-1",
  displayName: "Ada Lovelace",
  identityVerified: true,
  headline: "Engineer",
  candidateEmail: "ada@example.com",
  verifiedSkills: ["TypeScript"],
  verifiedExperiences: ["Compiler"],
  isFavorite: false,
  isToContact: true,
  contactStatus: "declined" as const,
  username: "ada",
  slug: "sample",
};

function candidate(overrides: Record<string, unknown> = {}) {
  return { ...base, ...overrides } as never;
}

describe("company candidate views", () => {
  it("saves, contacts, and renders empty or filled profiles", async () => {
    expect(
      CandidateVerificationSummary({
        verifiedSkills: [],
        verifiedExperiences: [],
      }),
    ).toBeNull();
    expect(IdentityVerifiedBadge({ verified: false })).toBeNull();

    const flags = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CandidateVerificationSummary verifiedSkills={["Go"]} verifiedExperiences={[]} />
          <CandidateVerificationSummary verifiedSkills={[]} verifiedExperiences={["Studio"]} />
          <IdentityVerifiedBadge verified />
          <CandidateCard candidate={candidate()} onView={vi.fn()} onFlagsChange={flags} aside={<span>score</span>}>
            <p>reason</p>
          </CandidateCard>
          <CandidateCard
            candidate={candidate({ headline: "", candidateEmail: null, identityVerified: false, isFavorite: true, isToContact: false, contactStatus: null })}
            onView={vi.fn()}
          />
          <CandidateActions
            candidate={candidate({ isFavorite: true, isToContact: false, contactStatus: null })}
            onFlagsChange={flags}
          />
          <CandidateActions candidate={candidate({ contactStatus: "pending" })} />
          <CandidateActions candidate={candidate({ contactStatus: "accepted" })} />
        </QueryClientProvider>,
      );
    });

    const click = async (label: string) => {
      const button = [...container.querySelectorAll("button")].find((item) => item.textContent?.includes(label));
      await act(async () => {
        button?.click();
      });
    };

    fail.saved = false;
    await click("Favorite");
    await click("To contact");
    expect(flags).toHaveBeenCalled();

    fail.saved = true;
    fail.message = "save failed";
    await click("Favorite");
    fail.message = "";
    await click("To contact");
    expect(vi.mocked(toast.error)).toHaveBeenCalled();

    fail.contact = false;
    const contact = [...container.querySelectorAll("button")].find((item) => item.textContent?.trim() === "Contact");
    await act(async () => {
      contact?.click();
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalled();

    fail.contact = true;
    fail.message = "send failed";
    await act(async () => {
      contact?.click();
    });
    fail.message = "";
    await act(async () => {
      contact?.click();
    });

    root.unmount();
    container.remove();
  });

  it("opens a detail sheet and keeps the last candidate while it closes", async () => {
    const flags = vi.fn();
    const onClose = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const first = candidate();
    const second = candidate({ candidateUserId: "user-2", displayName: "Grace", headline: "", candidateEmail: null, slug: null });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CandidateDetailSheet candidate={null} onClose={onClose} />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CandidateDetailSheet
            candidate={first}
            onClose={onClose}
            onFlagsChange={flags}
            renderExtra={() => <p>extra</p>}
          />
        </QueryClientProvider>,
      );
    });
    expect(document.body.textContent).toContain("Ada Lovelace");
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CandidateDetailSheet candidate={first} onClose={onClose} />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CandidateDetailSheet candidate={second} onClose={onClose} />
        </QueryClientProvider>,
      );
    });
    expect(document.body.textContent).toContain("Grace");
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CandidateDetailSheet candidate={null} onClose={onClose} />
        </QueryClientProvider>,
      );
    });

    const close = document.querySelector("[data-slot='sheet-close']");
    await act(async () => {
      if (close instanceof HTMLElement) close.click();
    });

    root.unmount();
    container.remove();
  });
});
