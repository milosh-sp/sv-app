// @ts-expect-error The Vitest runner provides this module.
import * as client from "/@vite/client";

client.createHotContext = () => undefined as unknown as ReturnType<typeof client.createHotContext>;
