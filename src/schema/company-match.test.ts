import { expect, test } from "vite-plus/test";

import { companyMatchOutputSchema } from "./company-match";

test("companyMatchOutputSchema accepts scored matches", () => {
  const parsed = companyMatchOutputSchema.parse({
    matches: [
      {
        resumeId: "550e8400-e29b-41d4-a716-446655440000",
        matchScore: 88,
        matchReason: "Strong overlap on React and TypeScript.",
      },
    ],
  });

  expect(parsed.matches).toHaveLength(1);
  expect(parsed.matches[0]?.matchScore).toBe(88);
});

test("companyMatchOutputSchema rejects out-of-range scores", () => {
  expect(() =>
    companyMatchOutputSchema.parse({
      matches: [
        {
          resumeId: "550e8400-e29b-41d4-a716-446655440000",
          matchScore: 140,
          matchReason: "Too high",
        },
      ],
    }),
  ).toThrow();
});
