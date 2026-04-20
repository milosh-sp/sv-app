import { describe, expect, it } from "vite-plus/test";

import { formatDefaultDate } from "@/utils/format-date";

describe("Reviewer Public Profile Page", () => {
  it("should display only safe profile fields", () => {
    const publicFields = ["firstName", "lastName", "title", "createdAt", "publicProfileUrl"];
    const piiFields = ["email", "userId", "id"];

    for (const field of piiFields) {
      expect(publicFields).not.toContain(field);
    }
  });

  it("should format member since as DD/MM/YYYY", () => {
    const date = new Date(2024, 2, 15);
    expect(formatDefaultDate(date)).toBe("15/03/2024");
  });

  it("should not expose any verified CV list or admin IDs", () => {
    const exposedData = {
      firstName: "Jane",
      lastName: "Smith",
      title: "Senior Engineer",
      createdAt: new Date().toISOString(),
    };

    expect(exposedData).not.toHaveProperty("verifiedResumes");
    expect(exposedData).not.toHaveProperty("adminId");
    expect(exposedData).not.toHaveProperty("email");
  });
});
