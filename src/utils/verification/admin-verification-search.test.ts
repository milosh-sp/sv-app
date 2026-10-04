import { describe, expect, it } from "vite-plus/test";

import {
  buildPendingVerdictsListInput,
  buildVerdictHistoryListInput,
  buildVerificationListInput,
  defaultAdminExperienceSearch,
  defaultAdminVerdictSearch,
  defaultAdminVerificationSearch,
  hasActiveAdminExperienceFilters,
  hasActiveAdminVerdictFilters,
  hasActiveAdminVerificationFilters,
} from "./admin-verification-search";

describe("admin verification search", () => {
  it("omits an empty query and sends a trimmed query", () => {
    expect(buildVerificationListInput(defaultAdminVerificationSearch, "queue").query).toBeUndefined();
    expect(buildVerificationListInput({ ...defaultAdminVerificationSearch, q: "  ada  " }, "queue").query).toBe("ada");
    expect(
      buildVerificationListInput({ ...defaultAdminVerificationSearch, method: "document_upload" }, "queue").method,
    ).toBe("document_upload");
  });

  it("sends statuses on the history tab and not on the queue tab", () => {
    const search = { ...defaultAdminVerificationSearch, statuses: ["verified" as const] };

    expect(buildVerificationListInput(search, "queue").statuses).toBeUndefined();
    expect(buildVerificationListInput(search, "history").statuses).toEqual(["verified"]);
    expect(hasActiveAdminVerificationFilters(search, "queue")).toBe(false);
    expect(hasActiveAdminVerificationFilters(search, "history")).toBe(true);
  });

  it("sends proposed outcomes and types only when they narrow the verdict lists", () => {
    expect(buildPendingVerdictsListInput(defaultAdminExperienceSearch).proposed).toBeUndefined();
    expect(buildPendingVerdictsListInput({ ...defaultAdminVerdictSearch, q: " ada " }).query).toBe("ada");
    expect(
      buildPendingVerdictsListInput({ ...defaultAdminVerdictSearch, proposed: ["verified"], types: ["skill"] }),
    ).toMatchObject({ proposed: ["verified"], types: ["skill"] });

    const history = { ...defaultAdminVerdictSearch, statuses: ["rejected" as const], types: ["project" as const] };
    expect(buildVerdictHistoryListInput(defaultAdminVerdictSearch)).toMatchObject({
      query: undefined,
      statuses: undefined,
      types: undefined,
    });
    expect(buildVerdictHistoryListInput(history)).toMatchObject({
      statuses: ["rejected"],
      types: ["project"],
    });
    expect(buildVerdictHistoryListInput({ ...defaultAdminVerdictSearch, q: " ada " }).query).toBe("ada");
    expect(hasActiveAdminVerdictFilters({ ...defaultAdminVerdictSearch, q: "ada" }, "queue")).toBe(true);
    expect(hasActiveAdminVerdictFilters({ ...defaultAdminVerdictSearch, proposed: ["issue"] }, "queue")).toBe(true);
    expect(hasActiveAdminVerdictFilters({ ...defaultAdminVerdictSearch, types: ["skill"] }, "queue")).toBe(true);
    expect(hasActiveAdminVerdictFilters({ ...defaultAdminVerdictSearch, types: ["project"] }, "history")).toBe(true);
    expect(hasActiveAdminVerdictFilters({ ...defaultAdminVerdictSearch, proposed: ["issue"] }, "history")).toBe(false);
    expect(hasActiveAdminVerdictFilters(history, "history")).toBe(true);
    expect(hasActiveAdminVerificationFilters({ ...defaultAdminVerificationSearch, q: " ada " }, "queue")).toBe(true);
    expect(
      hasActiveAdminVerificationFilters({ ...defaultAdminVerificationSearch, method: "document_upload" }, "queue"),
    ).toBe(true);
    expect(
      hasActiveAdminExperienceFilters({ ...defaultAdminExperienceSearch, method: "freelancer_link" }, "queue"),
    ).toBe(true);
    expect(hasActiveAdminVerdictFilters(defaultAdminVerdictSearch, "history")).toBe(false);
    expect(
      hasActiveAdminVerdictFilters(
        { ...defaultAdminVerdictSearch, types: ["skill"], statuses: ["verified"] },
        "history",
      ),
    ).toBe(true);
  });
});
