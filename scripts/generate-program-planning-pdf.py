# -*- coding: utf-8 -*-
"""Unit Lab View Template — program introduction & planning PDF."""
from pathlib import Path
from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
FONT = Path(r"C:\Windows\Fonts\malgun.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\malgunbd.ttf")


class PlanPDF(FPDF):
    def __init__(self):
        super().__init__()
        self.add_font("Malgun", "", str(FONT))
        self.add_font("Malgun", "B", str(FONT_BOLD))
        self.set_auto_page_break(auto=True, margin=20)
        self._section = 0

    def footer(self):
        self.set_y(-14)
        self.set_font("Malgun", "", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, f"Unit Lab View Template 개발 기획서  |  {self.page_no()} / {{nb}}", align="C")

    def body(self, size=10):
        self.set_text_color(0, 0, 0)
        self.set_font("Malgun", "", size)

    def bold(self, size=10):
        self.set_text_color(0, 0, 0)
        self.set_font("Malgun", "B", size)

    def h1(self, t):
        self.set_x(self.l_margin)
        self.ln(5)
        self.bold(16)
        self.multi_cell(0, 9, t)
        self.ln(3)

    def h2(self, t):
        self._section += 1
        self.set_x(self.l_margin)
        self.ln(4)
        self.bold(13)
        self.multi_cell(0, 8, f"{self._section}. {t}")
        self.ln(2)

    def h3(self, t):
        self.set_x(self.l_margin)
        self.ln(2)
        self.bold(11)
        self.multi_cell(0, 7, t)
        self.ln(1)

    def p(self, t):
        self.set_x(self.l_margin)
        self.body(10)
        self.multi_cell(0, 6, t)
        self.ln(1)

    def bullet(self, t):
        self.set_x(self.l_margin + 6)
        self.body(10)
        w = self.w - self.l_margin - self.r_margin - 10
        self.multi_cell(w, 6, f"- {t}")
        self.ln(0.3)

    def table(self, headers, rows, widths):
        self.set_x(self.l_margin)
        self.bold(9)
        for h, w in zip(headers, widths):
            self.cell(w, 8, h, border=1, align="C")
        self.ln(8)
        self.body(9)
        for row in rows:
            self.set_x(self.l_margin)
            for val, w in zip(row, widths):
                self.cell(w, 7, val, border=1)
            self.ln(7)
        self.ln(2)


def cover(pdf: PlanPDF):
    pdf.add_page()
    pdf.ln(45)
    pdf.bold(22)
    pdf.multi_cell(0, 12, "Unit Lab\nView Template 표준화", align="C")
    pdf.ln(8)
    pdf.bold(14)
    pdf.multi_cell(0, 8, "프로그램 소개서 · 개발 기획서", align="C")
    pdf.ln(20)
    pdf.body(11)
    pdf.multi_cell(0, 7, "Revit 2026 뷰 템플릿 표준을 데이터로 정의하고\n웹에서 관리·Revit에서 일괄 적용하는 사내 도구", align="C")
    pdf.ln(30)
    pdf.body(10)
    pdf.multi_cell(0, 6, "Unit Lab R&D  |  UnitLab_ViewTemplate\n문서 버전: 2026.05.20  |  Phase 1 기준", align="C")


