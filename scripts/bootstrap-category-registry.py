#!/usr/bin/env python3
"""vg-checklist + categories.json -> Web/category-registry.json + data.js"""
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "Web"

DEFAULT_TRADES = [
    {"id": "g-arch", "code": "ARCH", "name": "건축", "order": 0},
    {"id": "g-str", "code": "STR", "name": "구조", "order": 1},
    {"id": "g-mech", "code": "MECH", "name": "기계", "order": 2},
    {"id": "g-elec", "code": "ELEC", "name": "전기", "order": 3},
    {"id": "g-plum", "code": "PLUM", "name": "급배수", "order": 4},
    {"id": "g-fire", "code": "FP", "name": "소방", "order": 5},
    {"id": "g-comm", "code": "COMM", "name": "통신/보안", "order": 6},
    {"id": "g-land", "code": "LAND", "name": "조경/토목", "order": 7},
    {"id": "g-int", "code": "INT", "name": "인테리어", "order": 8},
    {"id": "g-coord", "code": "COORD", "name": "BIM/코디", "order": 9},
]

DEFAULT_MATERIAL_TYPES = [
    {"id": "m-conc", "code": "CONC", "name": "콘크리트", "order": 0},
    {"id": "m-steel", "code": "STEEL", "name": "철골/철근", "order": 1},
    {"id": "m-masonry", "code": "MASN", "name": "조적/석재", "order": 2},
    {"id": "m-glass", "code": "GLAZ", "name": "유리/커튼월", "order": 3},
    {"id": "m-metal", "code": "METL", "name": "금속", "order": 4},
    {"id": "m-wood", "code": "WOOD", "name": "목재", "order": 5},
    {"id": "m-finish", "code": "FNSH", "name": "마감", "order": 6},
    {"id": "m-insul", "code": "INSL", "name": "단열/방수", "order": 7},
    {"id": "m-duct", "code": "DUCT", "name": "MEP 덕트", "order": 8},
    {"id": "m-pipe", "code": "PIPE", "name": "MEP 배관", "order": 9},
    {"id": "m-elec-mep", "code": "ELEC-MEP", "name": "MEP 전기", "order": 10},
    {"id": "m-site", "code": "SITE", "name": "토목/조경", "order": 11},
    {"id": "m-other", "code": "ETC", "name": "기타", "order": 12},
]

def load_ui_to_builtin() -> dict[str, str]:
    path = WEB / "ui-to-builtin.json"
    if path.is_file():
        return json.loads(path.read_text(encoding="utf-8")).get("mappings", {})
    return {}


UI_TO_BUILTIN = {
    "Walls": "Walls",
    "Floors": "Floors",
    "Roofs": "Roofs",
    "Ceilings": "Ceilings",
    "Columns": "Columns",
    "Curtain Walls": "CurtainWallPanels",
    "Curtain Panels": "CurtainWallPanels",
    "Curtain Wall Mullions": "CurtainWallMullions",
    "Doors": "Doors",
    "Windows": "Windows",
    "Stairs": "Stairs",
    "Railings": "Railings",
    "Ramps": "Ramps",
    "Rooms": "Rooms",
    "Areas": "Areas",
    "Spaces": "Spaces",
    "Structural Columns": "StructuralColumns",
    "Structural Framing": "StructuralFraming",
    "Structural Foundations": "StructuralFoundation",
    "Ducts": "Ducts",
    "Pipes": "Pipes",
    "Cable Trays": "CableTray",
    "Conduits": "Conduit",
    "Generic Models": "GenericModel",
    "Shaft Openings": "ShaftOpenings",
    "RVT Links": "RvtLinks",
    "Point Clouds": "PointClouds",
}


def slugify(text: str) -> str:
    s = re.sub(r"[^\w\s-]", "", (text or "").strip().lower())
    s = re.sub(r"[\s_]+", "-", s).strip("-")
    return s or "cat"


def guess_trades(group: str) -> list[str]:
    g = (group or "").lower()
    if "architecture" in g:
        return ["g-arch"]
    if g == "structure":
        return ["g-str"]
    if "mechanical" in g:
        return ["g-mech"]
    if "plumbing" in g:
        return ["g-plum"]
    if "electrical" in g:
        return ["g-elec"]
    if g == "spatial":
        return ["g-arch", "g-mech"]
    if "infrastructure" in g:
        return ["g-str", "g-land"]
    if g == "links":
        return ["g-coord"]
    if g == "general":
        return ["g-arch", "g-coord"]
    return []


def guess_material(revit_ui: str, group: str) -> list[str]:
    u = (revit_ui or "").lower()
    g = (group or "").lower()
    if "duct" in u or "air terminal" in u:
        return ["m-duct"]
    if "pipe" in u or "plumb" in u or "sprinkler" in u:
        return ["m-pipe"]
    if any(x in u for x in ("electrical", "cable", "conduit", "lighting", "wire")):
        return ["m-elec-mep"]
    if "structural" in u or g == "structure":
        return ["m-steel"]
    if u in ("walls", "floors", "roofs", "ceilings", "columns"):
        return ["m-conc", "m-masonry"]
    if "curtain" in u or "window" in u:
        return ["m-glass"]
    if "planting" in u or "site" in u or "road" in u or "toposolid" in u:
        return ["m-site"]
    return []


def main() -> int:
    checklist = json.loads((WEB / "vg-checklist.json").read_text(encoding="utf-8"))
    catalog = json.loads((WEB / "categories.json").read_text(encoding="utf-8"))
    ui_map = {**UI_TO_BUILTIN, **load_ui_to_builtin()}

    by_id: dict[str, dict] = {}
    for row in checklist.get("rows", []):
        ui = row.get("revitCategory", "")
        bid = ui_map.get(ui, "")
        by_id[row["id"]] = {
            "id": row["id"],
            "revitCategoryUi": ui,
            "builtInCategory": bid,
            "revitGroup": row.get("group", ""),
            "ifcClass": row.get("ifcClass", ""),
            "noteKr": row.get("noteKr", ""),
            "tradeIds": guess_trades(row.get("group", "")),
            "materialTypeIds": guess_material(ui, row.get("group", "")),
            "active": True,
        }

    used_ui = {c["revitCategoryUi"] for c in by_id.values()}
    for grp in catalog.get("groups", []):
        for api in grp.get("categories", []):
            if api in used_ui:
                continue
            rid = slugify(api)
            n = 2
            while rid in by_id:
                rid = f"{slugify(api)}-{n}"
                n += 1
            by_id[rid] = {
                "id": rid,
                "revitCategoryUi": api,
                "builtInCategory": api,
                "revitGroup": grp.get("name", ""),
                "ifcClass": "",
                "noteKr": "",
                "tradeIds": [],
                "materialTypeIds": [],
                "active": True,
            }

    meta = {
        "schemaVersion": 1,
        "updatedAt": date.today().isoformat(),
        "trades": DEFAULT_TRADES,
        "materialTypes": DEFAULT_MATERIAL_TYPES,
        "categories": sorted(by_id.values(), key=lambda c: (c["revitGroup"], c["revitCategoryUi"])),
    }

    json_path = WEB / "category-registry.json"
    js_path = WEB / "category-registry-data.js"
    json_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    js_path.write_text(
        "/** category-registry.json 과 동기화 — file:// 에서도 동작 */\n"
        f"window.CATEGORY_REGISTRY_DEFAULT = {json.dumps(meta, ensure_ascii=False)};\n",
        encoding="utf-8",
    )
    print(f"{len(meta['categories'])} categories -> {json_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
