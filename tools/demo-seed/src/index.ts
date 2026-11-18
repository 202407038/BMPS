import type { DemoState } from "@bmps/contracts";

const serverUrl = process.env.BMPS_SERVER_URL ?? "http://localhost:3000";
const resetUrl = new URL("/api/reset", serverUrl);

try {
  const response = await fetch(resetUrl, { method: "POST" });
  if (!response.ok) {
    throw new Error(`서버가 ${response.status} 응답을 반환했습니다.`);
  }

  const state = (await response.json()) as DemoState;
  const itemCount = state.sessions.reduce((total, session) => total + session.items.length, 0);
  const analysisCount = state.sessions.reduce((total, session) => total + session.analyses.length, 0);

  console.log("BMPS 데모 데이터를 초기 상태로 복구했습니다.");
  console.log(`- 세션 ${state.sessions.length}개`);
  console.log(`- 의견 ${itemCount}개`);
  console.log(`- 분석 ${analysisCount}개`);
  console.log(`- 서버 ${resetUrl.origin}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`데모 데이터를 초기화하지 못했습니다: ${message}`);
  console.error("먼저 `npm run demo`로 서버를 실행해 주세요.");
  process.exitCode = 1;
}
