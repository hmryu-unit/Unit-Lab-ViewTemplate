#!/usr/bin/env python3
"""category-registry.json 의 빈 builtInCategory 를 ui-to-builtin.json 으로 채움."""
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "Web"


def pascalize(ui: str) -> str:
    parts = re.split(r"[\s/]+", (ui or "").strip())
    return "".join(p[:1].upper() + p[1:] for p in parts if p)


def main() -> int:
    registry_path = WEB / "category-registry.json"
    map_path = WEB / "ui-to-builtin.json"
    catalog_path = WEB / "categories.json"

    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    ui_map = json.loads(map_path.read_text(encoding="utf-8"))["mappings"]
    api_names = set()
    for g in json.loads(catalog_path.read_text(encoding="utf-8")).get("groups", []):
        api_names.update(g.get("categories", []))

    filled = 0
    still_empty = []
    for cat in registry["categories"]:
        if (cat.get("builtInCategory") or "").strip():
            continue
        ui = (cat.get("revitCategoryUi") or "").strip()
        bid = ui_map.get(ui, "")
        if not bid:
            guess = pascalize(ui)
            if guess in api_names:
                bid = guess
            elif ui.replace(" ", "") in api_names:
                bid = ui.replace(" ", "")
        if bid:
            cat["builtInCategory"] = bid
            filled += 1
        else:
            still_empty.append(ui)

    registry["updatedAt"] = date.today().isoformat()
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    js_path = WEB / "category-registry-data.js"
    js_path.write_text(
        "/** category-registry.json 과 동기화 */\n"
        f"window.CATEGORY_REGISTRY_DEFAULT = {json.dumps(registry, ensure_ascii=False)};\n",
        encoding="utf-8",
    )
    print(f"filled {filled}, still empty {len(still_empty)}")
    for u in still_empty:
        print(f"  - {u}")
    return 0 if not still_empty else 1


if __name__ == "__main__":
    raise SystemExit(main())
