# 디컨 결과 전략 공유 (Share) 설계

날짜: 2026-08-19
상태: 승인됨 (사용자: "yes looks all good to me")

## 배경

디컨 페이지 결과의 각 전략 카드에 **공유** 버튼을 추가한다. 클릭하면 현재 디컨 상태와
공유 대상 전략 인덱스를 인코딩한 링크를 클립보드에 복사한다. 링크를 연 수신자는
정확히 같은 상태가 복원되고 분석이 재실행되어 동일한 결과를 보며, 공유된 전략이 있는
페이지로 이동·스크롤되고 은은한 하이라이트(약 5초 후 자동 페이드)로 표시된다.

## 설계 결정

- **링크 형식**: Approach A — 자체 포함 URL. 백엔드 없음.
  `https://paranpot.com/deconstruction/?s=<payload>`
- **payload** = `base64url(gzip(JSON({ v:1, ...state, strategyIndex })))`
  - `state` = `saveDeconTransferSession`이 만드는 스냅샷 객체와 동일한 형태
    (`scrollPosition` 제외 — 수신자에게 무의미).
  - 결과 payload는 URL에 담지 않는다. 수신자는 복원된 입력으로
    `enumerateStrategies`를 재실행 — 엔진은 결정적이므로 결과와 전략 순서가
    동일하고 `strategyIndex`가 유효하다.
- **압축**: 브라우저 네이티브 `CompressionStream`/`DecompressionStream`('gzip').
  미지원 환경(구형 Safari) 폴백: 압축 없이 raw JSON base64url (~2–3 KB, 동작은 동일).
- **하이라이트**: 자동 페이드 (~5초 펄스 후 사라짐).
- **링크 길이 실측** (실제 아이템 데이터의 스탯 키로 gzip): 일반 740자 /
  무거운 케이스 915자 / 극단 980자.

## 변경 파일

1. `src/lib/deconSessionState.mjs` — 스냅샷 빌더 순수 함수 `collectDeconState(opts)`
   추출. `saveDeconTransferSession`은 이를 호출해 저장만 담당.
2. `src/lib/deconstruction/pagination.mjs` — `goToPage(page)` 공개
   (기존 내부 `_goToPage` 노출).
3. `src/pages/deconstruction.astro`
   - `tryRestoreDeconSession` 본문을 `restoreDeconState(state, { highlightStrategyIndex })`로
     추출. 백/새로고침 경로는 세션 상태로, 공유 경로는 URL 디코드 상태로 호출.
   - 공유 인코드/디코드 헬퍼 (`encodeShareLink` / `decodeShareLink`).
   - 각 전략 카드 헤더(`기대값 계산` 옆)에 `공유` 버튼. 클릭 시 링크 복사,
     버튼이 `링크 복사됨`으로 ~2초 표시.
   - `?s=` 로드 시: 디코드 → `restoreDeconState` → `goToPage(floor(si/5)+1)` →
     카드 `scrollIntoView` → `decon-strategy-card--shared` 클래스 부여 →
     `animationend`에서 클래스 제거 → `history.replaceState`로 `?s` 제거
     (새로고침 시 재하이라이트 방지).
   - 복원 타이밍: 공유 디코드·복원도 기존 `_maybeRestoreDeconSession`의
     데이터 로드 게이트(아이템/스크롤 fetch 완료)를 그대로 탄다. `?s`가 있으면
     세션 스토리지 복원은 건너뛴다 (공유가 우선 — 낡은 세션 상태와 충돌 방지).
   - 하이라이트 CSS: `@keyframes` 박스섀도/아웃라인 펄스 → ~5초 페이드.
4. `tests/decon-share-link.test.mjs` — 인코드/디코드 왕복, 유효하지 않은 payload 무시.
   `test:unit` 목록에 추가.

## 상세 동작

- **클립보드**: `navigator.clipboard.writeText` 우선, 비보안 컨텍스트(로컬 개발 등)는
  숨은 textarea + `execCommand('copy')` 폴백. 실패 시 버튼 `복사 실패` 2초 표시,
  URL은 console에 출력(개발 보조) — 모달 없음.
- **유효하지 않은 링크** (디코드 실패, 버전 불일치, itemId 없음): 조용히 무시,
  일반 방문으로 처리 — 에러 UI 없음.
- **`strategyIndex` 범위 밖**: 하이라이트 생략, 결과는 정상 표시.
- **필터**: 수신자 쪽 결과 필터 칩은 `displayResults`가 새로 만들므로 항상 '전체' —
  모든 카드가 통과 상태에서 `floor(si/5)+1` 페이지 계산이 유효.
- **애널리틱스**: `trackEvent('deconstruction_share')` /
  `trackEvent('deconstruction_share_open')` — 기존 패턴과 동일.
- 공유 링크는 URL만으로 완전 — 새 탭(빈 세션 스토리지)에서도 동작.

## 테스트

- 인코드 → 디코드 왕복: state 동일성 (round-trip).
- 손상/잘못된 payload → null (무시 경로).
- `npm test` — 기존 43개 실패 베이스라인과 비교해 새 실패 없음 확인.

## 범위 밖

- 백엔드/짧은 링크 (Cloudflare Pages Function + KV) — Approach B. 링크 길이
  불만이 실제로 접수되면 후속.
- 결과 payload를 URL에 직접 담는 방식 (재실행으로 대체).
- 하이라이트 지속/뱃지 변형 (자동 페이드로 확정).
