import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
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
    await act(async () => {
      root.render(<ReviewerProfileDialogTrigger adminId={adminId} userName="Ada" hasProfile={false} />);
    });
    expect(container.textContent).toContain("Create profile");
    await act(async () => {
      root.render(<ReviewerProfileDialogTrigger adminId={adminId} userName="Ada" />);
    });
    expect(container.textContent).toContain("Reviewer profile");
    root.unmount();
    container.remove();
  });

  it("saves blank fields, reports update errors, and shows pending labels", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onOpenChange = vi.fn();

    expect(getReviewerSetupStatus({})).toBe("no_skills");
    await act(async () => {
      root.render(<ReviewerSetupStatusBadge status="no_profile" />);
    });
    expect(container.textContent).toBe("No profile");

    profileQuery.data = null;
    pending.create = true;
    await act(async () => {
      root.render(<ReviewerProfileDialog adminId={adminId} userName=" " open onOpenChange={onOpenChange} />);
    });
    expect(document.body.textContent).toContain("Creating…");
    pending.create = false;
    await act(async () => {
      root.render(<ReviewerProfileDialog adminId={adminId} userName=" " open onOpenChange={onOpenChange} />);
    });
    await act(async () => {
      [...document.querySelectorAll("button")]
        .find((button) => button.textContent?.includes("Create reviewer profile"))
        ?.click();
    });
    expect(createMutate.mock.calls.at(-1)?.[0]).toMatchObject({
      firstName: "Reviewer",
      lastName: "Admin",
      title: "Reviewer",
    });

    profileQuery.data = { firstName: "Ada", lastName: "Lovelace", title: "Staff", reviewerSkills: ["Rust", "Go"] };
    pending.update = true;
    await act(async () => {
      root.render(
        <ReviewerProfileDialog adminId={adminId} userName="Ada Lovelace" open onOpenChange={onOpenChange} />,
      );
    });
    expect(document.body.textContent).toContain("Saving…");
    expect(document.body.textContent).toContain("2 skills selected.");
    pending.update = false;
    await act(async () => {
      root.render(
        <ReviewerProfileDialog
          adminId={adminId}
          userName="Ada Lovelace"
          open
          onOpenChange={onOpenChange}
          currentUserId="someone-else"
        />,
      );
    });

    const inputs = [...document.querySelectorAll("input")].filter((input) => input instanceof HTMLInputElement);
    const setValue = (input: HTMLInputElement, value: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    await act(async () => {
      if (inputs[0]) setValue(inputs[0], "");
      if (inputs[1]) setValue(inputs[1], "");
      if (inputs[2]) setValue(inputs[2], "");
    });

    type Fiber = {
      child?: Fiber;
      sibling?: Fiber;
      return?: Fiber;
      memoizedProps?: { onValueChange?: (value: unknown) => void };
    };
    const dialog = document.body;
    const host = dialog.querySelector("[data-slot='dialog-content']") ?? container;
    const fiberKey = Object.getOwnPropertyNames(host).find((name) => name.startsWith("__reactFiber$"));
    let start = fiberKey ? (host as unknown as Record<string, Fiber>)[fiberKey] : undefined;
    while (start?.return) start = start.return;
    const stack = start ? [start] : [];
    const seen = new Set<unknown>();
    const walked = new Set<Fiber>();
    while (stack.length > 0) {
      const fiber = stack.pop();
      if (!fiber || walked.has(fiber)) continue;
      walked.add(fiber);
      const onValueChange = fiber.memoizedProps?.onValueChange;
      const options = (fiber.memoizedProps as { options?: Array<{ value: string }> } | undefined)?.options;
      if (
        typeof onValueChange === "function" &&
        !seen.has(onValueChange) &&
        options?.some((option) => option.value === "Rust")
      ) {
        seen.add(onValueChange);
        onValueChange(null);
        onValueChange(["Rust"]);
      }
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }

    await act(async () => {
      [...document.querySelectorAll("button")].find((button) => button.textContent === "Cancel")?.click();
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await act(async () => {
      [...document.querySelectorAll("button")]
        .find((button) => button.textContent?.includes("Save reviewer profile"))
        ?.click();
    });
    const updated = updateMutate.mock.calls.at(-1);
    expect(updated?.[0]).toMatchObject({ reviewerSkills: ["Rust"] });
    expect(updated?.[0]).not.toHaveProperty("firstName");
    updated?.[1].onError(new Error("conflict"));
    expect(toast.error).toHaveBeenCalledWith("conflict");
    updated?.[1].onSuccess();
    expect(toast.success).toHaveBeenCalledWith("Reviewer profile updated.");

    profileQuery.data = null;
    await act(async () => {
      root.render(<ReviewerProfileDialog adminId={adminId} userName="Ada" open onOpenChange={onOpenChange} />);
    });
    const first = [...document.querySelectorAll("input")].find((input) => input instanceof HTMLInputElement);
    if (first instanceof HTMLInputElement) {
      await act(async () => {
        setValue(first, "");
      });
    }
    await act(async () => {
      [...document.querySelectorAll("button")]
        .find((button) => button.textContent?.includes("Create reviewer profile"))
        ?.click();
    });
    expect(createMutate.mock.calls.at(-1)?.[0]).toMatchObject({ firstName: "Ada", lastName: "Admin" });

    root.unmount();
    container.remove();
  });
});
