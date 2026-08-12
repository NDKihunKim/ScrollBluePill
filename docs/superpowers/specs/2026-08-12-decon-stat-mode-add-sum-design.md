# 디컨 스탯 편집 입력 모드 (추가/합) 설계

날짜: 2026-08-12
상태: 승인됨 (사용자: "A로 진행")

## 배경

디컨 페이지의 "2. 스탯 편집" 헤더 행에 **추가 / 합** 세그먼트 컨트롤을 추가한다.
현재 스탯 편집기는 델타(추가치) 입력 방식이며, 이를 최종 스탯(합) 입력 방식과 토글한다.

## 의미론

- **추가**: 입력값 = 깨끗한 상태(clean) 스탯에 더할 델타. 기본값 0. (현재 동작 그대로)
- **합**: 입력값 = 목표 아이템의 최종 스탯. 기본값 = clean 값.

| 세라핌즈 (공격력 clean 58, 슬롯 7) | 추가 | 합 |
|---|---|---|
| 표시 기본값 | 0 | 58 |
| 공격력 70 만들려면 | 12 입력 | 70 입력 |
| 엔진이 받는 targetDeltas | +12 | +12 (70 − 58) |
| MIN / MAX (표시) | −58 / +35 | 0 / 93 |

clean에 없는 스탯 (예: 세라핌즈 + DEX 추가, base 0)은 두 모드가 동일하게 동작한다.
표시 변환식 `합: 표시 = base + delta` 하나로 커버되며 특수 케이스가 없다.

## 설계: 순수 표시 변환 (Approach A)

- 저장/엔진에 흐르는 값은 계속 **델타** (`deconDeltas`). 엔진·슬롯 저장 형식 무변경.
- `deconStatMode: 'add' | 'sum'` 상태 하나 추가.
  - 세션 상태(save/loadDeconSession)에 키 `deconStatMode` 추가 (백-내비게이션 복원용).
  - 10개 저장 슬롯에는 넣지 않음 — 모드는 표시 선호이고 델타가 진실의 원천.
- 변환 헬퍼를 `statEditor.mjs`에 순수 함수로 둔다:
  - `statDisplayValue(mode, base, delta)` = `mode === 'sum' ? base + delta : delta`
  - `statDeltaFromDisplay(mode, base, value)` = `mode === 'sum' ? value - base : value`
- 모드 전환 시: `.active` 토글 + `rebuildStatEditor()` 재렌더. 델타 불변 → 목표값 보존이 공짜.
- 클램프는 계속 델타 도메인 `[−base, min(100, maxSlots × perScrollMax)]`에서 수행.

## 변경 파일

1. `src/lib/deconstruction/statEditor.mjs` — 순수 변환 헬퍼 2개, `rebuildStatEditor`에 `deconStatMode` 전달, 입력 표시/파싱에 헬퍼 적용.
2. `src/pages/deconstruction.astro` — 헤더 행 마크업 + 세그먼트 CSS, 모드 상태/버튼 배선, `setStatDelta`의 입력 표시 변환, 세션 복원, `saveDeconTransferSession` 호출 2곳에 키 추가.
3. `src/lib/deconSessionState.mjs` — `saveDeconTransferSession`에 `deconStatMode` 전달.
4. `tests/decon-stat-mode.test.mjs` — 변환 헬퍼 테스트 (세라핌즈 케이스 포함), `test:unit` 목록에 추가.

## 테스트

- 합 모드: 표시 = base + delta, 파싱 왕복 (70 → 12).
- 추가 모드: 항등.
- base 0 (추가된 스탯): 두 모드 동일.
- `npm test` 통과.

## 범위 밖

- 목표 칩/타겟 카드 표시는 델타 기반 그대로 (요청 범위 아님).
- 스크린샷 파싱은 항상 델타로 적용 — 합 모드에서도 표시가 스크린샷 값과 일치함.
