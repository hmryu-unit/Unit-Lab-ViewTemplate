#!/usr/bin/env python3
"""docs/*공정*.csv -> Web/process-database.json + *-data.js"""
import csv
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "Web"
DOCS = ROOT / "docs"

TRADE_RULES: list[tuple[list[str], list[str]]] = [
    (["철골", "골조", "스티프너", "인양", "캐노피", "판넬", "잔넬", "기초", "앙카", "토공", "굴착", "콘크리트"], ["g-str"]),
    (["설비", "배관", "보일러", "공조", "덕트", "급수", "배수", "가스", "오수", "정화", "우수"], ["g-mech", "g-plum"]),
    (["전기", "조명", "스위치", "콘센트", "iot", "옥외 전기"], ["g-elec"]),
    (["창호", "현관문", "폴딩", "도어", "문틀", "유리"], ["g-arch"]),
    (["석고", "도배", "타일", "마루", "바닥재", "걸레받이", "몰딩", "수장", "가구", "커튼", "실리콘", "중문", "합판"], ["g-int"]),
    (["외장", "징크", "후레싱", "후레상", "방수", "사이딩", "홈통", "외벽"], ["g-arch"]),
    (["조경", "포장", "데크", "주차", "외부공사"], ["g-land"]),
    (["현장", "모듈", "결합", "이동", "준공", "청소", "마감"], ["g-coord"]),
    (["화장실", "욕실", "위생", "돔천장", "환풍"], ["g-plum", "g-int"]),
    (["난방", "냉난방"], ["g-mech"]),
]


def find_csv() -> Path:
    hits = list(DOCS.glob("*공정*.csv"))
    if not hits:
        raise FileNotFoundError("docs 폴더에 공정 DB csv가 없습니다.")
    return hits[0]


def slugify(text: str) -> str:
    s = re.sub(r"[^\w\s가-힣-]", "", (text or "").strip().lower())
    s = re.sub(r"[\s_]+", "-", s).strip("-")
    return s or "process"


def parse_link_names(cell: str) -> list[str]:
    if not (cell or "").strip():
        return []
    names = []
    for part in re.split(r",(?![^(]*\))", cell):
        part = part.strip()
        if not part:
            continue
        m = re.match(r"^([^(]+)", part)
        if m:
            names.append(m.group(1).strip())
    return names


def guess_trade_ids(name: str, description: str) -> list[str]:
    hay = f"{name} {description}".lower()
    found: list[str] = []
    for keys, trade_ids in TRADE_RULES:
        if any(k.lower() in hay for k in keys):
            for tid in trade_ids:
                if tid not in found:
                    found.append(tid)
    return found or ["g-coord"]


def read_csv_rows(path: Path) -> list[dict]:
    rows = []
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            name = (r.get("공정명") or "").strip()
            if not name:
                continue
            rows.append(
                {
                    "name": name,
                    "description": (r.get("공정 설명") or "").strip(),
                    "predecessors": parse_link_names(r.get("선행 작업") or ""),
                    "successors": parse_link_names(r.get("후속 작업") or ""),
                    "bimCode": (r.get("BIM 코드값") or "").strip(),
                    "specRef": (r.get("시방서") or "").strip(),
                }
            )
    return rows


def build_hierarchy(csv_rows: list[dict]) -> list[dict]:
    processes: list[dict] = []
    order = 0
    i = 0
    while i < len(csv_rows):
        row = csv_rows[i]
        name = row["name"]
        is_group = name.endswith("공사")
        has_children = (
            is_group
            and i + 1 < len(csv_rows)
            and not csv_rows[i + 1]["name"].endswith("공사")
        )

        if is_group and has_children:
            parent_id = f"proc-{slugify(name)}"
            processes.append(_proc(parent_id, None, "group", order, row))
            order += 1
            i += 1
            while i < len(csv_rows) and not csv_rows[i]["name"].endswith("공사"):
                child = csv_rows[i]
                cid = f"proc-{slugify(child['name'])}"
                processes.append(_proc(cid, parent_id, "task", order, child))
                order += 1
                i += 1
        else:
            pid = f"proc-{slugify(name)}"
            level = "group" if is_group else "task"
            processes.append(_proc(pid, None, level, order, row))
            order += 1
            i += 1

    _resolve_links(processes)
    return processes


def _proc(pid: str, parent_id: str | None, level: str, order: int, row: dict) -> dict:
    code = re.sub(r"[^A-Z0-9가-힣]", "_", row["name"].upper())[:32] or pid
    return {
        "id": pid,
        "code": code,
        "name": row["name"],
        "description": row["description"],
        "level": level,
        "parentId": parent_id,
        "order": order,
        "predecessorNames": row["predecessors"],
        "successorNames": row["successors"],
        "predecessorIds": [],
        "successorIds": [],
        "bimCode": row["bimCode"],
        "specRef": row["specRef"],
        "tradeIds": guess_trade_ids(row["name"], row["description"]),
    }


def _resolve_links(processes: list[dict]) -> None:
    by_name: dict[str, str] = {}
    for p in processes:
        by_name[p["name"]] = p["id"]

    for p in processes:
        p["predecessorIds"] = [_id for n in p.pop("predecessorNames", []) if (_id := by_name.get(n))]
        p["successorIds"] = [_id for n in p.pop("successorNames", []) if (_id := by_name.get(n))]


def main() -> int:
    csv_path = find_csv()
    rows = read_csv_rows(csv_path)
    processes = build_hierarchy(rows)

    meta = {
        "schemaVersion": 1,
        "source": csv_path.name,
        "updatedAt": date.today().isoformat(),
        "processes": processes,
    }

    out_json = WEB / "process-database.json"
    out_json.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    js = WEB / "process-database-data.js"
    js.write_text(
        "/** Auto-generated from docs 공정 DB csv */\n"
        f"window.PROCESS_DATABASE_DEFAULT = {json.dumps(meta, ensure_ascii=False)};\n",
        encoding="utf-8",
    )

    groups = sum(1 for p in processes if p["level"] == "group")
    tasks = len(processes) - groups
    print(f"Imported {len(processes)} processes ({groups} groups, {tasks} tasks) from {csv_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
