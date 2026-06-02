/** V/G 재지정(선·면) 공통 필드 — vg-checklist · Preset export */

window.VG_GRAPHIC = {
  sections: [
    { key: "projection", label: "보기 (Projection)", line: true, fill: true },
    { key: "cut", label: "절단 (Cut)", line: true, fill: true },
    { key: "surface", label: "면 (Surface)", line: false, fill: true },
  ],
  fields: [
    { key: "lineColor", label: "선 색", type: "text", placeholder: "#RRGGBB", line: true },
    { key: "lineWeight", label: "선 두께", type: "number", min: 1, max: 16, line: true },
    { key: "linePattern", label: "선 패턴", type: "text", placeholder: "문서 패턴 이름", line: true },
    { key: "fillColor", label: "면 색", type: "text", placeholder: "#RRGGBB", fill: true },
    { key: "fillPattern", label: "면 패턴", type: "text", placeholder: "예: Solid fill", fill: true },
    { key: "transparency", label: "투명도 %", type: "number", min: 0, max: 100, fill: true },
  ],
};

window.VgGraphics = {
  isEmptyStyle(style) {
    if (!style) return true;
    return window.VG_GRAPHIC.fields.every((f) => {
      const v = style[f.key];
      return v === undefined || v === null || v === "";
    });
  },

  hasOverride(spec) {
    if (!spec) return false;
    if (spec.hidden !== undefined || spec.halftone !== undefined) return true;
    return ["projection", "cut", "surface"].some(
      (k) => !window.VgGraphics.isEmptyStyle(spec[k])
    );
  },

  readStyleFromPanel(panel) {
    if (!panel) return null;
    const style = {};
    let any = false;
    for (const f of window.VG_GRAPHIC.fields) {
      const input = panel.querySelector(`[data-field="${f.key}"]`);
      if (!input) continue;
      const v = input.value.trim();
      if (v === "") continue;
      if (f.type === "number") {
        const n = Number(v);
        if (!Number.isNaN(n)) {
          style[f.key] = n;
          any = true;
        }
      } else {
        style[f.key] = v;
        any = true;
      }
    }
    return any ? style : null;
  },

  buildDetailRowHtml(cat, spec, colspan) {
    const colSpan = colspan ?? 6;
    const sections = window.VG_GRAPHIC.sections
      .map((sec) => {
        const data = spec?.[sec.key] ?? {};
        const fields = window.VG_GRAPHIC.fields
          .filter((f) => (f.line && sec.line) || (f.fill && sec.fill))
          .map((f) => {
            const val = data[f.key] ?? "";
            const attrs =
              f.type === "number"
                ? `type="number" min="${f.min}" max="${f.max}"`
                : `type="text" placeholder="${f.placeholder || ""}"`;
            return `<label class="gfx-field">
              <span>${f.label}</span>
              <input data-section="${sec.key}" data-field="${f.key}" ${attrs} value="${val}" />
            </label>`;
          })
          .join("");
        return `<div class="gfx-section" data-section="${sec.key}">
          <div class="gfx-section-title">${sec.label}</div>
          <div class="gfx-fields">${fields}</div>
        </div>`;
      })
      .join("");

    return `<td colspan="${colSpan}"><div class="gfx-panel">${sections}</div></td>`;
  },

  /** checklist 셀 -> Preset categoryOverride */
  cellToPresetOverride(builtInCategory, cell) {
    if (!builtInCategory || builtInCategory === "_") return null;
    const entry = { builtInCategory };
    let has = false;
    if (cell.on === "OFF") {
      entry.hidden = true;
      has = true;
    } else if (cell.on === "ON") {
      entry.hidden = false;
      has = true;
    }
    if (cell.halftone === "Y") {
      entry.halftone = true;
      has = true;
    } else if (cell.halftone === "N") {
      entry.halftone = false;
      has = true;
    }
    const t = cell.transp !== "-" && cell.transp !== "" ? parseInt(cell.transp, 10) : NaN;
    if (!isNaN(t)) {
      entry.surface = { ...(cell.surface || {}), transparency: t };
      has = true;
    }
    for (const k of ["projection", "cut", "surface"]) {
      if (cell[k] && !window.VgGraphics.isEmptyStyle(cell[k])) {
        if (k === "surface" && entry.surface) {
          entry.surface = { ...cell.surface, ...entry.surface };
        } else {
          entry[k] = { ...cell[k] };
        }
        has = true;
      }
    }
    if (!has && !window.VgGraphics.hasOverride(entry)) return null;
    return entry;
  },

  presetOverrideToCell(spec) {
    const cell = { on: "OFF", halftone: "-", transp: "-" };
    if (!spec) return cell;
    if (spec.hidden === true) cell.on = "OFF";
    else if (spec.hidden === false) cell.on = "ON";
    if (spec.halftone === true) cell.halftone = "Y";
    else if (spec.halftone === false) cell.halftone = "N";
    const tr = spec.surface?.transparency;
    if (tr != null && tr !== "") cell.transp = String(tr);
    for (const k of ["projection", "cut", "surface"]) {
      if (spec[k] && !window.VgGraphics.isEmptyStyle(spec[k])) cell[k] = { ...spec[k] };
    }
    return cell;
  },

  hasCellOverride(cell) {
    if (!cell) return false;
    if (cell.on === "ON") return true;
    if (cell.halftone === "Y" || cell.halftone === "N") return true;
    if (cell.transp !== "-" && cell.transp !== "" && cell.transp != null) return true;
    return ["projection", "cut", "surface"].some((k) => !window.VgGraphics.isEmptyStyle(cell[k]));
  },

  formatSummary(spec) {
    if (!spec) return "—";
    const parts = [];
    if (spec.hidden !== undefined) parts.push(spec.hidden ? "숨김" : "표시");
    if (spec.halftone) parts.push("HT");

    const fmt = (label, s) => {
      if (window.VgGraphics.isEmptyStyle(s)) return;
      const bits = [];
      if (s.lineColor) bits.push(`선${s.lineColor}`);
      if (s.lineWeight) bits.push(`w${s.lineWeight}`);
      if (s.linePattern) bits.push(s.linePattern);
      if (s.fillColor) bits.push(`면${s.fillColor}`);
      if (s.fillPattern) bits.push(s.fillPattern);
      if (s.transparency != null) bits.push(`T${s.transparency}`);
      if (bits.length) parts.push(`${label}:${bits.join("/")}`);
    };
    fmt("P", spec.projection);
    fmt("C", spec.cut);
    fmt("S", spec.surface);
    return parts.length ? parts.join(" · ") : "—";
  },
};
