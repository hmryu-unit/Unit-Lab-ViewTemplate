# Preset export: ancestor-merged V/G, changed cells only

View Template Preset JSON (`categoryOverrides`) is built by walking the VT ancestor chain (root → … → current node), merging only layers that have an explicit V/G edit, then emitting overrides for rows where the **effective** cell is non-default. All export and preview paths share this logic. Raw `vg[vtId]` in `vg-checklist.json` stays per-VT; merge runs at export time only.

**Why:** Revit creates templates from a seed view and applies only what is in the Preset—delta-only export without merge left child templates missing parent V/G. Default-filled child cells must not overwrite parent edits during merge.

**Later:** `categoryOverridesDelta` for diff visibility (grill #3C); Revit “update from preset” command (grill #5C, #7).

**Status:** accepted