def build():
    pdf = PlanPDF()
    pdf.alias_nb_pages()
    cover(pdf)

    pdf.add_page()
    pdf.h1("문서 목적")
    pdf.p(
        "본 문서는 Unit Lab의 Revit 뷰 템플릿(V/G) 표준화 프로그램의 배경, 목표, "
        "시스템 구성, 데이터 모델, 개발 로드맵을 정리한 소개·기획서입니다. "
        "도면체계(Notion/CSV)와 grill-me 합의를 반영하였습니다."
    )

    pdf.h2("배경 및 문제")
    pdf.h3("현황")
    pdf.bullet("사내 RTE(Revit Template)에서 View Template V/G를 수동으로 맞춤")
    pdf.bullet("도면 종류·분야(건축/구조/MEP)별로 보여야 할 카테고리가 다름")
    pdf.bullet("표지·일람·계획도 등 도면체계와 Revit 템플릿 연결이 문서·실무에 분산")
    pdf.h3("리스크")
    pdf.bullet("카테고리 ON/OFF·Halftone·재지정 누락 → 도면 품질·분야 혼선")
    pdf.bullet("템플릿 이름·Discipline 불일치 → 팀원마다 다른 RTE 해석")
    pdf.bullet("Tier2 파생 시 부모 대비 변경 추적 불가")
    pdf.h3("기회")
    pdf.bullet("표준을 JSON으로 고정 → Git 버전 관리·검토·재현 가능")
    pdf.bullet("웹 그리드로 V/G 편집·비교 → Revit 클릭 작업 최소화")

    pdf.h2("목표 및 성공 기준")
    pdf.h3("비전")
    pdf.p("비전: 도면체계 CSV가 말하는 대로, RTE에 항상 같은 View Template이 적용된다.")
    pdf.h3("Phase 1 성공 기준")
    pdf.bullet("도면체계 CSV → drawing-system.json import 및 HTML에서 조회·편집")
    pdf.bullet("12 Base · 25 Tier2 템플릿 관계 정의 및 V/G 그리드 편집")
    pdf.bullet("manifest 기준 JSON export → Revit에서 Base/Tier2 일괄 생성")
    pdf.bullet("Git Presets/standards/ → 04_RTE 배포 경로 확립")
    pdf.h3("중장기")
    pdf.bullet("기존 템플릿 Export·Update·Validate")
    pdf.bullet("필터·뷰 범위·링크 V/G·템플릿 포함(Tier 3)")

    pdf.h2("솔루션 개요")
    pdf.p("3계층 분리: 표준 데이터 · 웹 허브 · Revit 애드인")
    pdf.table(
        ["계층", "역할", "기술"],
        [
            ("표준 저장소", "Base/Tier2/도면 매핑 JSON", "Git + RTE 배포"),
            ("웹 편집기", "총괄·V/G·비교·export", "HTML/JS (file://)"),
            ("Revit 애드인", "읽기·생성·적용만", ".NET 8 / Revit 2026 API"),
        ],
        [38, 72, 75],
    )
    pdf.p("원칙: Revit UI 로직은 애드인에 두지 않고 Applicator 파이프라인으로 확장.")

    pdf.add_page()
    pdf.h2("대상 사용자 및 시나리오")
    pdf.table(
        ["사용자", "주요 시나리오"],
        [
            ("BIM 표준 담당", "Base 매트릭스 설계, CSV 도면체계 반영"),
            ("건축/구조/MEP 모델러", "RTE 열기 → manifest 템플릿 자동 생성"),
            ("PM/QA", "Preset 비교·diff, 배포 전 검증"),
        ],
        [45, 140],
    )

    pdf.h2("도면체계 기준 (Unit Lab)")
    pdf.p("기준 문서: Notion 도면체계 → CSV export. Revit 템플릿명(영문)과 시트 구분(A/M/S) 연결.")
    pdf.h3("규모 (CSV 기준)")
    pdf.bullet("도면 약 70행 · 뷰템플릿 지정 23종(+ 신규 2) · 미지정 24종(표지·일람·상세 등)")
    pdf.bullet("복수 템플릿 예: 평·입·단 상세도 → Architectural Plan + Architectural Section")
    pdf.h3("HTML 허브 역할")
    pdf.bullet("도면체계 탭: 시트·도면명·연결 템플릿(복수)·보유 여부")
    pdf.bullet("Base & 트리: 12 Base 하위 Tier2")
    pdf.bullet("V/G 편집: Base·Tier2 전체 카테고리 그리드 + 재지정 패널")
    pdf.bullet("비교·라이브러리·JSON export (기존 Web 확장)")

    pdf.h2("시스템 아키텍처")
    pdf.p("[표준] Git Presets/standards/  --배포-->  G:\\...\\04_RTE\\ViewTemplates\\standards\\")
    pdf.p("[편집] Web 허브  --export-->  manifest + bases + templates + drawing-system")
    pdf.p("[적용] Revit 애드인  --load manifest-->  ViewTemplateService --> Applicators --> View")
    pdf.h3("Revit Applicator (현재·확장)")
    pdf.bullet("구현됨: ViewPropertiesApplicator, CategoryOverridesApplicator")
    pdf.bullet("예정: Filters, ViewRange, TemplateIncludes, LinkVisibility")

    pdf.h2("데이터 모델")
    pdf.p("manifest.json이 진입점. 파일 분리(C 합의):")
    pdf.bullet("drawing-system.json — 도면 ID, 구분, 이름, viewTemplates[]")
    pdf.bullet("bases/Base_*.json — categoryMatrix, discipline, viewType 시드")
    pdf.bullet("templates/*.json — extends, Tier2 categoryOverrides·properties")
    pdf.h3("Tier 규칙")
    pdf.bullet("Tier1 Base: V/G 골격(카테고리 표시 정책)")
    pdf.bullet("Tier2: Revit View Template 인스턴스, Base 복사 후 diff")
    pdf.bullet("Tier3(후속): 프로젝트별 파생·필터·뷰범위")

    pdf.add_page()
    pdf.h2("Base / Tier2 표준 체계 (12 Base)")
    pdf.table(
        ["Base ID", "Tier2 (Revit명)", "비고"],
        [
            ("Base_SitePlan", "Site Plan", "배치"),
            ("Base_SchemePlan", "Scheme Plan + *_6", "1 Base 통일"),
            ("Base_ArchPlan", "Architectural Plan", "평면 3분리"),
            ("Base_ArchPlan_Interior", "Architectural Interior Plan", "신규"),
            ("Base_ArchPlan_Roof", "Architectural Roof Plan", "신규"),
            ("Base_ArchElevation", "Architectural Elevation", ""),
            ("Base_ArchSection", "Architectural Section", ""),
            ("Base_ArchRCP", "Arch. Reflected Ceiling Plan", ""),
            ("Base_MechanicalPlan", "Mechanical Plan_* x6", "1 Base 통일"),
            ("Base_StructuralPlan", "Structural Plan x3", "1 Base 통일"),
            ("Base_StructuralElevation", "Structural Elevation", ""),
            ("Base_FoundationPlan", "Foundation Plan", "기초·앙카"),
        ],
        [52, 78, 55],
    )
    pdf.h3("패밀리 묶음 원칙")
    pdf.bullet("Scheme·설비·구조평면: 접미사 패밀리 → Base 1개 + Tier2 diff")
    pdf.bullet("건축 평면: 내용 차이(가구·지붕) → Base 3개 예외")

    pdf.h2("구현 현황 (MVP)")
    pdf.h3("Revit 애드인 (UnitLab.ViewTemplate)")
    pdf.bullet("리본: UnitLab 탭 — 목록 보기, Preset 생성")
    pdf.bullet("JSON → 시드 뷰 생성 → CreateViewTemplate → V/G·속성 적용")
    pdf.bullet("카테고리: Walls 등 OST_ 자동 보정, projection/cut/surface 재지정")
    pdf.bullet("배포: Revit 2026 Addins (Nice3point Build Tasks)")
    pdf.h3("웹 편집기 (Web/)")
    pdf.bullet("탭: 편집 / 비교 / 라이브러리 (localStorage)")
    pdf.bullet("~150 카테고리 그리드, 검색, 재지정 패널")
    pdf.bullet("미구현: 도면체계, Base 트리, manifest, CSV import")

    pdf.h2("개발 로드맵")
    pdf.table(
        ["단계", "범위", "상태"],
        [
            ("Phase 0", "단일 Preset JSON 생성·Web 편집 MVP", "완료"),
            ("Phase 1", "도면체계·12 Base·manifest·RTE 배포·일괄 생성", "기획 확정"),
            ("Phase 2", "Export/Update/Validate, diff 리포트", "예정"),
            ("Phase 3", "필터·뷰범위·링크·Tier3", "예정"),
        ],
        [28, 115, 42],
    )
    pdf.h3("Phase 1 구현 순서")
    pdf.bullet("1. 도면체계 탭 + CSV → drawing-system.json")
    pdf.bullet("2. Base & 트리 UI + 12 Base JSON 골격")
    pdf.bullet("3. V/G 그리드 (Base/Tier2, Base에서 복사)")
    pdf.bullet("4. Revit BatchCreateFromStandards (manifest)")

    pdf.add_page()
    pdf.h2("기술 스택")
    pdf.table(
        ["영역", "선택"],
        [
            ("Revit", "2026"),
            (".NET", "8"),
            ("Revit API", "Chuongmep.Revit.Api 2026"),
            ("빌드/배포", "Nice3point.Revit.Build.Tasks"),
            ("웹", "Vanilla HTML/CSS/JS"),
            ("표준 형식", "JSON (schema v2 예정)"),
        ],
        [45, 140],
    )

    pdf.h2("운영 · 배포 · 거버넌스")
    pdf.bullet("소스: UnitLab_ViewTemplate/Presets/standards/")
    pdf.bullet("배포: G:\\공유 드라이브\\...\\04_RTE\\ViewTemplates\\standards\\")
    pdf.bullet("변경: Git PR·리뷰 → RTE 복사 → Revit RTE 갱신 안내")
    pdf.bullet("도면체계 CSV 갱신 시 re-import 정책(merge) — 구현 시 확정")

    pdf.h2("리스크 및 대응")
    pdf.table(
        ["리스크", "대응"],
        [
            ("Revit DLL 잠금", "배포 전 Revit 종료"),
            ("API 한계(필터 등)", "Phase 3, Applicator 분리"),
            ("Tier2·Base drift", "비교 탭·diff export·Validate 명령"),
            ("이중 명명(영문/약어)", "drawing-system에 시트코드·Revit명 매핑 고정"),
        ],
        [55, 130],
    )

    pdf.h2("부록 — grill-me 핵심 합의")
    decisions = [
        "CSV 기준 Base 도출, 11 Base 폐기",
        "설비·Scheme·구조평면: Base 1개",
        "건축 평면: Base 3개 (Interior/Roof Plan 명명)",
        "복수 템플릿: 배열 + 뷰타입별 적용",
        "JSON: manifest + 분리 파일",
        "Git 소스 → RTE 배포",
        "V/G: Base·Tier2 전체 그리드 편집",
    ]
    for d in decisions:
        pdf.bullet(d)

    pdf.ln(6)
    pdf.body(9)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(
        0,
        5,
        "문의·개정: Unit Lab R&D  |  저장소: UnitLab_ViewTemplate\n"
        "합의 상세 PDF: docs/Phase1_ViewTemplate_합의사항.pdf",
    )

    DOCS.mkdir(parents=True, exist_ok=True)
    out_ko = DOCS / "UnitLab_ViewTemplate_개발기획서.pdf"
    out_en = DOCS / "UnitLab_ViewTemplate_Development_Plan.pdf"
    pdf.output(str(out_ko))
    import shutil
    shutil.copy(out_ko, out_en)
    downloads = Path.home() / "Downloads" / "UnitLab_ViewTemplate_Development_Plan.pdf"
    shutil.copy(out_ko, downloads)
    print(f"Wrote: {out_ko}")
    print(f"Copy:  {out_en}")
    print(f"Copy:  {downloads}")


if __name__ == "__main__":
    build()
