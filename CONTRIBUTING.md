# BMPS 기여 규칙

## 기준 문서

구현은 `.kiro/specs/bmps/requirements.md`, `design.md`, `tasks.md`를 기준으로 합니다. 요구사항에 없는 기능은 별도 합의 없이 추가하지 않습니다.

## 브랜치

- `main`: 발표·배포 가능한 릴리스
- `develop`: 팀장이 검증한 기능 통합
- `feature/<task-id>-<topic>`: 기능 구현
- `test/<task-id>-<topic>`: 독립 테스트 작업
- `support/<task-id>-<topic>`: 공통 UI·fixture·데모 지원

브랜치는 최신 `develop`에서 만들고, PR 대상도 `develop`으로 지정합니다.

## 작업 소유권

- 개발자 A: `apps/server/src/features/sessions`, `presence`, `sync`, `retention`
- 개발자 B: `apps/server/src/features/items`, `files`, `deletion`
- 개발자 C: `apps/server/src/features/analyses`, `reactions`, `apps/web/src/features`
- 발표·지원 담당: `apps/web/src/components/shared`, `packages/test-support`, `tools/demo-seed`
- 팀장: `packages/contracts`, 공통 DB/API 계약, 통합 및 릴리스

다른 담당자의 소유 영역을 바꿔야 하면 먼저 해당 담당자와 팀장에게 알립니다.

## 계약 변경

다음 변경은 기능 PR에 섞지 않고 `contract/<task-id>-<topic>` PR로 먼저 제안합니다.

- 공유 TypeScript 타입과 Zod 스키마
- HTTP·WebSocket 메시지
- DB 키·관계와 마이그레이션
- 오류 코드
- 저장소·Redis·분석 어댑터 포트

계약 PR에는 영향받는 소비자와 마이그레이션 방법을 적어야 합니다.

## PR 완료 조건

- 하나의 하위 작업만 다룹니다.
- 작업 ID와 요구사항 번호를 적습니다.
- 변경 범위, 검증 결과, 위험과 되돌리기 방법을 적습니다.
- 비밀, 개인정보, `.env`를 포함하지 않습니다.
- 다른 팀원 1명과 팀장의 승인을 받습니다.
- 공통 계약 변경 시 영향받는 모든 담당자가 확인합니다.
