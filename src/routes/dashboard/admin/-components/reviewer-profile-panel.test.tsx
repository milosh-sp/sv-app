globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

const profileQuery = vi.hoisted(() => ({
  data: null as null | { firstName: string; lastName: string; title: string; reviewerSkills: string[] },
  isLoading: false,
  isError: false,
  dataUpdatedAt: 1,
  refetch: vi.fn(),
}));
const createMutate = vi.hoisted(() => vi.fn());
const updateMutate = vi.hoisted(() => vi.fn());
const pending = vi.hoisted(() => ({ create: false, update: false }));
const invalidateQueries = vi.hoisted(() => vi.fn());
let mutationCall = 0;

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => profileQuery,
  useMutation: () => {
    mutationCall += 1;
    const create = mutationCall % 2 === 1;
    return { mutate: create ? createMutate : updateMutate, isPending: create ? pending.create : pending.update };
  },
  useQueryClient: () => ({ invalidateQueries }),
}));
vi.mock("@/integrations/orpc/client", () => {
  const options = () => ({ queryKey: ["reviewer-profile"] });
  return {
    orpc: {
      admin: {
        reviewerProfiles: {
          getByAdminId: { queryOptions: options },
          list: { queryOptions: options },
          create: { mutationOptions: () => ({}) },
          updateDirect: { mutationOptions: () => ({}) },
        },
      },
      reviewer: { profile: { get: { queryOptions: options } } },
    },
  };
});

import { toast } from "sonner";

import {
  getReviewerSetupStatus,
  ReviewerProfileDialog,
  ReviewerProfileDialogTrigger,
  ReviewerSetupStatusBadge,
} from "./reviewer-profile-panel";

const adminId = "00000000-0000-4000-8000-000000000001";

describe("reviewer profile panel", () => {
  beforeEach(() => {
    mutationCall = 0;
    profileQuery.data = null;
    profileQuery.isLoading = false;
    profileQuery.isError = false;
    pending.create = false;
    pending.update = false;
    createMutate.mockReset();
    updateMutate.mockReset();
    invalidateQueries.mockClear();
    vi.mocked(toast.warning).mockClear();
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
  });

  it("classifies setup status", () => {
    expect(getReviewerSetupStatus(null)).toBe("no_profile");
    expect(getReviewerSetupStatus({ reviewerSkills: [] })).toBe("no_skills");
    expect(getReviewerSetupStatus({ reviewerSkills: ["Rust"] })).toBe("ready");
  });

  it("creates a profile from the user's name and updates an existing one", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();

    await act(async () => {
      root.render(<ReviewerSetupStatusBadge status="ready" />);
    });
    expect(container.textContent).toBe("Ready");
    await act(async () => {
      root.render(<ReviewerSetupStatusBadge status="no_skills" />);
    });
    expect(container.textContent).toBe("No skills");

    profileQuery.isLoading = true;
    await act(async () => {
      root.render(<ReviewerProfileDialog adminId={adminId} userName="Ada Lovelace" open onOpenChange={onOpenChange} />);
    });
    expect(document.body.textContent).toContain("Loading reviewer profile");

    profileQuery.isLoading = false;
    profileQuery.isError = true;
    await act(async () => {
      root.render(<ReviewerProfileDialog adminId={adminId} userName="Ada Lovelace" open onOpenChange={onOpenChange} />);
    });
    await act(async () => {
      [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Retry"))?.click();
    });
    expect(profileQuery.refetch).toHaveBeenCalled();

    profileQuery.isError = false;
    await act(async () => {
      root.render(
        <ReviewerProfileDialog
          adminId={adminId}
          userName="Ada Lovelace"
          userEmail="ada@example.com"
          open
          onOpenChange={onOpenChange}
          currentUserId={adminId}
          onSaved={onSaved}
        />,
      );
    });
    await act(async () => {
      [...document.querySelectorAll("button")]
        .find((button) => button.textContent?.includes("Create reviewer profile"))
        ?.click();
    });
    expect(toast.warning).toHaveBeenCalled();
    const created = createMutate.mock.calls[0];
    expect(created?.[0]).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      title: "Reviewer",
      reviewerSkills: [],
    });
    created?.[1].onError(new Error("taken"));
    expect(toast.error).toHaveBeenCalledWith("taken");
    created?.[1].onSuccess();
    expect(onSaved).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);

    profileQuery.data = { firstName: "Ada", lastName: "Lovelace", title: "Reviewer", reviewerSkills: ["Rust"] };
    await act(async () => {
      root.render(<ReviewerProfileDialog adminId={adminId} userName="Ada Lovelace" open onOpenChange={onOpenChange} />);
    });
    expect(document.body.textContent).toContain("1 skill selected.");
    await act(async () => {
      [...document.querySelectorAll("button")]
        .find((button) => button.textContent?.includes("Save reviewer profile"))
        ?.click();
    });
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ reviewerSkills: ["Rust"], firstName: "Ada" }),
      expect.any(Object),
    );

    root.unmount();
    container.remove();
  });

  it("opens the dialog from the trigger label", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    profileQuery.data = { firstName: "Ada", lastName: "Lovelace", title: "Reviewer", reviewerSkills: ["Rust", "Go"] };
    await act(async () => {
      root.render(<ReviewerProfileDialogTrigger adminId={adminId} userName="Ada" hasProfile />);
    });
    expect(container.textContent).toContain("Manage profile");
    await act(async () => {
      container.querySelector("button")?.click();
    });
    expect(document.body.textContent).toContain("Edit reviewer profile");
    root.unmount();
    container.remove();
  });
});
