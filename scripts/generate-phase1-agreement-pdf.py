# -*- coding: utf-8 -*-
"""Generate Phase 1 View Template standards agreement PDF."""
from pathlib import Path
from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "Phase1_ViewTemplate_합의사항.pdf"
FONT = Path(r"C:\Windows\Fonts\malgun.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\malgunbd.ttf")


class AgreementPDF(FPDF):
    def __init__(self):
        super().__init__()
        self.add_font("Malgun", "", str(FONT))
        self.add_font("Malgun", "B", str(FONT_BOLD))
        self.set_auto_page_break(auto=True, margin=18)

    def set_body(self, size=10):
        self.set_font("Malgun", "", size)

    def set_heading(self, level=1):
        sizes = {1: 16, 2: 13, 3: 11}
        self.set_font("Malgun", "B", sizes.get(level, 11))

    def h1(self, text):
        self.ln(4)
        self.set_heading(1)
        self.multi_cell(0, 9, text)
        self.ln(2)

    def h2(self, text):
        self.ln(3)
        self.set_heading(2)
        self.multi_cell(0, 8, text)
        self.ln(1)

    def h3(self, text):
        self.ln(2)
        self.set_heading(3)
        self.multi_cell(0, 7, text)

    def p(self, text):
        self.set_body(10)
        self.multi_cell(0, 6, text)
        self.ln(1)

    def bullet(self, text, indent=8):
        self.set_body(10)
        x = self.get_x()
        self.set_x(x + indent)
        w = self.w - self.l_margin - self.r_margin - indent
        self.multi_cell(w, 6, f"  -  {text}")
        self.ln(0.5)

    def table_row(self, cols, widths, header=False):
        h = 7 if not header else 8
        if header:
            self.set_font("Malgun", "B", 9)
        else:
            self.set_body(9)
        for i, (txt, w) in enumerate(zip(cols, widths)):
            self.cell(w, h, txt, border=1, align="L" if i == 0 else "C" if i > 1 else "L")
        self.ln(h)


