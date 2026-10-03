import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    admin: {
      verification: {
        overrideConcludedVerdict: { mutationOptions: () => ({}) },
      },
    },
  },
}));
vi.mock("@/components/resume/preview", () => ({ ResumePreview: () => null }));
vi.mock("@/components/resume/store/resume", () => ({ useResumeStore: () => ({}) }));
vi.mock("react-zoom-pan-pinch", () => ({
  TransformComponent: ({ children }: { children: React.ReactNode }) => children,
  TransformWrapper: ({ children }: { children: React.ReactNode }) => children,
}));

import {
    ApplicantDetails,
    DirectAdminReviewHistoryTab,
    DocumentPreview,
    MethodBadge,
    QueueEmptyState,
    QueueErrorState,
    QueueLoadingState,
    ReviewDecisionPanel,
    ReviewerDetails,
    StatusBadge,
    VerdictReviewHistoryTab,
    type DirectAdminReviewHistoryItem,
    type QueueUser,
    type VerdictReviewHistoryItem,
} from "./verification-queue-shared";

async function textOf(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  const text = container.textContent;
  root.unmount();
  container.remove();
  return text;
}

describe("verification queue badges", () => {
  it("labels every status, including an unknown one and a pending verdict", async () => {
    const statuses = ["verified", "pending", "claimed", "rejected", "issue", "mystery"] as const;
    for (const status of statuses) {
      await expect(textOf(<StatusBadge status={status} />)).resolves.toBe(status);
    }
    await expect(textOf(<StatusBadge status="verdict_pending" />)).resolves.toBe("verdict pending");
  });

  it("renders a method label and nothing when the method is missing", async () => {
    await expect(textOf(<MethodBadge method={null} />)).resolves.toBe("");
    await expect(textOf(<MethodBadge method="unknown" />)).resolves.toBe("");
    await expect(textOf(<MethodBadge method="document_upload" />)).resolves.toBe("Document");
    await expect(textOf(<MethodBadge method="freelancer_link" />)).resolves.toBe("Freelancer Link");
    await expect(textOf(<MethodBadge method="identity_call" />)).resolves.toBe("Identity Call");
  });

  it("shows queue states, applicant facts, and a review decision", async () => {
    await expect(textOf(<QueueLoadingState />)).resolves.toContain("Loading queue");
    await expect(textOf(<QueueEmptyState message="Nothing waiting" />)).resolves.toBe("Nothing waiting");
    await expect(textOf(<QueueErrorState />)).resolves.toContain("Failed to load queue");
    await expect(textOf(<QueueErrorState message="Offline" />)).resolves.toBe("Offline");

    const user: QueueUser = {
      id: "user-1",
      name: "Ada",
      email: "ada@example.com",
      emailVerified: true,
      username: "ada",
      displayUsername: "Ada",
      image: null,
      twoFactorEnabled: false,
      lastActiveAt: null,
      createdAt: new Date("2020-01-02T00:00:00.000Z"),
      updatedAt: new Date("2020-01-03T00:00:00.000Z"),
    };
    await expect(textOf(<ApplicantDetails user={user} />)).resolves.toContain("ada@example.com");
    await expect(
      textOf(
        <ApplicantDetails
          user={{
            ...user,
            image: "https://example.com/a.png",
            emailVerified: false,
            twoFactorEnabled: true,
            lastActiveAt: new Date("2020-02-02T00:00:00.000Z"),
          }}
        />,
      ),
    ).resolves.toContain("https://example.com/a.png");

    await expect(
      textOf(
        <ReviewerDetails
          name={null}
          title={null}
          skills={[]}
          publicProfileUrl={null}
          proposedVerdict={null}
          verdictNotes={null}
          verdictSubmittedAt={null}
        />,
      ),
    ).resolves.toContain("—");
    await expect(
      textOf(
        <ReviewerDetails
          name="Grace"
          title="Reviewer"
          skills={["TypeScript"]}
          publicProfileUrl="https://example.com/grace"
          proposedVerdict="verified"
          verdictNotes="matches"
          verdictSubmittedAt={new Date("2020-03-01T00:00:00.000Z")}
        />,
      ),
    ).resolves.toContain("TypeScript");

    const onActionChange = vi.fn();
    const onNotesChange = vi.fn();
    const onRequestConfirm = vi.fn();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const onBack = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ReviewDecisionPanel
          action="verified"
          onActionChange={onActionChange}
          notes=""
          onNotesChange={onNotesChange}
          confirming={false}
          isPending={false}
          onRequestConfirm={onRequestConfirm}
          onConfirm={onConfirm}
          onCancel={onCancel}
          onBack={onBack}
        />,
      );
    });
    container.querySelectorAll("button")[1]?.click();
    expect(onActionChange).toHaveBeenCalledWith("rejected");
    container.querySelector("textarea")?.dispatchEvent(new Event("change", { bubbles: true }));
    [...container.querySelectorAll("button")].find((button) => button.textContent === "Submit Review")?.click();
    [...container.querySelectorAll("button")].find((button) => button.textContent === "Cancel")?.click();
    expect(onRequestConfirm).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();

    await act(async () => {
      root.render(
        <ReviewDecisionPanel
          action="issue"
          onActionChange={onActionChange}
          notes="note"
          onNotesChange={onNotesChange}
          confirming
          isPending
          onRequestConfirm={onRequestConfirm}
          onConfirm={onConfirm}
          onCancel={onCancel}
          onBack={onBack}
        />,
      );
    });
    expect(container.textContent).toContain("Submitting");
    await act(async () => {
      root.render(
        <ReviewDecisionPanel
          action="issue"
          onActionChange={onActionChange}
          notes="note"
          onNotesChange={onNotesChange}
          confirming
          isPending={false}
          onRequestConfirm={onRequestConfirm}
          onConfirm={onConfirm}
          onCancel={onCancel}
          onBack={onBack}
        />,
      );
    });
    [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Back"))?.click();
    [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Confirm"))?.click();
    expect(onBack).toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalled();
    root.unmount();
    container.remove();
  });

  it("previews an uploaded document and an external profile link", async () => {
    URL.createObjectURL = () => "blob:doc";
    URL.revokeObjectURL = () => undefined;
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <DocumentPreview
          fileUrl="https://example.com/profile"
          documentType="freelancer_link"
          uploadedAt={new Date("2020-01-01T00:00:00.000Z")}
        />,
      );
    });
    expect(container.textContent).toContain("Open Profile");

    fetchMock.mockResolvedValue(
      new Response(Uint8Array.from([1, 2, 3, 4]), {
        headers: { "content-type": "image/png" },
      }),
    );
    await act(async () => {
      root.render(
        <DocumentPreview
          fileUrl="https://example.com/a.png"
          documentType="payslip"
          uploadedAt={new Date("2020-01-01T00:00:00.000Z")}
        />,
      );
    });
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Preview")?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector("img")).not.toBeNull();

    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    await act(async () => {
      root.render(
        <DocumentPreview
          fileUrl="https://example.com/missing"
          documentType="contract"
          uploadedAt={new Date("2020-01-01T00:00:00.000Z")}
        />,
      );
    });
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Preview")?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Failed to load document");

    root.unmount();
    container.remove();
    vi.unstubAllGlobals();
  });

  it("lists completed reviews and expands a row without a resume preview", async () => {
    const direct: DirectAdminReviewHistoryItem = {
      id: "req-1",
      sectionType: "experience",
      itemId: "item-1",
      itemLabel: "Acme",
      status: "verified",
      method: "document_upload",
      submittedAt: new Date("2020-01-01T00:00:00.000Z"),
      resolvedAt: new Date("2020-02-01T00:00:00.000Z"),
      reviewerNote: "matches",
      calendarLinkSentAt: new Date("2020-01-15T00:00:00.000Z"),
      user: null,
      resume: null,
      documents: [
        {
          id: "doc-1",
          fileUrl: "https://example.com/profile",
          documentType: "assessment_solution_link",
          uploadedAt: new Date("2020-01-01T00:00:00.000Z"),
        },
      ],
      reviewedBy: { id: "admin", name: "Grace", email: "grace@example.com" },
      reviewedAt: new Date("2020-02-01T00:00:00.000Z"),
    };
    const verdict: VerdictReviewHistoryItem = {
      id: "req-2",
      sectionType: "skill",
      itemId: "item-2",
      itemLabel: "TypeScript",
      status: "issue",
      submittedAt: new Date("2020-01-01T00:00:00.000Z"),
      resolvedAt: null,
      proposedVerdict: "verified",
      reviewerNote: null,
      parentItemLabel: "Languages",
      user: null,
      resume: null,
      documents: [],
      assessmentInstructionsUrl: "https://example.com/task",
      reviewerName: "Grace",
      reviewerTitle: "Reviewer",
      reviewerPublicProfileUrl: "https://example.com/grace",
      reviewerSkills: ["TypeScript"],
      verdictNotes: "needs a metric",
      verdictSubmittedAt: new Date("2020-03-01T00:00:00.000Z"),
      reviewedBy: null,
      reviewedAt: new Date("2020-03-02T00:00:00.000Z"),
    };

    await expect(
      textOf(<DirectAdminReviewHistoryTab items={[]} isLoading isError={false} emptyMessage="No experience reviews" />),
    ).resolves.toContain("Loading queue");
    await expect(
      textOf(<DirectAdminReviewHistoryTab items={[]} isLoading={false} isError emptyMessage="No experience reviews" />),
    ).resolves.toContain("Failed to load history");
    await expect(
      textOf(
        <VerdictReviewHistoryTab
          items={[]}
          isLoading={false}
          isError={false}
          emptyMessage="No verdicts"
          hasActiveFilter
        />,
      ),
    ).resolves.toContain("No completed reviews");

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <DirectAdminReviewHistoryTab
          items={[direct]}
          isLoading={false}
          isError={false}
          emptyMessage="No experience reviews"
          resumeLabel="Resume"
        />,
      );
    });
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Details"))?.click();
    });
    expect(container.textContent).toContain("Unknown applicant");
    expect(container.textContent).toContain("Open Link");
    expect(container.textContent).toContain("matches");

    const queryClient = new QueryClient();
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VerdictReviewHistoryTab items={[verdict]} isLoading={false} isError={false} emptyMessage="No verdicts" />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Details"))?.click();
    });
    expect(container.textContent).toContain("needs a metric");
    expect(container.textContent).toContain("Languages");

    root.unmount();
    container.remove();
  });
});
