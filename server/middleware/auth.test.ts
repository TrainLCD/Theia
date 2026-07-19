import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { mockEvent } from "nitro/h3";

const noopNext = () => undefined;

async function loadMiddleware() {
  vi.resetModules();
  const mod = await import("./auth");
  return mod.default;
}

function basicAuthHeader(username: string, password: string) {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth middleware", () => {
  it("lets requests through when AUTH_BYPASS is true", async () => {
    vi.stubEnv("AUTH_BYPASS", "true");
    vi.stubEnv("AUTH_USERNAME", "");
    vi.stubEnv("AUTH_PASSWORD", "");
    const middleware = await loadMiddleware();
    await expect(middleware(mockEvent("/"), noopNext)).resolves.toBeUndefined();
  });

  it("rejects with 503 when credentials are not configured", async () => {
    vi.stubEnv("AUTH_BYPASS", "");
    vi.stubEnv("AUTH_USERNAME", "");
    vi.stubEnv("AUTH_PASSWORD", "");
    const middleware = await loadMiddleware();
    await expect(middleware(mockEvent("/"), noopNext)).rejects.toMatchObject({ status: 503 });
  });

  it("rejects requests without valid basic auth credentials", async () => {
    vi.stubEnv("AUTH_BYPASS", "");
    vi.stubEnv("AUTH_USERNAME", "admin");
    vi.stubEnv("AUTH_PASSWORD", "secret");
    const middleware = await loadMiddleware();
    await expect(middleware(mockEvent("/"), noopNext)).rejects.toMatchObject({
      status: 401,
      headers: expect.any(Headers),
    });
    await expect(
      middleware(
        mockEvent("/", { headers: { authorization: basicAuthHeader("admin", "wrong") } }),
        noopNext,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("lets requests through with valid basic auth credentials", async () => {
    vi.stubEnv("AUTH_BYPASS", "");
    vi.stubEnv("AUTH_USERNAME", "admin");
    vi.stubEnv("AUTH_PASSWORD", "secret");
    const middleware = await loadMiddleware();
    await expect(
      middleware(
        mockEvent("/", { headers: { authorization: basicAuthHeader("admin", "secret") } }),
        noopNext,
      ),
    ).resolves.toBeUndefined();
  });
});
