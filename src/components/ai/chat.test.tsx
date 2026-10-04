import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { defaultResumeData } from "@/schema/resume/data";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ render }: { render: React.ReactElement }) => render,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const ai = vi.hoisted(() => ({ canUse: true }));
const chat = vi.hoisted(() => ({
  messages: [] as Array<{ id: string; role: string; parts: Array<Record<string, unknown>> }>,
  status: "ready" as string,
  sendMessage: vi.fn(async () => undefined),
  stop: vi.fn(),
  setMessages: vi.fn(),
  transport: null as null | {
    sendMessages: (options: { messages: unknown[]; abortSignal: AbortSignal }) => Promise<unknown>;
    reconnectToStream: () => void;
  },
  onError: null as null | ((error: Error) => void),
}));
const resumeState = vi.hoisted(() => ({
  resume: { id: "resume-1", data: {} as object },
  updateResumeData: vi.fn((updater: (draft: object) => void) => updater({})),
}));
const chatRequest = vi.hoisted(() => vi.fn(async () => ({ stream: true })));

vi.mock("@/integrations/ai/use-ai-integration", () => ({ useAiIntegration: () => ai }));
vi.mock("@/components/resume/store/resume", () => ({
  useResumeStore: (selector: (state: typeof resumeState) => unknown) => selector(resumeState),
}));
vi.mock("@/integrations/orpc/client", () => ({ client: { ai: { chat: chatRequest } } }));
vi.mock("@orpc/client", () => ({
  eventIteratorToUnproxiedDataStream: (value: unknown) => value,
}));
vi.mock("@ai-sdk/react", () => ({
  useChat: (options: { transport: NonNullable<typeof chat.transport>; onError: (error: Error) => void }) => {
    chat.transport = options.transport;
    chat.onError = options.onError;
    return chat;
  },
}));

import { toast } from "sonner";

import { AIChat } from "./chat";

describe("AI chat", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = () => undefined;
    localStorage.clear();
    ai.canUse = true;
    chat.messages = [];
    chat.status = "ready";
    chat.sendMessage.mockClear();
    chat.setMessages.mockClear();
    resumeState.resume = { id: "resume-1", data: defaultResumeData };
    resumeState.updateResumeData.mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("returns nothing when AI is unavailable", async () => {
    ai.canUse = false;
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<AIChat />);
    });
    expect(container.textContent).toBe("");
    root.unmount();
  });

  it("applies a new patch, reports a bad one, and sends the typed message", async () => {
    localStorage.setItem("ai-chat-messages:resume-1", "{");
    chat.messages = [
      { id: "user-1", role: "user", parts: [{ type: "text", text: "Rename me" }] },
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          { type: "step-start" },
          { type: "text", text: "Done" },
          { type: "reasoning", text: "The name was generic." },
          { type: "text", text: "   " },
          {
            type: "tool-patch_resume",
            state: "output-available",
            toolCallId: "call-1",
            input: {
              operations: [
                { op: "replace", path: "/basics/name" },
                { op: "add", path: "/basics/headline" },
                { op: "remove", path: "/summary" },
                { op: "move", path: "/picture" },
              ],
            },
            output: {
              success: true,
              appliedOperations: [{ op: "replace", path: "/basics/name", value: "Grace" }],
            },
          },
        ],
      },
    ];

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<AIChat />);
    });
    expect(container.textContent).toContain("Updated basics › name");
    expect(resumeState.updateResumeData).toHaveBeenCalled();

    chat.messages = [
      ...chat.messages,
      {
        id: "assistant-2",
        role: "assistant",
        parts: [
          {
            type: "tool-patch_resume",
            state: "output-available",
            toolCallId: "call-2",
            output: { success: true, appliedOperations: [{ op: "replace", path: "/nope", value: 1 }] },
          },
        ],
      },
    ];
    await act(async () => {
      root.render(<AIChat />);
    });
    expect(toast.error).toHaveBeenCalledWith("Failed to apply resume changes", expect.any(Object));

    const input = container.querySelector("form input");
    // oxlint-disable-next-line typescript/unbound-method -- native setter must be called with the input as this
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(input, "  ");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
      container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();

    await act(async () => {
      setter?.call(input, "Change my headline");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
      container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(chat.sendMessage).toHaveBeenCalledWith({ text: "Change my headline" });

    await chat.transport?.sendMessages({ messages: [], abortSignal: new AbortController().signal });
    expect(chatRequest).toHaveBeenCalled();
    expect(() => chat.transport?.reconnectToStream()).toThrow("Unsupported");
    chat.onError?.(new Error("down"));
    expect(toast.error).toHaveBeenCalledWith("AI chat error", { description: "down" });

    container.querySelector<HTMLButtonElement>("[title='Clear chat history']")?.click();
    expect(chat.setMessages).toHaveBeenCalledWith([]);

    root.unmount();
    container.remove();
  });
});
