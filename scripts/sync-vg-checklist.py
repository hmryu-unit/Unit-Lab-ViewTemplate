#!/usr/bin/env python3
"""CSV → Web/vg-checklist.json (v2: catalog + baseTemplates + vg) + vg-checklist-data.js"""
import csv
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "Web"
DEFAULT_CSV = Path.home() / "Downloads" / "Revit_VG_Checklist_IFC_v2_Revit2026.csv"

LEGACY_HEADERS = [
    "Group",
    "Revit Category",
    "IFC Class",
    "중요(Y/N)",
    "ARCH (ON/OFF)",
    "ARCH Halftone",
    "ARCH Transp(%)",
    "STR (ON/OFF)",
    "STR Halftone",
    "STR Transp(%)",
    "MEP (ON/OFF)",
    "MEP Halftone",
    "MEP Transp(%)",
    "COORD (ON/OFF)",
    "COORD Halftone",
    "COORD Transp(%)",
    "Note (KR)",
]

LEGACY_KEYS = [
    "group",
    "revitCategory",
    "ifcClass",
    "important",
    "archOn",
    "archHalftone",
    "archTransp",
    "strOn",
    "strHalftone",
    "strTransp",
    "mepOn",
    "mepHalftone",
    "mepTransp",
    "coordOn",
    "coordHalftone",
    "coordTransp",
    "noteKr",
]

DEFAULT_BASE_TEMPLATES = [
    {"id": "bt-arch", "name": "ARCH", "slug": "arch", "color": "arch", "order": 0, "fieldPrefix": "arch"},
    {"id": "bt-str", "name": "STR", "slug": "str", "color": "str", "order": 1, "fieldPrefix": "str"},
    {"id": "bt-mep", "name": "MEP", "slug": "mep", "color": "mep", "order": 2, "fieldPrefix": "mep"},
    {"id": "bt-coord", "name": "COORD", "slug": "coord", "color": "coord", "order": 3, "fieldPrefix": "coord"},
]


def slugify(text: str) -> str:
    s = re.sub(r"[^\w\s-]", "", (text or "").strip().lower())
    s = re.sub(r"[\s_]+", "-", s).strip("-")
    return s or "row"


def unique_row_id(revit_category: str, used: set[str]) -> str:
    base = slugify(revit_category)
    rid = base
    n = 2
    while rid in used:
        rid = f"{base}-{n}"
        n += 1
    used.add(rid)
    return rid


def legacy_rows_to_v2(rows: list[dict]) -> dict:
    used: set[str] = set()
    catalog = []
    vg: dict[str, dict[str, dict]] = {bt["id"]: {} for bt in DEFAULT_BASE_TEMPLATES}

    for row in rows:
        rid = unique_row_id(row.get("revitCategory", ""), used)
        catalog.append(
            {
                "id": rid,
                "group": row.get("group", ""),
                "revitCategory": row.get("revitCategory", ""),
                "ifcClass": row.get("ifcClass", ""),
                "important": row.get("important", "N"),
                "noteKr": row.get("noteKr", ""),
            }
        )
        for bt in DEFAULT_BASE_TEMPLATES:
            p = bt["fieldPrefix"]
            vg[bt["id"]][rid] = {
                "on": row.get(f"{p}On", "OFF") or "OFF",
                "halftone": row.get(f"{p}Halftone", "-") or "-",
                "transp": row.get(f"{p}Transp", "-") or "-",
            }

    templates = [{k: bt[k] for k in ("id", "name", "slug", "color", "order")} for bt in DEFAULT_BASE_TEMPLATES]
    return {"rows": catalog, "baseTemplates": templates, "vg": vg}


def read_legacy_csv(csv_path: Path) -> list[dict]:
    rows = []
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            rows.append({k: r[h] for k, h in zip(LEGACY_KEYS, LEGACY_HEADERS)})
    return rows


def main() -> int:
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CSV
    if not csv_path.is_file():
        print(f"CSV not found: {csv_path}", file=sys.stderr)
        return 1

    legacy_rows = read_legacy_csv(csv_path)
    body = legacy_rows_to_v2(legacy_rows)
    meta = {
        "schemaVersion": 2,
        "version": csv_path.stem,
        "source": csv_path.name,
        "updatedAt": date.today().isoformat(),
        **body,
    }

    json_path = WEB / "vg-checklist.json"
    js_path = WEB / "vg-checklist-data.js"
    json_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    js_path.write_text(
        "/** vg-checklist.json 과 동기화 — file:// 에서도 동작 */\n"
        f"window.VG_CHECKLIST_DEFAULT = {json.dumps(meta, ensure_ascii=False)};\n",
        encoding="utf-8",
    )
    print(
        f"{len(body['rows'])} rows, {len(body['baseTemplates'])} base templates "
        f"-> {json_path.name}, {js_path.name}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
