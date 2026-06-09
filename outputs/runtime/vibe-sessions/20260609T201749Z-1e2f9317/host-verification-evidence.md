# Host Verification Evidence

## Scope
- Implemented the `수동 검색` accordion inside `1. 아이템 검색`.
- Kept `아이템 이름` visible by default.
- Collapsed `직업`, `장비 종류`, and `아이템 요구 레벨` by default.
- Preserved search, selected item syncing, generated item index use, and existing result card behavior.

## Commands
- `node --test tests/calculator-input-contract.test.mjs` passed.
- `npm run build` passed.

## UI Artifact Review
- Structure Completeness: manual-only controls are grouped under one accordion region.
- Interaction Feedback: `수동 검색` uses `aria-expanded` and active visual state.
- State Coverage: default collapsed state uses `aria-hidden="true"` and `inert`; opened state removes inert.
- Design System Consistency: button, field blocks, border radius, colors, and spacing reuse existing local styles.
- Responsive Stability: accordion uses grid row animation without fixed pixel height.
- Spec Fidelity: item name search remains visible; other manual fields are hidden until the toggle is clicked.

## Manual Review Status
- Browser-based manual spot checks remain pending in this host session because the Browser connector is unavailable.
- Automated coverage verifies source contract and production build, but not visual animation timing.
