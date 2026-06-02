#!/usr/bin/env python3
"""vg-checklist v2 (baseTemplates) -> v3 (viewTemplateId from template-library)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "Web"

# v2 bt-id -> default vt-id (template-library 예시)
BT_TO_VT = {
    "bt-arch": "vt-base-area-floor",
    "bt-str": "vt-base-area-floor",
    "bt-mep": "vt-base-coord-floor",
    "bt-coord": "vt-base-coord-floor",
}


def cell_v3_from_v2(c: dict) -> dict:
    out = {
        "on": c.get("on", "OFF"),
        "halftone": c.get("halftone", "-"),
        "transp": c.get("transp", "-"),
    }
    for k in ("projection", "cut", "surface"):
        if c.get(k):
            out[k] = c[k]
    return out


def main() -> int:
    cl = json.loads((WEB / "vg-checklist.json").read_text(encoding="utf-8"))
    lib = json.loads((WEB / "template-library.json").read_text(encoding="utf-8"))
    vt_ids = [n["id"] for n in lib.get("nodes", [])]

    vg_v3 = {}
    old_vg = cl.get("vg", {})

    for bt_id, vt_id in BT_TO_VT.items():
        if vt_id not in vt_ids:
            continue
        src = old_vg.get(bt_id, {})
        if vt_id not in vg_v3:
            vg_v3[vt_id] = {}
        for row_id, cell in src.items():
            vg_v3[vt_id][row_id] = cell_v3_from_v2(cell)

    for n in lib.get("nodes", []):
        vid = n["id"]
        if vid not in vg_v3:
            vg_v3[vid] = {}
        bt = n.get("vgBaseTemplateId")
        if bt and bt in old_vg:
            for row_id, cell in old_vg[bt].items():
                if row_id not in vg_v3[vid]:
                    vg_v3[vid][row_id] = cell_v3_from_v2(cell)

    meta = {
        "schemaVersion": 3,
        "version": cl.get("version", ""),
        "source": cl.get("source", ""),
        "updatedAt": cl.get("updatedAt", ""),
        "rows": cl.get("rows", []),
        "vg": vg_v3,
    }

    out = WEB / "vg-checklist.json"
    out.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    js = WEB / "vg-checklist-data.js"
    js.write_text(
        "/** vg-checklist.json v3 */\n"
        f"window.VG_CHECKLIST_DEFAULT = {json.dumps(meta, ensure_ascii=False)};\n",
        encoding="utf-8",
    )
    print(f"v3: {len(meta['rows'])} rows, vg keys: {list(vg_v3.keys())}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
