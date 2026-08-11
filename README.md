# 다마고치 마을

알을 부화·진화시켜 24종 성체 도감을 완성하는 레트로 육성·수집 웹게임.

**설계 문서 [`docs/design.md`](docs/design.md) 가 유일한 기준이다.** 와이어프레임 등 시각 자료는 참고용이며, 명세와 충돌할 경우 항상 문서를 따른다.

## 시작하기

```bash
npm install
npx prisma generate         # Prisma Client 생성 (.env 없이도 동작)
npx next typegen            # 라우트 타입 생성 — 없으면 tsc 가 실패한다
npm run dev
```

`next typegen` 을 건너뛰면 클론 직후 `Cannot find name 'LayoutProps'` 타입 오류가 뜬다.
`next-env.d.ts` 가 `.next/types/*.d.ts` 를 참조하는데 그 폴더가 아직 없기 때문이다.
`npm run dev` 를 한 번 돌려도 자동 생성되지만, 에디터를 먼저 열면 빨간 줄부터 보게 된다.

### DB 가 필요한 트랙

| 트랙 | `.env` 없이 시작 |
|---|---|
| B (마을·미니게임) | ✅ 가능 |
| D (아트·도감 UI) | ✅ 가능 |
| A (코어) | ❌ 필요 |
| C (인증·소셜) | ❌ 필요 |

A · C 는 추가로 다음이 필요하다. `DATABASE_URL` 과 `AUTH_SECRET` 은 저장소 밖에서 공유받는다.

```bash
cp .env.example .env        # 값 채우기
npx prisma migrate dev      # 스키마 반영 (최초 1회 마이그레이션 생성)
npm run db:seed             # 24종 마스터 + 테스트 계정 2개
```

시드는 **테스트 계정 2개**(`테스터1` / `테스터2`, 비밀번호 `test1234`)를 만든다.
교환은 계정이 둘 필요하므로 혼자서는 테스트할 수 없다. 개발 전용이며 운영에는 넣지 않는다.

몇 번을 돌려도 같은 결과가 되도록 전부 upsert 로 작성되어 있다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm test` | 진화 엔진 불변식 테스트 |
| `npm run test:watch` | 테스트 워치 모드 |
| `npm run lint` | ESLint |
| `npm run verify` | **PR 전 필수** — 타입 체크 + 테스트 + 린트 일괄 |
| `npm run db:seed` | 24종 마스터 + 테스트 계정 시드 |
| `npm run db:reset` | DB 초기화 후 마이그레이션·시드 재실행 |

### 통합 테스트

`npm test` 는 기본적으로 순수 함수만 검증한다(1초 내외). 서비스 계층 통합 테스트는
`TEST_DATABASE_URL` 이 설정된 경우에만 돈다.

```bash
# .env 에 추가 — DATABASE_URL 과 같은 DB, 스키마만 분리
TEST_DATABASE_URL="<DATABASE_URL 과 동일>&schema=test_integration"

# 최초 1회 테이블 생성
DATABASE_URL="<위 값>" npx prisma migrate deploy
```

**개발 DB 를 가리키면 안 된다.** 테스트가 users·pets·trades 를 비우므로 팀 전체
데이터가 날아간다. 두 값이 같으면 `vitest.setup.ts` 가 실행을 중단시킨다.

통합 테스트는 트랜잭션·잠금·유니크 제약처럼 순수 함수 테스트가 볼 수 없는 것을
검증한다. 실제로 교환 만료 시 잠금이 풀리지 않던 버그가 여기서 발견되었다.

개발·시연 중에는 `.env` 에 `GAME_FAST_MODE=1` 을 넣어 성장 요구치를 25회 → 7회로 낮춘다.

## 구조

```
docs/design.md            설계 문서 — 모든 판단의 기준
prisma/schema.prisma      DB 스키마
src/lib/game/             진화 엔진 (순수 함수, DB·UI 무지)
src/lib/server/           Prisma 클라이언트 + 서비스 계층
src/types/api.ts          트랙 간 인터페이스 계약
src/app/api/              API 라우트
src/app/(auth)/           로그인·가입
src/app/(game)/           마을·보상
src/components/           UI (village / minigame / house / hud / dex / fx / trade / guestbook)
public/sprites/           스프라이트
```

## 아키텍처 원칙

문서 16장에서 가져온 것으로, 판단이 필요할 때 여기로 돌아온다.

1. **서버가 상태의 유일한 진실이다.** 모든 난수(알비노 1%, 가챠, 보상 알)는 서버에서만 굴리고 즉시 영속화한다. 행위자는 요청 바디가 아니라 **세션에서 도출**한다.
2. **규칙은 순수 함수로, UI와 분리한다.** `src/lib/game/` 은 DB도 네트워크도 모른다. 서비스 계층이 상태를 읽어 넘기고 결과를 저장할 뿐이다.
3. **밸런스 수치는 전부 `src/lib/game/constants.ts` 에 있다.** 코드에 숫자를 흩뿌리지 않는다.

## 구현 시 특히 주의할 것

| 항목 | 문서 |
|---|---|
| 단계 전환 시 성향 카운터 리셋 — 누락하면 12종이 도달 불가 | 3장 |
| 동점 처리는 "동점 그룹 중" 마지막 (`lastFedSeq` 필요) | 3장 |
| 보상 알 API 2단계 분리 — 합치면 결과가 사전 노출 | 6장 |
| 교환은 단일 트랜잭션 — 중간 실패 시 개체 복제/증발 | 9장 |
| 집 화면에 스탯 바를 만들지 않는다 (배고픔·청결 없음) | 17.2 |
| 방명록은 전역 게시판 — 우편함은 접근 지점일 뿐 | 17.6 |

## 트랙 분담

| | 담당 | 영역 |
|---|---|---|
| A | 게임 코어 | 진화 엔진, 펫·알 사이클, 채집 API, 도감, 스키마 |
| B | 마을 필드 | 타일맵·이동·충돌, 미니게임 3종, 집·HUD |
| C | 인증 · 소셜 | 로그인 게이트, 교환, 방명록 |
| D | 아트 · UI | 스프라이트, 도감 UI, 연출 |

## 협업 규칙

### 브랜치

```
main            항상 동작하는 상태 유지. 직접 push 금지
 └─ <담당자>/<작업>      예) a/feed-api, b/village-tilemap, c/auth-gate, d/dex-grid
```

- 담당자별 장수 브랜치를 두지 않는다. **작업 단위로 만들고 머지 후 삭제**한다
- 브랜치 수명은 2일을 넘기지 않는다. 길어질 것 같으면 작업을 쪼개서 먼저 머지한다
- PR 전에 `git fetch origin && git rebase origin/main`
- GitHub 에서 **Squash merge** 로 합친다

### 브랜치 보호 대신 지키는 약속

저장소 플랜 제약으로 브랜치 보호를 쓰지 않는다. 다음은 규칙으로 지킨다.

- `main` 에 직접 push 하지 않는다. 항상 PR 을 거친다
- **PR 올리기 전에 `npm run verify` 를 돌린다.** 타입·테스트·린트를 한 번에 검사한다
- 남의 디렉토리를 건드린 PR 은 해당 담당자 리뷰를 받는다
- `src/types/api.ts` 변경은 **단독 PR** 로 올리고 머지 후 팀에 알린다. 전원에게 영향이 간다

### 비밀 값

`.env` 는 `.gitignore` 로 제외되어 있다. `DATABASE_URL`, `AUTH_SECRET` 은 **저장소 밖에서** 공유한다.

`.env.example` 에 실제 값을 적지 않는다. 이 파일은 추적되므로 그대로 푸시된다.
