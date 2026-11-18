# BMPS

익명 참여자가 브레인스토밍과 마인드맵 프로젝트를 함께 진행하는 웹 협업 시스템입니다.

## 현재 상태

협업용 모노레포 골격과 작업 연계 규칙을 준비했습니다. 기능 구현 범위와 순서는 다음 명세를 기준으로 합니다.

- 요구사항: `.kiro/specs/bmps/requirements.md`
- 기술 설계: `.kiro/specs/bmps/design.md`
- 구현·분업 계획: `.kiro/specs/bmps/tasks.md`
- 팀 협업 흐름: `docs/team-workflow.md`

## 저장소 구조

```text
apps/server                 HTTP/WebSocket 서버
apps/web                    React 웹 클라이언트
packages/contracts          공유 API·이벤트·도메인 계약
packages/test-support       공통 fixture와 mock
tools/demo-seed             발표·E2E용 결정적 데모 데이터
```

## 로컬 준비

1. Git과 Node.js 22 이상을 설치합니다.
2. 저장소 루트에서 `npm install`을 실행해 lockfile을 생성합니다.
3. `.env.example`을 `.env`로 복사하고 로컬 값을 입력합니다. 비밀 값은 커밋하지 않습니다.
4. `npm run check`, `npm run test`, `npm run build`를 실행합니다.

현재 작업 환경에는 Git, Node.js 및 npm이 없으므로 의존성 설치와 명령 검증은 아직 수행되지 않았습니다.

## 개발 시작

1. 팀장이 `packages/contracts`의 기준 계약을 확정합니다.
2. 각 담당자는 `.kiro/specs/bmps/tasks.md`의 하위 작업 하나를 선택합니다.
3. `feature/<task-id>-<topic>` 또는 `support/<task-id>-<topic>` 브랜치를 만듭니다.
4. 작업 번호와 요구사항 번호를 포함한 PR을 `develop`에 생성합니다.
5. 다른 팀원 한 명이 검토하고 팀장이 최종 병합합니다.
