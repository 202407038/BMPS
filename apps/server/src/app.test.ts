import { afterEach, describe, expect, it } from "vitest";
import { MAX_FILE_SIZE_BYTES, type DemoState } from "@bmps/contracts";
import { buildApp } from "./app.js";

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("BMPS demo API", () => {
  it("creates an idea and produces an analysis snapshot", async () => {
    const app = buildApp();
    apps.push(app);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/sessions/session-campus/items",
      payload: {
        kind: "TEXT",
        content: "휠체어 이동 시간을 경로별로 함께 표시해요.",
        cluster: "action",
      },
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json<DemoState>();
    expect(created.sessions.find((session) => session.id === "session-campus")?.items).toHaveLength(5);

    const analysisResponse = await app.inject({
      method: "POST",
      url: "/api/sessions/session-campus/analyses",
    });
    expect(analysisResponse.statusCode).toBe(201);
    const analysed = analysisResponse.json<DemoState>();
    const session = analysed.sessions.find((entry) => entry.id === "session-campus");
    expect(session?.analyses).toHaveLength(1);
    expect(session?.analyses[0]?.snapshotItemIds).toHaveLength(5);
    expect(session?.analyses[0]?.directions.length).toBeGreaterThan(0);
  });

  it("rejects a file larger than 20 MiB without changing state", async () => {
    const app = buildApp();
    apps.push(app);

    const before = await app.inject({ method: "GET", url: "/api/state" });
    const beforeState = before.json<DemoState>();
    const initialCount = beforeState.sessions[0]?.items.length;

    const response = await app.inject({
      method: "POST",
      url: "/api/sessions/session-festival/items",
      payload: {
        kind: "FILE",
        content: "큰 파일",
        cluster: "action",
        file: {
          name: "too-large.zip",
          size: MAX_FILE_SIZE_BYTES + 1,
          mimeType: "application/zip",
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "VALIDATION_ERROR" });

    const after = await app.inject({ method: "GET", url: "/api/state" });
    expect(after.json<DemoState>().sessions[0]?.items).toHaveLength(initialCount ?? 0);
  });
});
