// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  const send = vi.fn();
  class Command {
    type: string;
    input: unknown;
    constructor(type: string, input: unknown) {
      this.type = type;
      this.input = input;
    }
  }
  return { send, Command };
});

const { send } = mocks;

vi.mock("@/utils/env", () => ({
  env: {
    APP_URL: "http://localhost:3000",
    S3_ACCESS_KEY_ID: "key",
    S3_SECRET_ACCESS_KEY: "secret",
    S3_BUCKET: "resumes",
    S3_REGION: "us-east-1",
    S3_ENDPOINT: "http://localhost:9000",
    S3_FORCE_PATH_STYLE: true,
    FLAG_DISABLE_IMAGE_PROCESSING: true,
  },
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = mocks.send;
  },
  ListObjectsV2Command: class extends mocks.Command {
    constructor(input: unknown) {
      super("list", input);
    }
  },
  PutObjectCommand: class extends mocks.Command {
    constructor(input: unknown) {
      super("put", input);
    }
  },
  GetObjectCommand: class extends mocks.Command {
    constructor(input: unknown) {
      super("get", input);
    }
  },
  DeleteObjectCommand: class extends mocks.Command {
    constructor(input: unknown) {
      super("delete", input);
    }
  },
}));

import { getStorageService } from "./storage";

describe("S3 storage", () => {
  const storage = getStorageService();

  beforeEach(() => {
    send.mockReset();
  });

  it("lists keys, reads objects, and deletes a prefix", async () => {
    send.mockResolvedValueOnce({ Contents: [{ Key: "uploads/a" }, {}] });
    await expect(storage.list("uploads")).resolves.toEqual(["uploads/a", ""]);

    send.mockResolvedValueOnce({});
    await expect(storage.list("uploads")).resolves.toEqual([]);

    send.mockResolvedValueOnce({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2]) },
      ContentLength: 2,
      ETag: '"e"',
      LastModified: new Date(0),
      ContentType: "image/png",
    });
    await expect(storage.read("uploads/a")).resolves.toMatchObject({ size: 2, contentType: "image/png" });

    send.mockResolvedValueOnce({ Body: undefined });
    await expect(storage.read("uploads/missing-body")).resolves.toBeNull();

    send.mockRejectedValueOnce(new Error("missing"));
    await expect(storage.read("uploads/gone")).resolves.toBeNull();

    send.mockResolvedValueOnce({ Contents: [{ Key: "uploads/a" }, { Key: "uploads/b" }] });
    send.mockResolvedValueOnce(undefined);
    send.mockRejectedValueOnce(new Error("denied"));
    await expect(storage.delete("uploads")).resolves.toBe(true);

    send.mockResolvedValueOnce({ Contents: [] });
    await expect(storage.delete("uploads/empty")).resolves.toBe(false);

    send.mockResolvedValueOnce({ Contents: [{ Key: "uploads/a" }] });
    send.mockRejectedValueOnce(new Error("denied"));
    await expect(storage.delete("uploads/a")).resolves.toBe(false);
  });

  it("reports whether the bucket accepts a write", async () => {
    send.mockResolvedValue(undefined);
    await expect(storage.healthcheck()).resolves.toMatchObject({ type: "s3", status: "healthy" });

    send.mockRejectedValue(new Error("bad creds"));
    await expect(storage.healthcheck()).resolves.toMatchObject({
      type: "s3",
      status: "unhealthy",
      error: "bad creds",
    });

    send.mockRejectedValueOnce("nope");
    await expect(storage.healthcheck()).resolves.toMatchObject({ error: "Unknown error" });
  });
});
