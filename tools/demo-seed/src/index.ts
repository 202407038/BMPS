const endpoint = process.env.BMPS_API_URL ?? "http://localhost:3000";

try {
  const response = await fetch(`${endpoint}/api/reset`, { method: "POST" });
  if (!response.ok) {
    throw new Error(`서버가 ${response.status} 상태를 반환했습니다.`);
  }
  const state = (await response.json()) as { sessions: Array<{ title: string; items: unknown[] }> };
  console.log("BMPS 데모 데이터를 초기화했습니다.");
  for (const session of state.sessions) {
    console.log(`- ${session.title}: 의견 ${session.items.length}개`);
  }
} catch (error) {
  console.error("데모 서버가 실행 중인지 확인해 주세요: npm run dev");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
