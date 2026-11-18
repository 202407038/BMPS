import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createItemInputSchema,
  createSessionInputSchema,
  reactionInputSchema,
} from "@bmps/contracts";
import { DemoError, DemoStore } from "./demo-store.js";

interface BuildAppOptions {
  logger?: boolean;
  store?: DemoStore;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 1_000_000 });
  const store = options.store ?? new DemoStore();

  app.addHook("onRequest", async (request, reply) => {
    const allowedOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
    reply.header("Access-Control-Allow-Origin", allowedOrigin);
    reply.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type,Idempotency-Key");
    reply.header("Vary", "Origin");

    if (request.method === "OPTIONS") {
      await reply.status(204).send();
    }
  });

  app.get("/health", async () => ({ status: "ok", mode: "demo" }));
  app.get("/api/state", async () => store.getState());

  app.post("/api/reset", async (_request, reply) => {
    return reply.send(store.reset());
  });

  app.post("/api/sessions", async (request, reply) => {
    const input = createSessionInputSchema.parse(request.body);
    return reply.status(201).send(store.createSession(input));
  });

  app.post("/api/sessions/:sessionId/items", async (request, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(request.params);
    const input = createItemInputSchema.parse(request.body);
    return reply.status(201).send(store.createItem(sessionId, input));
  });

  app.delete("/api/sessions/:sessionId/items/:itemId", async (request, reply) => {
    const { sessionId, itemId } = z
      .object({ sessionId: z.string().min(1), itemId: z.string().min(1) })
      .parse(request.params);
    return reply.send(store.deleteItem(sessionId, itemId));
  });

  app.post("/api/sessions/:sessionId/analyses", async (request, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().min(1) }).parse(request.params);
    return reply.status(201).send(store.analyse(sessionId));
  });

  app.post("/api/analyses/:analysisId/reactions", async (request, reply) => {
    const { analysisId } = z.object({ analysisId: z.string().min(1) }).parse(request.params);
    const { option } = reactionInputSchema.parse(request.body);
    return reply.status(201).send(store.react(analysisId, option));
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return reply.status(400).send({
        code: "VALIDATION_ERROR",
        message: issue?.message ?? "입력 내용을 확인해 주세요.",
        field: issue?.path.join(".") || undefined,
      });
    }

    if (error instanceof DemoError) {
      return reply.status(error.statusCode).send({ code: error.code, message: error.message });
    }

    app.log.error(error);
    return reply.status(500).send({
      code: "DEMO_SERVER_ERROR",
      message: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    });
  });

  return app;
}
