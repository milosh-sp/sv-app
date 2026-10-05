import { act } from "react";
import { createRoot } from "react-dom/client";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vite-plus/test";

const errorBox = vi.hoisted(() => ({ value: undefined as unknown }));

vi.mock("react-hook-form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-hook-form")>();
  return {
    ...actual,
    useFormState: () => ({
      errors: { name: errorBox.value },
      dirtyFields: {},
      touchedFields: {},
      validatingFields: {},
    }),
  };
});

import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "./form";

function Fields() {
  const form = useForm({ defaultValues: { name: "" } });
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="name"
        render={() => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl render={<input />} />
            <FormDescription>Help</FormDescription>
            <FormMessage className="msg" />
          </FormItem>
        )}
      />
    </Form>
  );
}

describe("form message", () => {
  it("reads a nested message and ignores a message-less object", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const render = async () => {
      await act(async () => {
        root.render(<Fields />);
      });
    };

    errorBox.value = undefined;
    await render();
    errorBox.value = { type: "required", message: "Need a name" };
    await render();
    expect(container.textContent).toContain("Need a name");

    errorBox.value = { message: 1, a: "nope", b: { message: "nested" } };
    await render();
    expect(container.textContent).toContain("nested");

    errorBox.value = { message: 1, a: 2 };
    await render();
    expect(container.querySelector("[data-slot='form-message']")).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
