import { buildApp } from "./app.js";

const app = buildApp({ logger: true });
const port = Number(process.env.PORT ?? 3000);

try {
  await app.listen({ host: "0.0.0.0", port });
  app.log.info(`BMPS demo API is ready at http://localhost:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
