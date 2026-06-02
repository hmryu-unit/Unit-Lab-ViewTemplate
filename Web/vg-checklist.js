/**
 * V/G 체크리스트 v3: 카탈로그 + 도면 템플릿(①)별 ON·HT·%·재지정
 */
(function () {
  const STORAGE_KEY = "unitlab-vg-checklist-v3";
  const STORAGE_KEY_V2 = "unitlab-vg-checklist-v2";

  const BT_TO_VT = {
    "bt-arch": "vt-base-area-floor",
    "bt-str": "vt-base-area-floor",
    "bt-mep": "vt-base-coord-floor",
    "bt-coord": "vt-base-coord-floor",
  };

  /** @type {{ schemaVersion: number, version: string, source: string, updatedAt: string, rows: object[], vg: Record<string, Record<string, object>> }} */
  let state = emptyState();
  let dirty = false;
  let activeVtId = null;
  let onlyChanged = false;

  const COLSPAN_GFX = 8;

  const els = {
    panel: document.getElementById("panel-checklist"),
    vtSelect: document.getElementById("clVtSelect"),
    search: document.getElementById("clSearch"),
    groupFilter: document.getElementById("clGroupFilter"),
    importantOnly: document.getElementById("clImportantOnly"),
    onlyChanged: document.getElementById("clOnlyChanged"),
    status: document.getElementById("clStatus"),
    tbody: document.getElementById("clBody"),
    btnSave: document.getElementById("clBtnSave"),
    btnReset: document.getElementById("clBtnReset"),
    btnAddRow: document.getElementById("clBtnAdd"),
    btnSyncVt: document.getElementById("clBtnSyncVt"),
    btnExportPreset: document.getElementById("clBtnExportPreset"),
    btnExportCsv: document.getElementById("clBtnExportCsv"),
    btnExportJson: document.getElementById("clBtnExportJson"),
    csvInput: document.getElementById("clCsvInput"),
  };

  if (!els.panel) return;

  function emptyState() {
    return {
      schemaVersion: 3,
      version: "",
      source: "",
      updatedAt: "",
      rows: [],
      vg: {},
    };
  }

  function defaultCell() {
    return { on: "OFF", halftone: "-", transp: "-" };
  }

  function slugify(text) {
    return String(text ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "row";
  }

  function getWorkflowNodes() {
    return window.TemplateWorkflow?.getNodes?.() ?? window.TEMPLATE_LIBRARY_DEFAULT?.nodes ?? [];
  }

  function uniqueRowId(revitCategory) {
    const used = new Set(state.rows.map((r) => r.id));
    if (!String(revitCategory ?? "").trim()) {
      let rid = "new-row";
      let n = 2;
      while (used.has(rid)) {
        rid = `new-row-${n}`;
        n++;
      }
      return rid;
    }
    let base = slugify(revitCategory);
    let rid = base;
    let n = 2;
    while (used.has(rid)) {
      rid = `${base}-${n}`;
      n++;
    }
    return rid;
  }

  function getCell(vtId, rowId) {
    if (!vtId) return { ...defaultCell() };
    if (!state.vg[vtId]) state.vg[vtId] = {};
    if (!state.vg[vtId][rowId]) state.vg[vtId][rowId] = { ...defaultCell() };
    return state.vg[vtId][rowId];
  }

  function setCell(vtId, rowId, patch) {
    const c = getCell(vtId, rowId);
    Object.assign(c, patch);
    if (patch.explicit !== false) c.explicit = true;
    markDirty();
  }

  function layerContributesToMerge(raw) {
    return raw.explicit === true || window.VgGraphics.hasCellOverride(raw);
  }

  /** default와 다른 필드만 조상 병합에 반영 */
  function explicitPatchFromCell(cell) {
    const d = defaultCell();
    const patch = {};
    if (cell.on !== d.on) patch.on = cell.on;
    if (cell.halftone !== d.halftone) patch.halftone = cell.halftone;
    if (cell.transp !== d.transp) patch.transp = cell.transp;
    for (const k of ["projection", "cut", "surface"]) {
      if (cell[k] && !window.VgGraphics.isEmptyStyle(cell[k])) patch[k] = { ...cell[k] };
    }
    if (cell.explicit === true && cell.on === d.on && !patch.halftone && !patch.transp && !patch.projection && !patch.cut && !patch.surface) {
      patch.on = cell.on;
    }
    return patch;
  }

  function cloneCell(cell) {
    const c = { on: cell.on, halftone: cell.halftone, transp: cell.transp };
    for (const k of ["projection", "cut", "surface"]) {
      if (cell[k]) c[k] = { ...cell[k] };
    }
    return c;
  }

  /** 조상 → 자식 순 병합 (overlay는 명시 변경 레이어만) */
  function mergeCells(base, overlay) {
    const out = cloneCell(base);
    if (overlay.on !== undefined) out.on = overlay.on;
    if (overlay.halftone !== undefined) out.halftone = overlay.halftone;
    if (overlay.transp !== undefined) out.transp = overlay.transp;
    for (const k of ["projection", "cut", "surface"]) {
      if (!overlay[k]) continue;
      out[k] = { ...(out[k] || {}), ...overlay[k] };
      if (window.VgGraphics.isEmptyStyle(out[k])) delete out[k];
    }
    return out;
  }

  function getAncestorChain(vtId) {
    const byId = new Map(getWorkflowNodes().map((n) => [n.id, n]));
    const chain = [];
    let id = vtId;
    while (id) {
      const n = byId.get(id);
      if (!n) break;
      chain.unshift(id);
      id = n.parentId || null;
    }
    return chain;
  }

  /** 루트까지 체인 병합 effective V/G (export·표시용) */
  function getEffectiveCell(vtId, rowId) {
    let effective = { ...defaultCell() };
    for (const vid of getAncestorChain(vtId)) {
      const raw = getCell(vid, rowId);
      if (!layerContributesToMerge(raw)) continue;
      effective = mergeCells(effective, explicitPatchFromCell(raw));
    }
    return effective;
  }

  function ensureVgSlot(vtId) {
    if (!vtId) return;
    if (!state.vg[vtId]) state.vg[vtId] = {};
    for (const row of state.rows) {
      if (!state.vg[vtId][row.id]) state.vg[vtId][row.id] = { ...defaultCell() };
    }
  }

  function syncAllVtSlots() {
    for (const n of getWorkflowNodes()) ensureVgSlot(n.id);
  }

  function migrateV2ToV3(data) {
    const nodes = getWorkflowNodes();
    const vg = {};
    const oldVg = data.vg ?? {};
    const byNodeBt = new Map(nodes.map((n) => [n.id, n.vgBaseTemplateId]));

    for (const n of nodes) {
      vg[n.id] = {};
      const bt = byNodeBt.get(n.id);
      const srcBt = bt && oldVg[bt] ? bt : BT_TO_VT[bt];
      const src = (srcBt && oldVg[srcBt]) || oldVg[BT_TO_VT["bt-arch"]] || {};
      for (const [rowId, cell] of Object.entries(src)) {
        vg[n.id][rowId] = { ...defaultCell(), ...cell };
      }
    }

    for (const [btId, vtId] of Object.entries(BT_TO_VT)) {
      if (!oldVg[btId] || !nodes.some((n) => n.id === vtId)) continue;
      if (!vg[vtId]) vg[vtId] = {};
      for (const [rowId, cell] of Object.entries(oldVg[btId])) {
        if (!vg[vtId][rowId]) vg[vtId][rowId] = { ...defaultCell(), ...cell };
      }
    }

    return {
      schemaVersion: 3,
      version: data.version ?? "",
      source: data.source ?? "",
      updatedAt: data.updatedAt ?? "",
      rows: (data.rows ?? []).map((r) => ({ ...r })),
      vg,
    };
  }

  function normalizeIncoming(data) {
    if (!data) return null;
    if (data.schemaVersion === 3 && Array.isArray(data.rows)) {
      return {
        schemaVersion: 3,
        version: data.version ?? "",
        source: data.source ?? "",
        updatedAt: data.updatedAt ?? "",
        rows: data.rows.map((r) => ({ ...r })),
        vg: structuredClone(data.vg ?? {}),
      };
    }
    if (data.schemaVersion === 2 && Array.isArray(data.rows)) {
      return migrateV2ToV3(data);
    }
    return null;
  }

  function loadDefault() {
    return normalizeIncoming(window.VG_CHECKLIST_DEFAULT) ?? emptyState();
  }

  function loadStorage(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return normalizeIncoming(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  function saveStorage() {
    state.updatedAt = new Date().toISOString().slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    dirty = false;
    updateStatus();
  }

  function markDirty() {
    dirty = true;
    updateStatus();
  }

  function registryMap() {
    const reg = window.CategoryRegistry?.getState?.() ?? window.CATEGORY_REGISTRY_DEFAULT ?? null;
    const m = new Map();
    for (const c of reg?.categories ?? []) {
      if (c.id) m.set(c.id, c);
      if (c.checklistId) m.set(c.checklistId, c);
      m.set((c.revitCategoryUi || "").toLowerCase(), c);
    }
    return m;
  }

  function builtInForRow(row) {
    const reg = registryMap().get(row.id) || registryMap().get((row.revitCategory || "").toLowerCase());
    return reg?.builtInCategory?.trim() || "";
  }

  function updateStatus() {
    const vt = getWorkflowNodes().find((n) => n.id === activeVtId);
    const name = vt?.name ?? "(미선택)";
    const suffix = dirty ? " · 저장 안 됨" : "";
    els.status.textContent = `${state.rows.length}행 · 편집: ${name}${suffix}`;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function onOffOptions(val) {
    return ["ON", "OFF"].map((v) => `<option value="${v}" ${val === v ? "selected" : ""}>${v}</option>`).join("");
  }

  function halftoneOptions(val) {
    const v = val === "" || val == null ? "-" : val;
    return ["Y", "N", "-"].map((o) => `<option value="${o}" ${v === o ? "selected" : ""}>${o}</option>`).join("");
  }

  function transpOptions(val) {
    const v = val === "" || val == null ? "-" : String(val);
    const opts = ["-", "0", "25", "50", "75", "100"];
    const extra = opts.includes(v) ? "" : `<option value="${escapeAttr(v)}" selected>${escapeHtml(v)}</option>`;
    return extra + opts.map((o) => `<option value="${o}" ${v === o ? "selected" : ""}>${o}</option>`).join("");
  }

  function uniqueGroups() {
    return [...new Set(state.rows.map((r) => r.group).filter(Boolean))].sort();
  }

  function refreshGroupFilter() {
    const current = els.groupFilter.value;
    els.groupFilter.innerHTML =
      '<option value="">전체 그룹</option>' +
      uniqueGroups().map((g) => `<option value="${escapeAttr(g)}">${escapeHtml(g)}</option>`).join("");
    if ([...els.groupFilter.options].some((o) => o.value === current)) els.groupFilter.value = current;
  }

  function refreshVtSelect() {
    const nodes = getWorkflowNodes();
    const cur = activeVtId;
    els.vtSelect.innerHTML =
      '<option value="">— 도면 템플릿 선택 —</option>' +
      nodes
        .map((n) => {
          const role = n.role === "derived" ? " └ " : "";
          return `<option value="${escapeAttr(n.id)}">${role}${escapeHtml(n.name)}</option>`;
        })
        .join("");
    if (cur && nodes.some((n) => n.id === cur)) els.vtSelect.value = cur;
    else if (!cur && nodes.length) {
      const firstBase = nodes.find((n) => n.role === "base" || !n.parentId) || nodes[0];
      activeVtId = firstBase?.id ?? null;
      if (activeVtId) els.vtSelect.value = activeVtId;
    }
    updateStatus();
  }

  function rowMatchesFilter(row, search, group, importantOnly) {
    if (group && row.group !== group) return false;
    if (importantOnly && row.important !== "Y") return false;
    if (!search) return true;
    const hay = [row.group, row.revitCategory, row.ifcClass, row.noteKr, builtInForRow(row)]
      .join(" ")
      .toLowerCase();
    return hay.includes(search);
  }

  function cellChanged(cell) {
    return window.VgGraphics.hasCellOverride(cell);
  }

  function bindGfxRow(tr, detailRow, rowId) {
    const expandBtn = tr.querySelector(".btn-expand");
    expandBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      detailRow.classList.toggle("open");
      const open = detailRow.classList.contains("open");
      expandBtn.textContent = open ? "▾ 재지정" : "▸ 재지정";
    });

    tr.querySelectorAll("select.cl-vg-sel").forEach((sel) => {
      sel.addEventListener("change", () => {
        const field = sel.dataset.field;
        const base = getEffectiveCell(activeVtId, rowId);
        setCell(activeVtId, rowId, { ...cloneCell(base), [field]: sel.value, explicit: true });
        const after = getEffectiveCell(activeVtId, rowId);
        tr.classList.toggle("row-changed", cellChanged(after));
        const hasGfx =
          !window.VgGraphics.isEmptyStyle(after.projection) ||
          !window.VgGraphics.isEmptyStyle(after.cut) ||
          !window.VgGraphics.isEmptyStyle(after.surface);
        if (hasGfx) expandBtn.textContent = "▾ 재지정●";
      });
    });

    detailRow?.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", () => {
        const sec = inp.dataset.section;
        const field = inp.dataset.field;
        const cell = { ...cloneCell(getEffectiveCell(activeVtId, rowId)), explicit: true };
        if (!cell[sec]) cell[sec] = {};
        const v = inp.value.trim();
        if (v === "") delete cell[sec][field];
        else if (inp.type === "number") {
          const n = Number(v);
          if (!Number.isNaN(n)) cell[sec][field] = n;
        } else cell[sec][field] = v;
        if (window.VgGraphics.isEmptyStyle(cell[sec])) delete cell[sec];
        setCell(activeVtId, rowId, cell);
        tr.classList.add("row-changed");
        expandBtn.textContent = "▾ 재지정●";
        detailRow.classList.add("open");
      });
    });
  }

  function render() {
    refreshVtSelect();
    refreshGroupFilter();
    if (!activeVtId) {
      els.tbody.innerHTML =
        '<tr><td colspan="10" class="empty-hint">① 도면 템플릿에서 베이스/하위 VT를 만든 뒤, 위에서 편집할 템플릿을 선택하세요.</td></tr>';
      return;
    }
    ensureVgSlot(activeVtId);

    const search = (els.search.value || "").trim().toLowerCase();
    const group = els.groupFilter.value;
    const importantOnly = els.importantOnly?.checked;
    onlyChanged = els.onlyChanged?.checked ?? false;

    els.tbody.innerHTML = "";
    for (const row of state.rows) {
      if (!rowMatchesFilter(row, search, group, importantOnly)) continue;
      const cell = getEffectiveCell(activeVtId, row.id);
      if (onlyChanged && !cellChanged(cell)) continue;

      const bic = builtInForRow(row);
      const bicHint = bic
        ? `<code class="bic-ok">${escapeHtml(bic)}</code>`
        : `<span class="bic-miss" title="② 카테고리·공종에서 builtInCategory 지정">—</span>`;

      const hasGfx =
        !window.VgGraphics.isEmptyStyle(cell.projection) ||
        !window.VgGraphics.isEmptyStyle(cell.cut) ||
        !window.VgGraphics.isEmptyStyle(cell.surface);

      const tr = document.createElement("tr");
      tr.dataset.rowId = row.id;
      if (cellChanged(cell)) tr.classList.add("row-changed");
      if (row.important === "Y" && !bic) tr.classList.add("row-builtin-block");

      tr.innerHTML = `
        <td class="group-cell" title="더블클릭: 그룹명">${escapeHtml(row.group)}</td>
        <td>${escapeHtml(row.revitCategory)}</td>
        <td>${bicHint}</td>
        <td>${escapeHtml(row.ifcClass ?? "")}</td>
        <td class="imp-cell">${row.important === "Y" ? "Y" : ""}</td>
        <td><select class="cl-vg-sel" data-field="on">${onOffOptions(cell.on)}</select></td>
        <td><select class="cl-vg-sel" data-field="halftone">${halftoneOptions(cell.halftone)}</select></td>
        <td><select class="cl-vg-sel" data-field="transp">${transpOptions(cell.transp)}</select></td>
        <td><button type="button" class="btn-expand">${hasGfx ? "▾ 재지정●" : "▸ 재지정"}</button></td>
        <td class="gfx-sum">${escapeHtml(window.VgGraphics.formatSummary(window.VgGraphics.cellToPresetOverride(bic || "_", cell) || {}))}</td>
      `;

      const detail = document.createElement("tr");
      detail.className = "detail-row" + (hasGfx ? " open" : "");
      detail.dataset.for = row.id;
      const gfxSpec = {
        projection: cell.projection,
        cut: cell.cut,
        surface: cell.surface,
      };
      detail.innerHTML = window.VgGraphics.buildDetailRowHtml(row.id, gfxSpec, COLSPAN_GFX);

      bindGfxRow(tr, detail, row.id);
      els.tbody.appendChild(tr);
      els.tbody.appendChild(detail);
    }
    updateStatus();
  }

  function buildOverridesForViewTemplate(vtId) {
    const overrides = [];
    const warnings = [];
    const errors = [];

    for (const row of state.rows) {
      const bic = builtInForRow(row);
      const important = row.important === "Y";
      const effective = getEffectiveCell(vtId, row.id);
      const wouldExport = window.VgGraphics.hasCellOverride(effective);

      if (!bic) {
        if (important) {
          errors.push(`[중요] builtInCategory 없음: ${row.revitCategory}`);
        } else if (wouldExport) {
          warnings.push(`builtInCategory 없음 (스킵): ${row.revitCategory}`);
        }
        continue;
      }

      if (!wouldExport) continue;
      const o = window.VgGraphics.cellToPresetOverride(bic, effective);
      if (o) overrides.push(o);
    }

    return { overrides, warnings, errors, blocked: errors.length > 0 };
  }

  function buildPresetForNode(node) {
    const { overrides, warnings, errors, blocked } = buildOverridesForViewTemplate(node.id);
    return {
      preset: {
        templateName: node.revitTemplateName || node.name,
        viewType: node.viewType || "FloorPlan",
        properties: node.properties ?? {},
        categoryOverrides: overrides,
      },
      warnings,
      errors,
      blocked,
    };
  }

  function formatPresetBlockMessage(result) {
    const lines = result.errors ?? [];
    return (
      `Preset을보낼 수 없습니다.\n\n` +
      lines.join("\n") +
      `\n\n② 카테고리·공종 탭에서 builtInCategory를 채운 뒤 다시 시도하세요.`
    );
  }

  function exportPresetJson() {
    const node = getWorkflowNodes().find((n) => n.id === activeVtId);
    if (!node) {
      alert("도면 템플릿을 선택하세요.");
      return;
    }
    const result = buildPresetForNode(node);
    if (result.blocked) {
      alert(formatPresetBlockMessage(result));
      return;
    }
    if (result.warnings.length) console.warn(result.warnings);
    const preset = result.preset;
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(preset.templateName || "preset").replace(/[^\w가-힣.-]+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportCsv() {
    if (!activeVtId) return;
    const vt = getWorkflowNodes().find((n) => n.id === activeVtId);
    const header = ["group", "revitCategory", "builtInCategory", "ifcClass", "important", "on", "halftone", "transp", "gfxSummary"];
    const lines = [header.join(",")];
    for (const row of state.rows) {
      const cell = getCell(activeVtId, row.id);
      const bic = builtInForRow(row);
      const o = window.VgGraphics.cellToPresetOverride(bic, cell);
      const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
      lines.push(
        [row.group, row.revitCategory, bic, row.ifcClass, row.important, cell.on, cell.halftone, cell.transp, window.VgGraphics.formatSummary(o)]
          .map(esc)
          .join(",")
      );
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vg-${slugify(vt?.name || activeVtId)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vg-checklist-v3.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function addCatalogRow() {
    const revitCategory = prompt("Revit Category (UI) 이름");
    if (revitCategory == null) return;
    const id = uniqueRowId(revitCategory.trim());
    state.rows.push({
      id,
      group: "",
      revitCategory: revitCategory.trim(),
      ifcClass: "",
      important: "N",
      noteKr: "",
    });
    for (const n of getWorkflowNodes()) ensureVgSlot(n.id);
    markDirty();
    render();
  }

  function switchToTab(name) {
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === name);
    });
    document.querySelectorAll(".panel").forEach((p) => {
      p.classList.toggle("active", p.id === `panel-${name}`);
    });
  }

  function applyDeployedSeed(data, options = {}) {
    const { persist = false } = options;
    const n = normalizeIncoming(data);
    if (!n) throw new Error("vg-checklist 형식이 아닙니다.");
    state = n;
    syncAllVtSlots();
    dirty = false;
    if (persist) {
      state.updatedAt = new Date().toISOString().slice(0, 10);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    const nodes = getWorkflowNodes();
    if (nodes.length && !nodes.some((nd) => nd.id === activeVtId)) {
      activeVtId = nodes.find((nd) => nd.role === "base" || !nd.parentId)?.id ?? nodes[0].id;
    }
    render();
    updateStatus();
  }

  window.VgChecklist = {
    getState: () => structuredClone(state),
    setState: (data) => {
      const n = normalizeIncoming(data);
      if (n) {
        state = n;
        syncAllVtSlots();
        markDirty();
        render();
      }
    },
    applyDeployedSeed,
    setActiveViewTemplate(id) {
      activeVtId = id || null;
      if (els.vtSelect && id) els.vtSelect.value = id;
      ensureVgSlot(id);
      render();
      switchToTab("checklist");
    },
    getActiveViewTemplateId: () => activeVtId,
    ensureVgSlot,
    syncAllVtSlots,
    getAncestorChain,
    getEffectiveCell,
    buildPresetForNode,
    buildOverridesForViewTemplate,
    formatPresetBlockMessage,
    refresh: render,
    isDirty: () => dirty,
  };

  els.btnSave?.addEventListener("click", saveStorage);
  els.btnReset?.addEventListener("click", () => {
    if (!confirm("체크리스트를 기본 JSON으로 되돌릴까요?")) return;
    applyDeployedSeed(loadDefault(), { persist: false });
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_V2);
  });
  els.btnAddRow?.addEventListener("click", addCatalogRow);
  els.btnSyncVt?.addEventListener("click", () => {
    syncAllVtSlots();
    markDirty();
    render();
    alert("도면 템플릿 목록과 V/G 슬롯을 동기화했습니다.");
  });
  els.btnExportPreset?.addEventListener("click", exportPresetJson);
  els.btnExportCsv?.addEventListener("click", exportCsv);
  els.btnExportJson?.addEventListener("click", exportJson);
  els.vtSelect?.addEventListener("change", () => {
    activeVtId = els.vtSelect.value || null;
    render();
  });
  [els.search, els.groupFilter, els.importantOnly, els.onlyChanged].forEach((el) => {
    el?.addEventListener("input", render);
    el?.addEventListener("change", render);
  });

  state = loadStorage(STORAGE_KEY) ?? loadStorage(STORAGE_KEY_V2) ?? loadDefault();
  syncAllVtSlots();
  const nodes = getWorkflowNodes();
  if (nodes.length) activeVtId = nodes.find((n) => n.role === "base" || !n.parentId)?.id ?? nodes[0].id;
  render();
})();
