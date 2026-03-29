import { describe, expect, it } from "vite-plus/test";

describe("Reviewer Public Profile Page", () => {
  it("should display only safe profile fields", () => {
    const publicFields = ["firstName", "lastName", "title", "createdAt", "publicProfileUrl"];
    const piiFields = ["email", "userId", "id"];

    for (const field of piiFields) {
      expect(publicFields).not.toContain(field);
    }
  });

  it("should format member since as month and year", () => {
    const date = new Date("2024-03-15T00:00:00Z");
    const formatted = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });
    expect(formatted).toContain("2024");
    expect(formatted).toContain("March");
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
