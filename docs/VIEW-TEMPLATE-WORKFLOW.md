# View Template 워크플로 설계

ADR: [0001-preset-export-merged-vg](./adr/0001-preset-export-merged-vg.md)

## 목표 흐름

```text
[① 베이스 View Template]     예: A_면적_평면도_베이스
        │
        ├─ ③ V/G 체크리스트 — VT ID별 ON · HT · % · 재지정 (raw 저장)
        │
        ▼
[① 하위 View Template]       예: A_방화구획도 (derived)
        │
        ├─ export 시 조상 체인 병합 → effective V/G
        ├─ ③에서 이 노드에 명시한 변경만 raw에 저장
        │
        ▼
[④ Preset JSON]              Revit용 categoryOverrides (병합·변경분만)
        │
        ▼
[Revit] CreateViewTemplate → SetCategoryHidden / SetCategoryOverrides
        │  (추후: Preset으로 갱신 — ADR 로드맵)
```

Revit API 상세는 [REVIT-API-VIEW-TEMPLATE.md](./REVIT-API-VIEW-TEMPLATE.md) 참고.

## 웹 탭 (3개)

| 탭 | 역할 |
|----|------|
| **① 도면 템플릿** | VT 트리, Preset 미리보기·export (VT당 JSON 1개) |
| **② 카테고리 · 공종** | UI ↔ `builtInCategory` ↔ 공종·자재 (수동 유지) |
| **③ V/G 체크리스트** | VT별 V/G + 재지정 편집 |

## 결정 로그 (grill, 2026-06)

| 영역 | 결정 |
|------|------|
| Preset V/G | 조상까지 **체인 병합** 후 **effective** 기준; **명시 변경 셀만** `categoryOverrides` (P1) |
| 정본 | **Git `*.json`**; localStorage = 초안; 배포 URL (사내) |
| 배포 후 | **최신 시드 불러오기** — `*.json` fetch → 실패 시 `*-data.js` (P3) |
| 접근 | VPN/사내망, 로그인 없음 |
| Revit | **생성 / 갱신** 명령 분리; 갱신 = V/G + properties (P4) ✓ |
| export 품질 | `important:Y` + builtIn 없음 → **export 차단**; 그 외 미매핑·export 대상 → 경고·스킵 (P2) |
| Preset 파일 | **VT당 JSON 1개** |
| 이름 | `name`(웹) ≠ `revitTemplateName`(Revit) |
| registry | 수동; 행 추가 시 ② 정리 + 배포 전 「미연결만」 |
| VT 깊이 | 2단 권장, N단 허용 |
| 로드맵 | `categoryOverridesDelta`, `catalogProfile`, 이름 규칙 검증 |

구현 순서: **P1** ✓ → **P2** ✓ → **P3** ✓ → **P4** ✓.

## 데이터 모델

### `template-library.json`

- `nodes[]`: `id`, `name`, `revitTemplateName`, `role`, `parentId`, `inheritParentVg`, `viewType`, `properties`
- `inheritParentVg`: UX·향후 delta export용; **export 병합은 항상 조상 체인** (직접 부모만이 아님)

### `vg-checklist.json` v3

- `rows[]`: 카탈로그
- `vg[vt-id][row-id]`: `{ on, halftone, transp, projection?, cut?, surface? }` — **VT별 raw**
- localStorage: `unitlab-vg-checklist-v3`

### `category-registry.json`

- `builtInCategory` — **`important: Y` 행은 반드시** 있어야 Preset export 가능 (P2)

## Preset 생성 규칙 (P1)

1. `getAncestorChain(vtId)` — 루트 → 현재
2. 각 조상·현재 VT에 대해 `hasCellOverride(raw)` 인 레이어만 순서대로 병합 → **effective cell**
3. `rows` 순회: registry에서 `builtInCategory` 해석
4. effective에 `hasCellOverride` 인 행만 `cellToPresetOverride` → `categoryOverrides`
5. **① 미리보기**, **③·④ Preset export**, **전체 Preset보내기** — 동일 `buildPresetForNode()`
6. **P2:** 체크리스트 `important: Y` 인데 registry `builtInCategory` 없음 → `blocked`, export 중단; 그 외 미매핑이 export 대상이면 경고만

### 병합 시 주의

- 기본 셀 `{ on: OFF, halftone: -, transp: - }` 는 “미설정”. 조상만 바꾼 행은 자식 raw 기본값이 병합을 덮어쓰지 않음.
- ③에서 사용자가 수정한 VT 레이어는 `explicit: true` + **default와 다른 필드만** 위에 얹음. 부모 `ON` → 자식 `OFF` 같이 기본값과 같은 표시도 `explicit`이면 반영.

### Git 반영 (수동)

1. 웹에서 편집 → 필요 시 「브라우저에 저장」(localStorage)
2. `template-library.json`, `vg-checklist.json`, `category-registry.json` 각각 다운로드
3. `Web/`에 덮어쓰기 → `scripts/*` 로 `*-data.js` 재생성 → 커밋 → 배포

### 배포 ↔ 브라우저 (P3)

1. 배포 후 사용자가 **① 최신 시드 불러오기** 클릭
2. `fetch('vg-checklist.json')` 등 (HTTP 배포 시) → 없으면 페이지에 포함된 `*-data.js`
3. 세 탭 데이터 + **localStorage** 동시 갱신
4. 이후 편집·다운로드·Git 커밋

## Revit

| 명령 | 동작 |
|------|------|
| **Preset 생성** | `CreateFromPreset` — 시드 뷰 → 새 템플릿. 동일 이름 있으면 실패 |
| **Preset 갱신** | `UpdateFromPreset` — `templateName`으로 기존 템플릿 찾아 **V/G + properties** 적용 (P4) |

`viewType`은 생성 시만 사용. 갱신은 이름·뷰 타입을 바꾸지 않음.

## 파일

| 파일 | 용도 |
|------|------|
| `Web/template-library.json` | VT 트리 |
| `Web/vg-checklist.json` | 카탈로그 + VT별 raw V/G |
| `Web/category-registry.json` | API 매핑 |
| `docs/adr/0001-preset-export-merged-vg.md` | export 병합 ADR |
