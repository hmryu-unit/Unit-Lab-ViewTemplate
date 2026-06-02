import csv
import re
from collections import defaultdict

path = r"c:\Users\hmryu\Downloads\ade52842-0e3f-4532-85bb-624d2216e4cf_ExportBlock-7e02098f-5a18-4033-9464-9c8cf3ca8fd6\ExportBlock-7e02098f-5a18-4033-9464-9c8cf3ca8fd6-Part-1\도면 체계 35957166998880c1aab6f474584538b5.csv"

rows = []
with open(path, encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        rows.append(r)


def parse_templates(cell):
    if not cell or not cell.strip():
        return []
    parts = re.split(r",\s*", cell)
    out = []
    for p in parts:
        m = re.match(r"^([^(]+)", p.strip())
        if m:
            out.append(m.group(1).strip())
    return out


def propose_base(template_name: str) -> str:
    if template_name == "Scheme Plan" or template_name.startswith("Scheme Plan_"):
        return "Base_SchemePlan"
    if template_name.startswith("Mechanical Plan"):
        return "Base_MechanicalPlan"
    if template_name.startswith("Structural Plan"):
        return "Base_StructuralPlan"
    if template_name.startswith("Foundation Plan"):
        return "Base_FoundationPlan"
    if template_name == "Architectural Plan":
        return "Base_ArchPlan"
    if template_name == "Architectural Elevation":
        return "Base_ArchElevation"
    if template_name == "Architectural Section":
        return "Base_ArchSection"
    if template_name == "Architectural Reflected Ceiling Plan":
        return "Base_ArchRCP"
    if template_name == "Site Plan":
        return "Base_SitePlan"
    if template_name == "Structural Elevation":
        return "Base_StructuralElevation"
    return "Base_" + template_name.replace(" ", "")


by_tpl = defaultdict(list)
no_tpl = []
for r in rows:
    tpls = parse_templates(r.get("뷰템플릿(해안 기준)", "") or "")
    entry = {
        "section": r["구분"],
        "name": r["이름"],
        "owned": r["보유 여부"],
    }
    if not tpls:
        no_tpl.append(entry)
    for t in tpls:
        by_tpl[t].append(entry)

by_base = defaultdict(lambda: {"templates": set(), "drawings": []})
for tpl, drawings in by_tpl.items():
    b = propose_base(tpl)
    by_base[b]["templates"].add(tpl)
    for d in drawings:
        by_base[b]["drawings"].append({**d, "template": tpl})

print("TEMPLATES", len(by_tpl))
for t in sorted(by_tpl):
    names = [x["name"] for x in by_tpl[t]]
    print(f"  {t} ({len(names)}): {names}")

print("\nPROPOSED_BASES", len(by_base))
for b in sorted(by_base):
    print(f"  {b}: templates={sorted(by_base[b]['templates'])}")

print("\nNO_TEMPLATE", len(no_tpl))
for e in no_tpl:
    print(f"  [{e['section']}] {e['name']} owned={e['owned']}")
