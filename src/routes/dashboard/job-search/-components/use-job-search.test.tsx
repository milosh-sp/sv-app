import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
  msg: (strings: TemplateStringsArray) => strings.join(""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const mutate = vi.hoisted(() => vi.fn());
const availability = vi.hoisted(() => ({ configured: true }));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: availability }),
  useMutation: () => ({ mutate, isPending: false }),
}));
vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    jobs: {
      getAvailability: { queryOptions: () => ({ queryKey: ["jobs", "availability"] }) },
      search: { mutationOptions: () => ({ mutationKey: ["jobs", "search"] }) },
    },
  },
}));

import { toast } from "sonner";

import { useJobSearch } from "./use-job-search";

type SearchCallbacks = {
  onSuccess: (data: {
    data: Array<{ id: string }>;
    rapidApiQuota?: { limit: number; used: number; remaining: number };
  }) => void;
  onError: (error: Error) => void;
};

function mount() {
  const container = document.createElement("div");
  const root = createRoot(container);
  let search: ReturnType<typeof useJobSearch> | undefined;
  return {
    async render() {
      await act(async () => {
        root.render(<Probe onReady={(value) => (search = value)} />);
      });
      return search!;
    },
    unmount() {
      root.unmount();
    },
  };
}

function Probe({ onReady }: { onReady: (search: ReturnType<typeof useJobSearch>) => void }) {
  onReady(useJobSearch());
  return null;
}

describe("useJobSearch", () => {
  beforeEach(() => {
    mutate.mockReset();
    availability.configured = true;
    vi.mocked(toast.error).mockClear();
  });

  it("stores jobs and quota, and ignores an older response", async () => {
    const calls: SearchCallbacks[] = [];
    mutate.mockImplementation((_input: unknown, options: SearchCallbacks) => {
      calls.push(options);
    });
    const view = mount();
    let search = await view.render();

    await act(async () => {
      search.setQuery("  compiler ");
      search.setFilters({ ...search.filters, includeKeywords: ["rust"] });
    });
    search = await view.render();
    await act(async () => {
      search.executeSearch(1);
      search.executeSearch(2);
    });

    expect(mutate).toHaveBeenCalledTimes(2);
    await act(async () => {
      calls[1]?.onSuccess({
        data: [{ id: "new" }, { id: "extra" }],
        rapidApiQuota: { limit: 10, used: 1, remaining: 9 },
      });
      calls[0]?.onSuccess({ data: [{ id: "old" }] });
    });
    search = await view.render();
    expect(search.jobs).toEqual([{ id: "new" }, { id: "extra" }].slice(0, 10));
    expect(search.quota).toEqual({ limit: 10, used: 1, remaining: 9 });
    expect(search.hasMore).toBe(false);

    view.unmount();
  });

  it("records a failed search and skips work when search is not configured", async () => {
    const calls: SearchCallbacks[] = [];
    mutate.mockImplementation((_input: unknown, options: SearchCallbacks) => {
      calls.push(options);
    });
    const view = mount();
    let search = await view.render();

    await act(async () => {
      search.executeSearch(1);
    });
    await act(async () => {
      calls[0]?.onError(new Error("down"));
    });
    search = await view.render();
    expect(search.error).toBe("down");
    expect(search.jobs).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith("down");

    availability.configured = false;
    search = await view.render();
    mutate.mockClear();
    await act(async () => {
      search.executeSearch(1);
    });
    expect(mutate).not.toHaveBeenCalled();

    view.unmount();
  });

  it("submits a search, changes page, opens a job, and clears filters", async () => {
    mutate.mockImplementation(() => undefined);
    const view = mount();
    let search = await view.render();
    const event = { preventDefault: vi.fn() } as unknown as React.FormEvent;

    await act(async () => {
      search.handleSearch(event);
    });
    search = await view.render();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(search.hasSearched).toBe(true);
    expect(search.currentPage).toBe(1);
    expect(mutate).toHaveBeenCalled();

    await act(async () => {
      search.handlePageChange(3);
    });
    search = await view.render();
    expect(search.currentPage).toBe(3);

    const job = { id: "job-1" } as never;
    await act(async () => {
      search.handleJobClick(job);
    });
    search = await view.render();
    expect(search.selectedJob).toEqual({ id: "job-1" });
    expect(search.sheetOpen).toBe(true);

    await act(async () => {
      search.setFilters({
        ...search.filters,
        includeKeywords: ["rust", "go"],
        remoteOnly: true,
        employmentType: "FULLTIME",
      });
    });
    search = await view.render();
    await act(async () => {
      search.removeFilter("includeKeywords");
    });
    search = await view.render();
    expect(search.filters.includeKeywords).toEqual([]);
    await act(async () => {
      search.removeFilter("remoteOnly");
    });
    search = await view.render();
    expect(search.filters.remoteOnly).toBe(false);
    await act(async () => {
      search.removeFilter("employmentType");
    });
    search = await view.render();
    expect(search.filters.employmentType).toBeNull();

    view.unmount();
  });

  it("drops one keyword, ignores a stale error, and builds the other chips", async () => {
    const calls: SearchCallbacks[] = [];
    mutate.mockImplementation((_input: unknown, options: SearchCallbacks) => {
      calls.push(options);
    });
    const view = mount();
    let search = await view.render();

    await act(async () => {
      search.setFilters({
        ...search.filters,
        includeKeywords: ["rust", "go"],
        excludeKeywords: ["java"],
        excludeCompanies: ["Acme"],
        directApplyOnly: true,
        jobRequirements: "under_3_years_experience",
        datePosted: "week",
      });
    });
    search = await view.render();
    expect(search.activeFilterChips.some((chip) => chip.key === "directApplyOnly")).toBe(true);
    expect(search.activeFilterChips.some((chip) => chip.key === "excludeCompanies")).toBe(true);

    await act(async () => {
      search.removeFilter("includeKeywords", "rust");
    });
    search = await view.render();
    expect(search.filters.includeKeywords).toEqual(["go"]);

    await act(async () => {
      search.setFilters({ ...search.filters, datePosted: "all" });
    });
    search = await view.render();
    await act(async () => {
      search.setFilters({ ...search.filters, datePosted: null });
    });

    await act(async () => {
      search.executeSearch(1);
      search.executeSearch(2);
    });
    await act(async () => {
      calls[0]?.onSuccess({ data: [{ id: "only" }] });
      calls[0]?.onError(new Error("stale"));
      calls.at(-1)?.onError(new Error("fresh"));
    });
    search = await view.render();
    expect(search.error).toBe("fresh");
    expect(search.quota).toBeNull();

    view.unmount();
  });
});
