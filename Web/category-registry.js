/**
 * Revit 카테고리 ↔ 공종 · 자재 유형 매핑
 */
(function () {
  const STORAGE_KEY = "unitlab-category-registry-v1";
  const TAB_KEY     = "categories";

  /** @type {{ schemaVersion: number, updatedAt: string, trades: object[], materialTypes: object[], categories: object[], processes: object[] }} */
  let state = { schemaVersion: 2, updatedAt: "", trades: [], materialTypes: [], categories: [], processes: [] };

  let dirty = false;

  /* ── UI 헬퍼 ── */
  function toast(type, title, message, duration) {
    window.UI?.toast({ type, title, message, duration });
  }

  async function uiConfirm(title, message) {
    if (window.UI?.confirm) return window.UI.confirm({ title, message });
    return window.confirm(`${title}\n${message}`);
  }

  async function uiPrompt(title, msg2, defaultValue = "") {
    if (window.UI?.prompt) return window.UI.prompt({ title, message: msg2, defaultValue });
    return window.prompt(title, defaultValue);
  }

  const els = {
    panel: document.getElementById("panel-categories"),
    status: document.getElementById("crStatus"),
    search: document.getElementById("crSearch"),
    groupFilter: document.getElementById("crGroupFilter"),
    tradeFilter: document.getElementById("crTradeFilter"),
    matFilter: document.getElementById("crMatFilter"),
    processFilter: document.getElementById("crProcessFilter"),
    unmappedOnly: document.getElementById("crUnmappedOnly"),
    inactiveOnly: document.getElementById("crInactiveOnly"),
    tbody: document.getElementById("crBody"),
    tradesBody: document.getElementById("crTradesBody"),
    matsBody: document.getElementById("crMatsBody"),
    btnSave: document.getElementById("crBtnSave"),
    btnReset: document.getElementById("crBtnReset"),
    btnExport: document.getElementById("crBtnExport"),
    btnImport: document.getElementById("crImportInput"),
    btnSyncChecklist: document.getElementById("crBtnSyncChecklist"),
    btnAddCategory: document.getElementById("crBtnAddCategory"),
    btnAddTrade: document.getElementById("crBtnAddTrade"),
    btnAddMat: document.getElementById("crBtnAddMat"),
    btnFillBuiltin: document.getElementById("crBtnFillBuiltin"),
  };

  if (!els.panel) return;

  function loadDefault() {
    const raw = window.CATEGORY_REGISTRY_DEFAULT;
    if (!raw?.categories) {
      return { schemaVersion: 2, updatedAt: "", trades: [], materialTypes: [], categories: [], processes: [] };
    }
    const data = structuredClone(raw);
    data.schemaVersion = 2;
    if (!Array.isArray(data.processes) || !data.processes.length) {
      data.processes = structuredClone(window.PROCESS_DATABASE_DEFAULT?.processes ?? []);
    }
    return data;
  }

  function loadStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!Array.isArray(data.categories)) return null;
      if (!Array.isArray(data.processes)) {
        data.processes = structuredClone(window.PROCESS_DATABASE_DEFAULT?.processes ?? []);
      }
      data.schemaVersion = 2;
      return data;
    } catch {
      return null;
    }
  }

  function saveStorage() {
    state.updatedAt = new Date().toISOString().slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    dirty = false;
    window.UI?.setDirty(TAB_KEY, false);
    updateStatus();
  }

  function markDirty() {
    dirty = true;
    window.UI?.setDirty(TAB_KEY, true);
    updateStatus();
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

  function slugify(text) {
    return String(text ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item";
  }

  function uniqueTradeId(codeOrName) {
    const used = new Set(state.trades.map((t) => t.id));
    let base = `g-${slugify(codeOrName) || "new"}`;
    let id = base;
    let n = 2;
    while (used.has(id)) {
      id = `${base}-${n}`;
      n++;
    }
    return id;
  }

  function uniqueMatId(codeOrName) {
    const used = new Set(state.materialTypes.map((m) => m.id));
    let base = `m-${slugify(codeOrName) || "new"}`;
    let id = base;
    let n = 2;
    while (used.has(id)) {
      id = `${base}-${n}`;
      n++;
    }
    return id;
  }

  function uniqueCatId(seed) {
    const used = new Set(state.categories.map((c) => c.id));
    let base = slugify(seed) || "new";
    let id = base;
    let n = 2;
    while (used.has(id)) {
      id = `${base}-${n}`;
      n++;
    }
    return id;
  }

  function tradeMap() {
    return new Map(state.trades.map((t) => [t.id, t]));
  }

  function matMap() {
    return new Map(state.materialTypes.map((m) => [m.id, m]));
  }

  function sortedTrades() {
    return [...state.trades].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function sortedMats() {
    return [...state.materialTypes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function uniqueGroups() {
    return [...new Set(state.categories.map((c) => c.revitGroup).filter(Boolean))].sort();
  }

  /** 공정군 필터 시 하위 세부 공정에 연결된 카테고리도 포함 */
  function categoryMatchesProcess(cat, processId) {
    if (!processId) return true;
    const ids = cat.processIds ?? [];
    if (ids.includes(processId)) return true;
    const proc = (state.processes ?? []).find((p) => p.id === processId);
    if (proc?.level !== "group") return false;
    const descendants = new Set();
    function collect(parentId) {
      for (const p of state.processes ?? []) {
        if (p.parentId === parentId) {
          descendants.add(p.id);
          collect(p.id);
        }
      }
    }
    collect(processId);
    return ids.some((id) => descendants.has(id));
  }

  function refreshFilters() {
    const g = els.groupFilter.value;
    els.groupFilter.innerHTML =
      '<option value="">전체 Revit 그룹</option>' +
      uniqueGroups().map((x) => `<option value="${escapeAttr(x)}">${escapeHtml(x)}</option>`).join("");
    if ([...els.groupFilter.options].some((o) => o.value === g)) els.groupFilter.value = g;

    const tf = els.tradeFilter.value;
    els.tradeFilter.innerHTML =
      '<option value="">전체 공종</option>' +
      sortedTrades().map((t) => `<option value="${t.id}">${escapeHtml(t.name)} (${escapeHtml(t.code)})</option>`).join("");
    if ([...els.tradeFilter.options].some((o) => o.value === tf)) els.tradeFilter.value = tf;

    const mf = els.matFilter.value;
    els.matFilter.innerHTML =
      '<option value="">전체 자재 유형</option>' +
      sortedMats().map((m) => `<option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.code)})</option>`).join("");
    if ([...els.matFilter.options].some((o) => o.value === mf)) els.matFilter.value = mf;
  }

  function updateStatus() {
    const mapped = state.categories.filter((c) => c.tradeIds?.length && c.materialTypeIds?.length).length;
    const procN = state.processes?.length ?? 0;
    const suffix = dirty ? " · 💾 저장 안 됨" : " · 저장됨";
    els.status.textContent = `카테고리 ${state.categories.length} · 공정 ${procN} · 공종·자재 연결 ${mapped}건${suffix}`;
  }

  function multiSelectOptions(items, selectedIds, dataAttr) {
    const sel = new Set(selectedIds ?? []);
    return items
      .map(
        (it) =>
          `<option value="${escapeAttr(it.id)}" ${sel.has(it.id) ? "selected" : ""}>${escapeHtml(it.name)}</option>`
      )
      .join("");
  }

  function matchesFilter(cat) {
    const search = (els.search.value || "").trim().toLowerCase();
    const group = els.groupFilter.value;
    const tradeId = els.tradeFilter.value;
    const matId = els.matFilter.value;
    const processId = els.processFilter?.value;
    const unmapped = els.unmappedOnly.checked;
    const inactiveOnly = els.inactiveOnly.checked;

    if (inactiveOnly && cat.active !== false) return false;
    if (!inactiveOnly && cat.active === false) return false;
    if (group && cat.revitGroup !== group) return false;
    if (tradeId && !(cat.tradeIds ?? []).includes(tradeId)) return false;
    if (matId && !(cat.materialTypeIds ?? []).includes(matId)) return false;
    if (!categoryMatchesProcess(cat, processId)) return false;
    if (unmapped && (cat.tradeIds?.length && cat.materialTypeIds?.length)) return false;
    if (!search) return true;
    const hay = [cat.revitCategoryUi, cat.builtInCategory, cat.revitGroup, cat.ifcClass, cat.noteKr]
      .join(" ")
      .toLowerCase();
    return hay.includes(search);
  }

  function renderMasters() {
    els.tradesBody.innerHTML = "";
    for (const t of sortedTrades()) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="text" data-trade-field="code" value="${escapeAttr(t.code)}" /></td>
        <td><input type="text" data-trade-field="name" value="${escapeAttr(t.name)}" /></td>
        <td><input type="number" data-trade-field="order" value="${t.order ?? 0}" class="cr-num" /></td>
        <td><button type="button" class="cr-del" data-del-trade="${t.id}">×</button></td>
      `;
      tr.querySelectorAll("[data-trade-field]").forEach((inp) => {
        inp.addEventListener("change", () => {
          t[inp.dataset.tradeField] = inp.dataset.tradeField === "order" ? Number(inp.value) : inp.value;
          markDirty();
          refreshFilters();
        });
      });
      tr.querySelector("[data-del-trade]").addEventListener("click", async () => {
        const okT = await uiConfirm(`공종 삭제`, `「${t.name}」을 삭제할까요? 연결된 카테고리에서도 제거됩니다.`);
        if (!okT) return;
        state.trades = state.trades.filter((x) => x.id !== t.id);
        state.categories.forEach((c) => {
          c.tradeIds = (c.tradeIds ?? []).filter((id) => id !== t.id);
        });
        markDirty();
        render();
      });
      els.tradesBody.appendChild(tr);
    }

    els.matsBody.innerHTML = "";
    for (const m of sortedMats()) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="text" data-mat-field="code" value="${escapeAttr(m.code)}" /></td>
        <td><input type="text" data-mat-field="name" value="${escapeAttr(m.name)}" /></td>
        <td><input type="number" data-mat-field="order" value="${m.order ?? 0}" class="cr-num" /></td>
        <td><button type="button" class="cr-del" data-del-mat="${m.id}">×</button></td>
      `;
      tr.querySelectorAll("[data-mat-field]").forEach((inp) => {
        inp.addEventListener("change", () => {
          m[inp.dataset.matField] = inp.dataset.matField === "order" ? Number(inp.value) : inp.value;
          markDirty();
          refreshFilters();
        });
      });
      tr.querySelector("[data-del-mat]").addEventListener("click", async () => {
        const okM = await uiConfirm(`자재 유형 삭제`, `「${m.name}」을 삭제할까요?`);
        if (!okM) return;
        state.materialTypes = state.materialTypes.filter((x) => x.id !== m.id);
        state.categories.forEach((c) => {
          c.materialTypeIds = (c.materialTypeIds ?? []).filter((id) => id !== m.id);
        });
        markDirty();
        render();
      });
      els.matsBody.appendChild(tr);
    }
  }

  function renderCategories() {
    els.tbody.innerHTML = "";
    const trades = sortedTrades();
    const mats = sortedMats();
    let visible = 0;

    for (const cat of state.categories) {
      if (!matchesFilter(cat)) continue;
      visible++;
      const tr = document.createElement("tr");
      if (!cat.tradeIds?.length || !cat.materialTypeIds?.length) tr.classList.add("row-unmapped");
      if (cat.active === false) tr.classList.add("row-inactive");

      tr.innerHTML = `
        <td class="group-cell">${escapeHtml(cat.revitGroup)}</td>
        <td><input type="text" data-cat-field="revitCategoryUi" value="${escapeAttr(cat.revitCategoryUi)}" /></td>
        <td><input type="text" data-cat-field="builtInCategory" value="${escapeAttr(cat.builtInCategory)}" title="Revit API (OST_*) 이름" /></td>
        <td>
          <select multiple class="cr-multi" data-cat-field="tradeIds" title="Ctrl+클릭 다중 선택">${multiSelectOptions(trades, cat.tradeIds)}</select>
        </td>
        <td>
          <select multiple class="cr-multi" data-cat-field="materialTypeIds" title="Ctrl+클릭 다중 선택">${multiSelectOptions(mats, cat.materialTypeIds)}</select>
        </td>
        <td>
          <select multiple class="cr-multi" data-cat-field="processIds" title="모듈러 공정 (Ctrl+클릭)">${window.ProcessRegistry?.processOptionsHtml?.(state, cat.processIds, false) ?? ""}</select>
        </td>
        <td><input type="text" data-cat-field="ifcClass" value="${escapeAttr(cat.ifcClass)}" class="wide-in" /></td>
        <td><input type="text" data-cat-field="noteKr" value="${escapeAttr(cat.noteKr)}" class="wide-in" /></td>
        <td class="cr-active-cell">
          <label class="inline-check"><input type="checkbox" data-cat-field="active" ${cat.active !== false ? "checked" : ""} /> 사용</label>
        </td>
        <td><button type="button" class="cr-del" data-del-cat="${cat.id}">×</button></td>
      `;

      tr.querySelectorAll("[data-cat-field]").forEach((el) => {
        const field = el.dataset.catField;
        const apply = () => {
          if (field === "tradeIds" || field === "materialTypeIds" || field === "processIds") {
            cat[field] = [...el.selectedOptions].map((o) => o.value);
          } else if (field === "active") {
            cat.active = el.checked;
          } else {
            cat[field] = el.value;
          }
          markDirty();
          if (field === "revitGroup") refreshFilters();
          tr.classList.toggle("row-unmapped", !cat.tradeIds?.length || !cat.materialTypeIds?.length);
          tr.classList.toggle("row-inactive", cat.active === false);
        };
        if (el.tagName === "SELECT") el.addEventListener("change", apply);
        else if (el.type === "checkbox") el.addEventListener("change", apply);
        else {
          el.addEventListener("change", apply);
          el.addEventListener("input", apply);
        }
      });

      tr.querySelector(".group-cell").addEventListener("dblclick", async () => {
        const g = await uiPrompt("Revit 그룹명 수정", "", cat.revitGroup || "");
        if (g == null) return;
        cat.revitGroup = g.trim();
        markDirty();
        refreshFilters();
        tr.querySelector(".group-cell").textContent = cat.revitGroup;
      });

      tr.querySelector("[data-del-cat]").addEventListener("click", async () => {
        const okC = await uiConfirm(`카테고리 삭제`, `「${cat.revitCategoryUi}」 카테고리를 삭제할까요?`);
        if (!okC) return;
        state.categories = state.categories.filter((c) => c.id !== cat.id);
        markDirty();
        renderCategories();
      });

      els.tbody.appendChild(tr);
    }

    if (!visible) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="10" class="empty-row">조건에 맞는 카테고리가 없습니다.</td>';
      els.tbody.appendChild(tr);
    }
    updateStatus();
  }

  function render() {
    refreshFilters();
    renderMasters();
    renderCategories();
    window.ProcessRegistry?.render?.();
  }

  async function addTrade() {
    const name = await uiPrompt("공종 이름", "", "");
    if (name == null || !name.trim()) return;
    const code = await uiPrompt("공종 코드 (영문 약어)", "", slugify(name).toUpperCase().slice(0, 6));
    if (code == null) return;
    const maxOrder = Math.max(-1, ...state.trades.map((t) => t.order ?? 0));
    state.trades.push({
      id: uniqueTradeId(code),
      code: code.trim() || "NEW",
      name: name.trim(),
      order: maxOrder + 1,
    });
    markDirty();
    render();
    toast("success", "공종 추가", `「${name.trim()}」을 추가했습니다.`);
  }

  async function addMaterialType() {
    const name = await uiPrompt("자재 유형 이름", "", "");
    if (name == null || !name.trim()) return;
    const code = await uiPrompt("자재 코드", "", slugify(name).toUpperCase().slice(0, 6));
    if (code == null) return;
    const maxOrder = Math.max(-1, ...state.materialTypes.map((m) => m.order ?? 0));
    state.materialTypes.push({
      id: uniqueMatId(code),
      code: code.trim() || "NEW",
      name: name.trim(),
      order: maxOrder + 1,
    });
    markDirty();
    render();
    toast("success", "자재 유형 추가", `「${name.trim()}」을 추가했습니다.`);
  }

  async function addCategory() {
    const ui = await uiPrompt("Revit Category (UI 이름)", "", "");
    if (ui == null) return;
    const g = els.groupFilter.value || uniqueGroups()[0] || "General";
    state.categories.push({
      id: uniqueCatId(ui),
      revitCategoryUi: ui.trim(),
      builtInCategory: "",
      revitGroup: g,
      ifcClass: "",
      noteKr: "",
      tradeIds: [],
      materialTypeIds: [],
      processIds: [],
      active: true,
    });
    markDirty();
    render();
    toast("success", "카테고리 추가", ui.trim() ? `「${ui.trim()}」을 추가했습니다.` : "새 카테고리를 추가했습니다.");
  }

  function syncFromChecklist() {
    const cl = window.VgChecklist?.getState?.() ?? window.VG_CHECKLIST_DEFAULT;
    const rows = cl?.rows;
    if (!rows?.length) {
      alert("V/G 체크리스트 데이터를 찾을 수 없습니다.");
      return;
    }
    const byUi = new Map(state.categories.map((c) => [c.revitCategoryUi.toLowerCase(), c]));
    let added = 0;
    for (const row of rows) {
      const ui = row.revitCategory ?? "";
      const key = ui.toLowerCase();
      if (byUi.has(key)) {
        const cat = byUi.get(key);
        if (!cat.ifcClass && row.ifcClass) cat.ifcClass = row.ifcClass;
        if (!cat.noteKr && row.noteKr) cat.noteKr = row.noteKr;
        if (!cat.revitGroup && row.group) cat.revitGroup = row.group;
        if (row.id && !cat.checklistId) cat.checklistId = row.id;
        continue;
      }
      const used = new Set(state.categories.map((c) => c.id));
      const id = row.id && !used.has(row.id) ? row.id : uniqueCatId(ui || row.id);
      const cat = {
        id,
        checklistId: row.id,
        revitCategoryUi: ui,
        builtInCategory: "",
        revitGroup: row.group ?? "",
        ifcClass: row.ifcClass ?? "",
        noteKr: row.noteKr ?? "",
        tradeIds: guessTradesFromGroup(row.group),
        materialTypeIds: [],
        processIds: [],
        active: true,
      };
      state.categories.push(cat);
      byUi.set(key, cat);
      added++;
    }
    if (!added) {
      toast("info", "동기화 완료", "추가할 새 카테고리가 없습니다. 기존 항목의 IFC·메모는 보완했을 수 있습니다.");
    } else {
      toast("success", "동기화 완료", `${added}개 카테고리를 체크리스트에서 가져왔습니다.`);
    }
    markDirty();
    render();
  }

  function guessTradesFromGroup(group) {
    const g = (group || "").toLowerCase();
    if (g.includes("architecture")) return ["g-arch"];
    if (g === "structure") return ["g-str"];
    if (g.includes("mechanical")) return ["g-mech"];
    if (g.includes("plumbing")) return ["g-plum"];
    if (g.includes("electrical")) return ["g-elec"];
    if (g === "links") return ["g-coord"];
    return [];
  }

  function fillBuiltinFromMap() {
    const map = window.UI_TO_BUILTIN_MAP;
    if (!map) {
      alert("ui-to-builtin 매핑을 불러올 수 없습니다.");
      return;
    }
    let n = 0;
    for (const cat of state.categories) {
      if ((cat.builtInCategory || "").trim()) continue;
      const bid = map[(cat.revitCategoryUi || "").trim()];
      if (bid) {
        cat.builtInCategory = bid;
        n++;
      }
    }
    if (n) {
      markDirty();
      render();
      toast("success", "builtIn 자동채우기", `${n}개 builtInCategory를 채웠습니다. 「💾 저장」을 눌러 주세요.`);
    } else {
      toast("info", "자동채우기", "채울 빈 항목이 없습니다.");
    }
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "category-registry.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function init() {
    state = loadStorage() ?? loadDefault();
    dirty = false;
    window.UI?.setDirty(TAB_KEY, false);
    render();
  }

  els.btnSave?.addEventListener("click", () => {
    saveStorage();
    toast("success", "저장 완료", "카테고리 레지스트리를 브라우저에 저장했습니다.");
  });

  els.btnReset?.addEventListener("click", async () => {
    const ok = await uiConfirm("기본값 복원", "로컬 저장을 지우고 기본 데이터로 되돌릴까요?\n저장되지 않은 변경사항은 사라집니다.");
    if (!ok) return;
    applyDeployedSeed(loadDefault(), { persist: false });
    toast("info", "초기화 완료", "기본 데이터로 복원했습니다.");
  });

  els.btnExport?.addEventListener("click", downloadJson);

  els.btnImport?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.categories)) throw new Error("format");
      const ok = await uiConfirm("JSON 가져오기", `「${file.name}」을 현재 편집 내용에 덮어씁니다. 계속할까요?`);
      if (!ok) return;
      state = data;
      markDirty();
      render();
      toast("success", "JSON 가져오기 완료", `「${file.name}」을 불러왔습니다.`);
    } catch {
      toast("error", "형식 오류", "category-registry.json 형식이 아닙니다.");
    }
  });

  els.btnSyncChecklist?.addEventListener("click", syncFromChecklist);
  els.btnFillBuiltin?.addEventListener("click", fillBuiltinFromMap);
  els.btnAddCategory?.addEventListener("click", addCategory);
  els.btnAddTrade?.addEventListener("click", addTrade);
  els.btnAddMat?.addEventListener("click", addMaterialType);

  els.search?.addEventListener("input", renderCategories);
  els.groupFilter?.addEventListener("change", renderCategories);
  els.tradeFilter?.addEventListener("change", renderCategories);
  els.matFilter?.addEventListener("change", renderCategories);
  els.processFilter?.addEventListener("change", () => {
    renderCategories();
    window.ProcessRegistry?.render?.();
  });
  els.unmappedOnly?.addEventListener("change", renderCategories);
  els.inactiveOnly?.addEventListener("change", renderCategories);

  document.querySelector('.tab[data-tab="categories"]')?.addEventListener("click", () => render());

  function applyDeployedSeed(data, options = {}) {
    const { persist = false } = options;
    if (!Array.isArray(data?.categories)) throw new Error("category-registry 형식이 아닙니다.");
    state = structuredClone(data);
    if (!Array.isArray(state.processes) || !state.processes.length) {
      state.processes = structuredClone(window.PROCESS_DATABASE_DEFAULT?.processes ?? []);
    }
    state.schemaVersion = 2;
    dirty = false;
    window.UI?.setDirty(TAB_KEY, false);
    if (persist) saveStorage();
    else localStorage.removeItem(STORAGE_KEY);
    render();
  }

  window.CategoryRegistry = {
    refresh: render,
    getState: () => state,
    markDirty,
    tradeMap,
    matMap,
    applyDeployedSeed,
  };

  init();
})();
