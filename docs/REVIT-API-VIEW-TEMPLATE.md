# Revit API 2026 — View Template 연동 가이드 (UnitLab)

이 문서는 [Revit API 2026 문서](https://www.revitapidocs.com/2026/)를 기준으로, **UnitLab View Template** 애드인이 Revit과 어떻게 연결되는지 정리한 내부 참고 자료입니다.  
웹 편집기(Preset / V/G 체크리스트 / 카테고리·공종)와 Revit 플러그인(`src/UnitLab.ViewTemplate`) 사이의 계약을 명확히 하는 것이 목적입니다.

---

## 1. 프로그램 범위

| 구분 | 담당 | 비고 |
|------|------|------|
| **생성** | 시드 뷰 → `CreateViewTemplate()` → Preset 적용 | 현재 구현됨 |
| **수정** | 기존 View Template에 Preset V/G·properties 덮어쓰기 | `UpdateTemplateFromPresetCommand` (P4) |
| **적용** | 일반 뷰의 `View.ViewTemplateId` 지정 | 본 애드인 1차 범위 밖 (도면체계/RTE 연동 시) |
| **웹** | JSON Preset·체크리스트·`category-registry` 편집 | Revit 밖에서 데이터 준비 |

핵심 타입: **`Autodesk.Revit.DB.View`** — 일반 뷰와 View Template이 **같은 클래스**이며, `View.IsTemplate == true`이면 템플릿입니다.  
참고: [View Class (2026)](https://www.revitapidocs.com/2026/fb92a4e7-f3a7-ef14-e631-342179b18de9.htm)

---

## 2. View Template 생명주기 (API)

### 2.1 생성

```text
Document
  → 시드 View 생성 (예: ViewPlan.Create — FloorPlan / CeilingPlan)
  → seedView.CreateViewTemplate()   // 새 템플릿 View 반환
  → template.Name = "..."
  → template 에 V/G·속성 적용 (Transaction 내)
```

| API | 설명 | 문서 |
|-----|------|------|
| `View.IsViewValidForTemplateCreation()` | 템플릿으로 만들 수 있는 뷰인지 사전 검사 | [IsViewValidForTemplateCreation](https://www.revitapidocs.com/2026/8de8549b-ded8-94e1-434f-4883afc77028.htm) |
| `View.CreateViewTemplate()` | 이 뷰 설정을 복사한 **새 템플릿** 생성 | [CreateViewTemplate](https://www.revitapidocs.com/2026/84f4d0e3-ae49-c2f8-d7d3-53d120fe3223.htm) |
| `View.IsTemplate` | 템플릿 여부 | [View.IsTemplate](https://www.revitapidocs.com/2026/fb92a4e7-f3a7-ef14-e631-342179b18de9.htm) |

**현재 코드:** `SeedViewFactory` → `ViewTemplateService.CreateFromPreset` → `CreateTemplateFromPresetCommand` (Transaction 필수).

### 2.2 기존 템플릿 갱신 (Preset)

`ViewTemplateService.UpdateFromPreset` — `preset.templateName`과 **일치하는** `View.IsTemplate`을 찾아 `ViewPropertiesApplicator` + `CategoryOverridesApplicator`를 실행합니다.

- Ribbon: **Preset 갱신** (`UpdateTemplateFromPresetCommand`)
- 없는 이름이면 예외. **생성**과 달리 시드 뷰를 만들지 않음.
- `viewType`은 갱신하지 않음 (생성 시에만 사용).

### 2.3 일반 뷰에 템플릿 연결

| API | 설명 |
|-----|------|
| `View.ViewTemplateId` | 이 뷰를 제어하는 템플릿 Id ([View 속성](https://www.revitapidocs.com/2026/fb92a4e7-f3a7-ef14-e631-342179b18de9.htm)) |
| `View.IsValidViewTemplate(templateId)` | 해당 템플릿을 붙일 수 있는지 검증 |
| `View.ApplyViewTemplateParameters(View)` | 템플릿에서 **아직 이 뷰가 잠그지 않은** 파라미터만 가져오기 |

템플릿이 “Include”로 잠근 항목은 개별 뷰에서 API로 바꿀 수 없습니다 (`GetNonControlledTemplateParameterIds` / `GetTemplateParameterIds`).

---

## 3. V/G (Visibility / Graphics) — 카테고리 재지정

Revit 2014+ 부터 뷰·템플릿 단위 카테고리 그래픽 재지정은 **`View` + `OverrideGraphicSettings`** 조합입니다.

### 3.1 표시 ON/OFF (눈 아이콘)

| API | 설명 |
|-----|------|
| `View.SetCategoryHidden(categoryId, hidden)` | 카테고리 숨김 (`hidden==true` → OFF) |
| `View.GetCategoryHidden` | 현재 숨김 여부 |
| `category.AllowsVisibilityControl(view)` | 이 뷰에서 V/G 제어 가능 여부 (**적용 전 필수**) |

**Preset JSON:** `"hidden": true | false` → `CategoryOverridesApplicator`

### 3.2 Halftone · 선/면 · 투명도

| API | 설명 |
|-----|------|
| `View.GetCategoryOverrides(categoryId)` | 기존 재지정 읽기 |
| `View.SetCategoryOverrides(categoryId, ogs)` | 재지정 쓰기 |
| `OverrideGraphicSettings` | `SetHalftone`, `SetProjectionLineColor`, `SetSurfaceTransparency` 등 |

문서: [SetCategoryOverrides (2026)](https://www.revitapidocs.com/2026/ee90e635-7a78-3d14-9159-23a87f1655cc.htm)

사전 검사:

- `View.IsCategoryOverridable(category)` — 재지정 가능한 카테고리인지  
- `View.AreGraphicsOverridesAllowed()` — 뷰 타입이 V/G 재지정을 지원하는지  

예외: 카테고리를 재지정할 수 없음, Fill pattern이 drafting이 아님, 뷰 타입 미지원 등 → `ApplyContext.Warnings`에 기록 (현재 구현).

### 3.3 필터 · 링크 · 요소 단위 (미구현)

| API | 용도 | 우선순위 |
|-----|------|----------|
| `View.AddFilter` / `SetFilterOverrides` | V/G 필터 | 중 |
| `View.SetLinkOverrides` / `GetLinkOverrides` | RVT 링크별 V/G·페이즈 | 높음 (체크리스트 Links 행) |
| `View.SetElementOverrides` | 개별 Element | 낮음 |

링크 페이즈 등은 API 제한이 있는 경우가 있음 ([Autodesk Forum 예시](https://forums.autodesk.com/t5/revit-api-forum/change-phase-of-revit-link-in-view-template/td-p/13440888)).

---

## 4. 카테고리 식별 — UI 이름 vs `builtInCategory`

API는 **Revit UI에 보이는 문자열**을 받지 않습니다. 항상 `Category` (또는 `ElementId`)가 필요합니다.

### 4.1 권장 경로 (현재 애드인)

```text
Preset.builtInCategory (string)
  → BuiltInCategoryParser → BuiltInCategory enum
  → Category.GetCategory(document, builtInCategory)
  → category.Id → View.SetCategoryHidden / SetCategoryOverrides
```

| API | 설명 | 문서 |
|-----|------|------|
| `Category.GetCategory(Document, BuiltInCategory)` | enum → Category | [GetCategory](https://www.revitapidocs.com/2026/c3334f01-3294-3214-8dbf-d4bb79bb54b1.htm) |
| `Category.IsBuiltInCategoryValid` | obsolete enum 등 무효 값 걸러내기 | [IsBuiltInCategoryValid](https://www.revitapidocs.com/2026/15f903ae-3cdf-52b0-4891-fa2d1002e481.htm) |
| `BuiltInCategory` / `OST_*` | `Walls`, `OST_Walls` 모두 파서에서 시도 | `BuiltInCategoryParser.cs` |

**`builtInCategory`가 비어 있거나 enum에 없으면** 해당 Preset 행은 **건너뜀** (경고만).  
→ 웹 `category-registry`의 **Category (UI)** 와 **builtInCategory** 매핑이 플러그인 성공률을 결정합니다.

### 4.2 대안 경로 (향후 보강)

| 방법 | API | 비고 |
|------|-----|------|
| 이름으로 top-level 카테고리 | `doc.Settings.Categories.get_Item(string name)` | UI 표기와 일치할 때만 ([Categories.Item](https://www.revitapidocs.com/2026/c87c1b7c-55e8-0900-ee0a-f7e2fee0cd73.htm)) |
| 서브카테고리 | `Category.SubCategories`, `ElementId` | “Curtain Panels” 등 |
| ForgeTypeId (2022+) | `Category.GetBuiltInCategoryTypeId` | 장기적으로 enum 대체 추세 ([Category Class](https://www.revitapidocs.com/2026/d390ecf6-e5db-d7c1-d7f2-766c0686e975.htm)) |

체크리스트 CSV의 **Revit Category** 열 = UI 이름 → Preset/API용으로는 **registry에서 builtInCategory를 채워야** 합니다.

---

## 5. 뷰 기본 속성 (View Properties)

| Preset JSON | Revit API | 구현 |
|-------------|-----------|------|
| `properties.discipline` | `View.Discipline` (`ViewDiscipline` enum) | `ViewPropertiesApplicator` |
| `properties.detailLevel` | `View.DetailLevel` (`ViewDetailLevel`) | 동일 |
| `viewType` | 시드 뷰 종류 (`FloorPlan`, `CeilingPlan`) | `SeedViewFactory` |

추가 후보: `View.Scale`, `DisplayStyle`, Worksharing display, Phase Filter — 템플릿 “Include” 정책과 함께 설계 필요.

---

## 6. JSON Preset 계약 (애드인 ↔ 웹)

파일: `ViewTemplatePreset` (`Core/Models/ViewTemplatePreset.cs`)

```json
{
  "templateName": "A_건축_평면",
  "viewType": "FloorPlan",
  "properties": { "discipline": "Architectural", "detailLevel": "Medium" },
  "categoryOverrides": [
    {
      "builtInCategory": "Walls",
      "hidden": false,
      "halftone": true,
      "projection": { "lineColor": "#000000", "lineWeight": 3 },
      "surface": { "transparency": 50 }
    }
  ]
}
```

| 웹 데이터 | Preset / API 연결 |
|-----------|-------------------|
| `Web/categories.json` | `builtInCategory` 후보 목록 (API 이름) |
| `Web/vg-checklist.json` | UI 카테고리·IFC·Base Template ON/HT/% (참고 표) |
| `Web/category-registry.json` | UI ↔ `builtInCategory` ↔ 공종·자재 유형 (**매핑 마스터**) |

**권장 파이프라인 (목표):**  
`vg-checklist` + `category-registry` → Base Template별 Preset JSON 자동 생성 → `CreateTemplateFromPresetCommand`.

---

## 7. Transaction · 문서 · 수집

| 규칙 | 내용 |
|------|------|
| Transaction | 뷰 생성·이름·V/G 변경은 **반드시 Transaction** 안에서 ([CreateTemplateFromPresetCommand](src/UnitLab.ViewTemplate/Commands/CreateTemplateFromPresetCommand.cs)) |
| 읽기 전용 | `FilteredElementCollector`로 `View` + `IsTemplate` 목록 — Transaction 불필요 |
| 시드 뷰 | `CreateViewTemplate` 후 시드 뷰 삭제 여부는 정책 결정 (현재는 미삭제) |

템플릿 목록: `OfClass(typeof(View))` + `v.IsTemplate` — `ListViewTemplatesCommand`.

---

## 8. 구현 현황 vs API 맵

| Revit UI 기능 | API | UnitLab 상태 |
|---------------|-----|----------------|
| 템플릿 생성 | `CreateViewTemplate` | ✅ |
| 템플릿 이름 | `View.Name` | ✅ |
| Discipline / Detail Level | `View.Discipline`, `DetailLevel` | ✅ |
| 카테고리 ON/OFF | `SetCategoryHidden` | ✅ |
| Halftone | `OverrideGraphicSettings.SetHalftone` | ✅ |
| Projection/Cut 선·면 | `OverrideGraphicSettings` + 패턴/색 resolver | ✅ |
| Surface 투명도 | `SetSurfaceTransparency` | ✅ |
| 기존 템플릿 수정 | 동일 View 메서드 | 🔲 명령/UI |
| View에 템플릿 할당 | `ViewTemplateId` | 🔲 |
| 템플릿 Include 파라미터 | `GetTemplateParameterIds` | 🔲 |
| V/G Filters | `AddFilter`, `SetFilterOverrides` | 🔲 |
| RVT Link V/G | `SetLinkOverrides`, `OST_RvtLinks` | 🔲 |
| Worksets | `SetWorksetVisibility` | 🔲 |
| UI 이름만으로 카테고리 | `Categories.get_Item(string)` | 🔲 (registry 자동화 권장) |

---

## 9. 자주 쓰는 문서 링크 (2026)

| 주제 | URL |
|------|-----|
| Revit API 2026 홈 | https://www.revitapidocs.com/2026/ |
| View | https://www.revitapidocs.com/2026/fb92a4e7-f3a7-ef14-e631-342179b18de9.htm |
| CreateViewTemplate | https://www.revitapidocs.com/2026/84f4d0e3-ae49-c2f8-d7d3-53d120fe3223.htm |
| SetCategoryOverrides | https://www.revitapidocs.com/2026/ee90e635-7a78-3d14-9159-23a87f1655cc.htm |
| Category | https://www.revitapidocs.com/2026/d390ecf6-e5db-d7c1-d7f2-766c0686e975.htm |
| Category.GetCategory | https://www.revitapidocs.com/2026/c3334f01-3294-3214-8dbf-d4bb79bb54b1.htm |
| OverrideGraphicSettings | https://www.revitapidocs.com/2026/ (클래스명 검색) |

공식 PDF: Revit API 2026 — Official Reference Guide (revitapidocs 홈에서 링크).

---

## 10. 코드 위치 (빠른 참조)

| 역할 | 경로 |
|------|------|
| Preset 모델 | `src/UnitLab.ViewTemplate/Core/Models/` |
| JSON 로드 | `Core/Presets/JsonPresetLoader.cs` |
| 템플릿 생성 서비스 | `Revit/Services/ViewTemplateService.cs` |
| V/G 적용 | `Revit/Applicators/CategoryOverridesApplicator.cs` |
| 뷰 속성 적용 | `Revit/Applicators/ViewPropertiesApplicator.cs` |
| BuiltInCategory 파싱 | `Revit/BuiltInCategoryParser.cs` |
| 그래픽 병합 | `Revit/OverrideGraphicSettingsMerger.cs` |
| Ribbon 명령 | `CreateTemplateFromPresetCommand`, `UpdateTemplateFromPresetCommand`, `ListViewTemplatesCommand` |

---

*최초 작성: Revit API 2026 문서 + UnitLab.ViewTemplate 코드 기준. API 버전은 프로젝트가 참조하는 Revit 2026 빌드와 동기화할 것.*
