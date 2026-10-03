globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/integrations/orpc/client", () => ({ orpc: {} }));
vi.mock("@/components/resume/preview", () => ({ ResumePreview: () => null }));
vi.mock("@/components/resume/store/resume", () => ({ useResumeStore: () => ({}) }));
vi.mock("react-zoom-pan-pinch", () => ({
  TransformComponent: ({ children }: { children: React.ReactNode }) => children,
  TransformWrapper: ({ children }: { children: React.ReactNode }) => children,
}));

import { MethodBadge, StatusBadge } from "./verification-queue-shared";

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
});