def build():
    pdf = AgreementPDF()
    pdf.add_page()
    pdf.set_margins(18, 18, 18)

    pdf.h1("Unit Lab View Template 표준화")
    pdf.h2("Phase 1 합의사항 (grill-me)")
    pdf.p("문서 버전: 2026-05-20")
    pdf.p("프로젝트: UnitLab_ViewTemplate")
    pdf.p("기준 데이터: 도면체계 CSV (Notion export) — 예전 11 Base(RTE 추천안) 폐기")

    pdf.h2("1. 제품 방향")
    pdf.bullet("HTML = 총괄 허브: 도면↔템플릿 매핑, Base 트리, V/G 기록·관리, 비교·export")
    pdf.bullet("Revit 애드인 = manifest 기준 Base/Tier2 뷰 템플릿 생성·적용")
    pdf.bullet("표준의 진실 소스: Git Presets/standards/ → 배포 G:\\...\\04_RTE\\ViewTemplates\\standards\\")

    pdf.h2("2. 3계층 모델")
    pdf.bullet("Layer 1 Base: V/G 골격 (categoryMatrix, 전체 그리드 편집)")
    pdf.bullet("Layer 2 View Template: Revit 실제 템플릿명, Base 복사 후 Tier2 그리드 편집")
    pdf.bullet("Layer 3 도면(시트): CSV 도면명, 템플릿 참조(복수 허용)")

    pdf.h2("3. Base 12개 및 Tier2")
    widths = [52, 78, 55]
    pdf.table_row(["Base ID", "Tier2 / Revit 템플릿", "묶음 규칙"], widths, header=True)

    rows = [
        ("Base_SitePlan", "Site Plan", "1 Base"),
        ("Base_SchemePlan", "Scheme Plan + Scheme Plan_* 6종 (7)", "1 Base 통일"),
        ("Base_ArchPlan", "Architectural Plan", "평면 3분리 (1/3)"),
        ("Base_ArchPlan_Interior", "Architectural Interior Plan", "평면 3분리 (2/3)"),
        ("Base_ArchPlan_Roof", "Architectural Roof Plan", "평면 3분리 (3/3)"),
        ("Base_ArchElevation", "Architectural Elevation", "1 Base"),
        ("Base_ArchSection", "Architectural Section", "1 Base"),
        ("Base_ArchRCP", "Architectural Reflected Ceiling Plan", "1 Base"),
        ("Base_MechanicalPlan", "Mechanical Plan_* 6종", "1 Base 통일"),
        ("Base_StructuralPlan", "Structural Plan, _Lower, _Upper", "1 Base 통일"),
        ("Base_StructuralElevation", "Structural Elevation", "1 Base"),
        ("Base_FoundationPlan", "Foundation Plan (기초·앙카 2도면)", "1 Base"),
    ]
    for r in rows:
        pdf.table_row(list(r), widths)

    pdf.p("Tier2 목표: CSV 23종 + 신규 2종 = 25 Revit 템플릿")

    pdf.h2("4. 패밀리별 Base 묶음 결정")
    pdf.bullet("설비(MEP): Base 하나로 통일 → 6 trade 템플릿은 Tier2 diff")
    pdf.bullet("Scheme: Base 하나로 통일 → Scheme Plan이 Base 인스턴스, _Traffic 등 6종 Tier2")
    pdf.bullet("구조 평면: Base 하나 (Structural Plan 3종 Tier2)")
    pdf.bullet("건축 평면: Base 3개 (일반 / 내부 / 지붕) — V/G 성격이 달라 예외 분리")
    pdf.bullet("내부·지붕 Revit명: Architectural Interior Plan, Architectural Roof Plan")

    pdf.h2("5. 도면 ↔ 템플릿 특수 규칙")
    pdf.bullet('복수 템플릿: "평, 입, 단면상세도" → Architectural Plan + Architectural Section')
    pdf.bullet("drawing-system.json에 viewTemplates[] 배열, Revit은 뷰 타입별 적용")
    pdf.bullet("템플릿 미지정 도면 24종: Phase 1 V/G 대상 아님, 도면체계 탭에만 표시")

    pdf.h2("6. JSON / 배포 구조 (manifest + 분리 파일)")
    pdf.p("Presets/standards/")
    pdf.bullet("manifest.json — 버전, Base/Template 목록, deployPath")
    pdf.bullet("drawing-system.json — 시트·도면·템플릿 매핑 (CSV import)")
    pdf.bullet("bases/*.json — Base별 categoryMatrix")
    pdf.bullet("templates/*.json — extends + Tier2 오버라이드")

    pdf.p("Git = 소스 / 04_RTE\\ViewTemplates\\standards\\ = 배포 대상")

    pdf.h2("7. HTML V/G 편집 (합의 B)")
    pdf.bullet("Base: categoryMatrix 전체 그리드 편집")
    pdf.bullet("Tier2: Base를 시작값으로 복사한 뒤 템플릿별 전체 그리드 편집")
    pdf.bullet("export 시 diff 자동 계산 여부는 구현 단계에서 확정")

    pdf.h2("8. Phase 1 구현 순서 (합의 C)")
    pdf.bullet("1순위: 도면체계 탭 — CSV import, drawing-system.json, 복수 템플릿 UI")
    pdf.bullet("2순위: Base & 트리 — 12 Base, extends 관계")
    pdf.bullet("3순위: V/G 그리드 — 기존 Web 확장, Base에서 복사")
    pdf.bullet("4순위: Revit — manifest 일괄 생성 (applicator 파이프라인 확장)")

    pdf.h2("9. grill-me 결정 로그")
    decisions = [
        ("Q1 범위", "CSV 기준 Base 도출, HTML 총괄 허브"),
        ("Q2 설비", "Base_MechanicalPlan 1개"),
        ("Q3 Scheme", "Base_SchemePlan 1개"),
        ("Q4 건축 평면", "C — Base 3개"),
        ("Q5 구조 평면", "A — Base 1개"),
        ("Q6 복수 템플릿", "B — 템플릿 배열"),
        ("Q7 내부·지붕 명", "B — Architectural Interior/Roof Plan"),
        ("Q8 JSON", "C — manifest + 분리 파일"),
        ("Q9 표준 홈", "C — Git 소스 → RTE 배포"),
        ("Q10 V/G 편집", "B — Base + Tier2 전체 그리드"),
        ("Q11 구현 순서", "C — 도면체계 → 트리 → V/G → Revit"),
    ]
    w = [45, 140]
    pdf.table_row(["질문", "결정"], w, header=True)
    for q, d in decisions:
        pdf.table_row([q, d], w)

    pdf.h2("10. 후속 (미확정)")
    pdf.bullet("Tier2 export: diff vs 전체 스냅샷")
    pdf.bullet("CSV 재import merge 규칙")
    pdf.bullet("categoryMatrix 셀 스키마 v2 (ON/OFF/HT/na) 필드명")

    pdf.ln(4)
    pdf.set_body(9)
    pdf.multi_cell(
        0,
        5,
        "다음 단계 제안: /to-prd 로 PRD 고정 또는 1스프린트(도면체계 탭 + CSV import) 착수",
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT))
    print(f"Wrote: {OUT}")


if __name__ == "__main__":
    build()
