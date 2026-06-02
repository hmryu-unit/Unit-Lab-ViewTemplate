/**
 * Revit 카테고리 레지스트리 v3
 * ─ 좌: 그룹별 카테고리 DB 테이블
 * ─ 우: 슬라이드오버 상세 편집 패널 (드롭다운 멀티셀렉트)
 */
(function () {
  "use strict";
  const STORAGE_KEY = "unitlab-category-registry-v1";
  const TAB_KEY     = "categories";

  let state = { schemaVersion: 2, updatedAt: "", trades: [], materialTypes: [], categories: [], processes: [] };
  let dirty = false;
  let selectedCatId = null;   // 우측 패널에 표시 중인 카테고리 id
  let mastersPanelOpen = false;

  /* ── UI 헬퍼 ── */
  const toast = (type, title, message, duration) =>
    window.UI?.toast({ type, title, message, duration });

  const uiConfirm = (title, message) =>
    window.UI?.confirm ? window.UI.confirm({ title, message }) : Promise.resolve(window.confirm(`${title}\n${message}`));

  const uiPrompt = (title, msg2 = "", defaultValue = "") =>
    window.UI?.prompt ? window.UI.prompt({ title, message: msg2, defaultValue }) : Promise.resolve(window.prompt(title, defaultValue));

  function esc(s) {
    return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function escAttr(s) { return esc(s).replace(/'/g,"&#39;"); }

  function slugify(t) {
    return String(t ?? "").trim().toLowerCase()
      .replace(/[^\w\s-]/g,"").replace(/[\s_]+/g,"-").replace(/^-+|-+$/g,"") || "item";
  }

  /* ── DOM 참조 ── */
  const els = {
    panel:          document.getElementById("panel-categories"),
    status:         document.getElementById("crStatus"),
    search:         document.getElementById("crSearch"),
    groupFilter:    document.getElementById("crGroupFilter"),
    tradeFilter:    document.getElementById("crTradeFilter"),
    matFilter:      document.getElementById("crMatFilter"),
    processFilter:  document.getElementById("crProcessFilter"),
    unmappedOnly:   document.getElementById("crUnmappedOnly"),
    inactiveOnly:   document.getElementById("crInactiveOnly"),
    tbody:          document.getElementById("crBody"),
    btnSave:        document.getElementById("crBtnSave"),
    btnReset:       document.getElementById("crBtnReset"),
    btnExport:      document.getElementById("crBtnExport"),
    btnImport:      document.getElementById("crImportInput"),
    btnSyncCl:      document.getElementById("crBtnSyncChecklist"),
    btnAddCat:      document.getElementById("crBtnAddCategory"),
    btnAddTrade:    document.getElementById("crBtnAddTrade"),
    btnAddMat:      document.getElementById("crBtnAddMat"),
    btnFillBuiltin: document.getElementById("crBtnFillBuiltin"),
    // 마스터 패널
    masterToggle:   document.getElementById("crMasterToggle"),
    mastersWrap:    document.getElementById("crMastersWrap"),
    tradesBody:     document.getElementById("crTradesBody"),
    matsBody:       document.getElementById("crMatsBody"),
    // 슬라이드오버
    detailPanel:    document.getElementById("crDetailPanel"),
    detailOverlay:  document.getElementById("crDetailOverlay"),
  };

  if (!els.panel) return;

  /* ════════════════════════════════════════════
     데이터 관리
  ════════════════════════════════════════════ */
  function loadDefault() {
    const raw = window.CATEGORY_REGISTRY_DEFAULT;
    if (!raw?.categories) return { schemaVersion:2, updatedAt:"", trades:[], materialTypes:[], categories:[], processes:[] };
    const data = structuredClone(raw);
    data.schemaVersion = 2;
    if (!Array.isArray(data.processes) || !data.processes.length)
      data.processes = structuredClone(window.PROCESS_DATABASE_DEFAULT?.processes ?? []);
    return data;
  }

  function loadStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!Array.isArray(data.categories)) return null;
      if (!Array.isArray(data.processes))
        data.processes = structuredClone(window.PROCESS_DATABASE_DEFAULT?.processes ?? []);
      data.schemaVersion = 2;
      return data;
    } catch { return null; }
  }

  function saveStorage() {
    state.updatedAt = new Date().toISOString().slice(0,10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    dirty = false;
    window.UI?.setDirty(TAB_KEY, false);
    updateStatus();
    toast("success","저장 완료","카테고리 레지스트리를 브라우저에 저장했습니다.");
  }

  function markDirty() {
    dirty = true;
    window.UI?.setDirty(TAB_KEY, true);
    updateStatus();
  }

  /* ── 조회 헬퍼 ── */
  const sortedTrades = () => [...state.trades].sort((a,b) => (a.order??0)-(b.order??0));
  const sortedMats   = () => [...state.materialTypes].sort((a,b) => (a.order??0)-(b.order??0));
  const tradeMap     = () => new Map(state.trades.map(t => [t.id, t]));
  const matMap       = () => new Map(state.materialTypes.map(m => [m.id, m]));
  const uniqueGroups = () => [...new Set(state.categories.map(c=>c.revitGroup).filter(Boolean))].sort();
  const catById      = (id) => state.categories.find(c => c.id === id);

  function uniqueId(prefix, col) {
    const used = new Set(col.map(x => x.id));
    let base = `${prefix}-${slugify(prefix)||"new"}`, id = base, n = 2;
    while (used.has(id)) { id = `${base}-${n}`; n++; }
    return id;
  }

  function categoryMatchesProcess(cat, processId) {
    if (!processId) return true;
    const ids = cat.processIds ?? [];
    if (ids.includes(processId)) return true;
    const proc = (state.processes ?? []).find(p => p.id === processId);
    if (proc?.level !== "group") return false;
    const desc = new Set();
    (function collect(pid) {
      for (const p of state.processes ?? []) if (p.parentId === pid) { desc.add(p.id); collect(p.id); }
    })(processId);
    return ids.some(id => desc.has(id));
  }

  function matchesFilter(cat) {
    const search = (els.search?.value||"").trim().toLowerCase();
    const group  = els.groupFilter?.value;
    const tradeId   = els.tradeFilter?.value;
    const matId     = els.matFilter?.value;
    const processId = els.processFilter?.value;
    const unmapped  = els.unmappedOnly?.checked;
    const inactive  = els.inactiveOnly?.checked;

    if (inactive  && cat.active !== false) return false;
    if (!inactive && cat.active === false)  return false;
    if (group  && cat.revitGroup !== group) return false;
    if (tradeId   && !(cat.tradeIds??[]).includes(tradeId))          return false;
    if (matId     && !(cat.materialTypeIds??[]).includes(matId))     return false;
    if (!categoryMatchesProcess(cat, processId))                     return false;
    if (unmapped && (cat.tradeIds?.length && cat.materialTypeIds?.length)) return false;
    if (!search) return true;
    return [cat.revitCategoryUi, cat.builtInCategory, cat.revitGroup, cat.ifcClass, cat.noteKr]
      .join(" ").toLowerCase().includes(search);
  }

  function updateStatus() {
    if (!els.status) return;
    const mapped = state.categories.filter(c => c.tradeIds?.length).length;
    const total  = state.categories.length;
    const suf    = dirty ? " · 💾 저장 안 됨" : " · 저장됨";
    els.status.textContent = `카테고리 ${total} · 공종 연결 ${mapped}건${suf}`;
  }

  /* ════════════════════════════════════════════
     필터 갱신
  ════════════════════════════════════════════ */
  function refreshFilters() {
    const g = els.groupFilter?.value;
    if (els.groupFilter) {
      els.groupFilter.innerHTML =
        '<option value="">전체 그룹</option>' +
        uniqueGroups().map(x => `<option value="${escAttr(x)}"${x===g?" selected":""}>${esc(x)}</option>`).join("");
    }
    const tf = els.tradeFilter?.value;
    if (els.tradeFilter) {
      els.tradeFilter.innerHTML =
        '<option value="">전체 공종</option>' +
        sortedTrades().map(t => `<option value="${t.id}"${t.id===tf?" selected":""}>${esc(t.name)}</option>`).join("");
    }
    const mf = els.matFilter?.value;
    if (els.matFilter) {
      els.matFilter.innerHTML =
        '<option value="">전체 자재</option>' +
        sortedMats().map(m => `<option value="${m.id}"${m.id===mf?" selected":""}>${esc(m.name)}</option>`).join("");
    }
  }

  /* ════════════════════════════════════════════
     마스터 패널 (공종 · 자재 유형)
  ════════════════════════════════════════════ */
  function renderMasters() {
    if (!els.tradesBody || !els.matsBody) return;

    els.tradesBody.innerHTML = "";
    for (const t of sortedTrades()) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="text" data-f="code" value="${escAttr(t.code)}" style="width:5rem" /></td>
        <td><input type="text" data-f="name" value="${escAttr(t.name)}" /></td>
        <td><button class="cr-del" data-del-trade="${t.id}" title="삭제">×</button></td>
      `;
      tr.querySelectorAll("[data-f]").forEach(inp =>
        inp.addEventListener("change", () => { t[inp.dataset.f] = inp.value; markDirty(); refreshFilters(); })
      );
      tr.querySelector("[data-del-trade]").addEventListener("click", async () => {
        if (!await uiConfirm("공종 삭제", `「${t.name}」을 삭제할까요?`)) return;
        state.trades = state.trades.filter(x => x.id !== t.id);
        state.categories.forEach(c => { c.tradeIds = (c.tradeIds??[]).filter(id => id !== t.id); });
        markDirty(); render();
      });
      els.tradesBody.appendChild(tr);
    }

    els.matsBody.innerHTML = "";
    for (const m of sortedMats()) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="text" data-f="code" value="${escAttr(m.code)}" style="width:5rem" /></td>
        <td><input type="text" data-f="name" value="${escAttr(m.name)}" /></td>
        <td><button class="cr-del" data-del-mat="${m.id}" title="삭제">×</button></td>
      `;
      tr.querySelectorAll("[data-f]").forEach(inp =>
        inp.addEventListener("change", () => { m[inp.dataset.f] = inp.value; markDirty(); refreshFilters(); })
      );
      tr.querySelector("[data-del-mat]").addEventListener("click", async () => {
        if (!await uiConfirm("자재 삭제", `「${m.name}」을 삭제할까요?`)) return;
        state.materialTypes = state.materialTypes.filter(x => x.id !== m.id);
        state.categories.forEach(c => { c.materialTypeIds = (c.materialTypeIds??[]).filter(id => id !== m.id); });
        markDirty(); render();
      });
      els.matsBody.appendChild(tr);
    }
  }

  /* ════════════════════════════════════════════
     카테고리 테이블 (그룹 섹션별)
  ════════════════════════════════════════════ */
  function renderCategories() {
    if (!els.tbody) return;
    els.tbody.innerHTML = "";

    const cats = state.categories.filter(matchesFilter);
    if (!cats.length) {
      els.tbody.innerHTML = '<tr><td colspan="8" class="empty-row">조건에 맞는 카테고리가 없습니다.</td></tr>';
      updateStatus();
      return;
    }

    // 그룹별로 묶기
    const grouped = new Map();
    for (const cat of cats) {
      const g = cat.revitGroup || "(그룹 없음)";
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g).push(cat);
    }

    const tm = tradeMap();
    const mm = matMap();

    for (const [groupName, groupCats] of grouped) {
      // 그룹 헤더 행
      const headerTr = document.createElement("tr");
      headerTr.className = "cr-group-header";
      headerTr.dataset.group = groupName;
      headerTr.innerHTML = `
        <td colspan="8">
          <div class="cr-group-header-inner">
            <span class="cr-group-chevron">▾</span>
            <span class="cr-group-name">${esc(groupName)}</span>
            <span class="cr-group-count">${groupCats.length}</span>
          </div>
        </td>
      `;
      headerTr.addEventListener("click", () => toggleGroup(groupName));
      els.tbody.appendChild(headerTr);

      // 카테고리 행들
      for (const cat of groupCats) {
        const tr = buildCategoryRow(cat, groupName, tm, mm);
        els.tbody.appendChild(tr);
      }
    }

    updateStatus();
  }

  function buildCategoryRow(cat, groupName, tm, mm) {
    const tr = document.createElement("tr");
    tr.className = "cr-cat-row";
    tr.dataset.catId = cat.id;
    tr.dataset.group = groupName;
    if (cat.active === false) tr.classList.add("row-inactive");
    const isMapped = cat.tradeIds?.length;
    if (!isMapped) tr.classList.add("row-unmapped");
    if (cat.id === selectedCatId) tr.classList.add("cr-row-selected");

    // 공종 태그 요약
    const tradeTags = (cat.tradeIds??[]).map(id => {
      const t = tm.get(id);
      return t ? `<span class="cr-inline-tag cr-tag-trade">${esc(t.code)}</span>` : "";
    }).join("");

    // 자재 태그 요약
    const matTags = (cat.materialTypeIds??[]).slice(0,2).map(id => {
      const m = mm.get(id);
      return m ? `<span class="cr-inline-tag cr-tag-mat">${esc(m.code)}</span>` : "";
    }).join("") + ((cat.materialTypeIds??[]).length > 2
      ? `<span class="cr-inline-tag cr-tag-more">+${cat.materialTypeIds.length-2}</span>` : "");

    // builtIn 상태
    const bicBadge = cat.builtInCategory
      ? `<span class="cr-bic-ok" title="${escAttr(cat.builtInCategory)}">✓</span>`
      : `<span class="cr-bic-miss" title="builtInCategory 미입력">!</span>`;

    // 활성 여부 뱃지
    const activeBadge = cat.active !== false
      ? `<span class="cr-status-badge cr-status-on">활성</span>`
      : `<span class="cr-status-badge cr-status-off">비활성</span>`;

    tr.innerHTML = `
      <td class="cr-cell-check">
        <input type="checkbox" class="cr-row-check" />
      </td>
      <td class="cr-cell-name">
        <span class="cr-cat-name">${esc(cat.revitCategoryUi)}</span>
        ${cat.ifcClass ? `<span class="cr-cat-ifc">${esc(cat.ifcClass)}</span>` : ""}
      </td>
      <td class="cr-cell-bic">${bicBadge}<span class="cr-bic-text">${esc(cat.builtInCategory||"—")}</span></td>
      <td class="cr-cell-trades">${tradeTags || '<span class="cr-unmapped-hint">미연결</span>'}</td>
      <td class="cr-cell-mats">${matTags || '<span class="cr-unmapped-hint">—</span>'}</td>
      <td class="cr-cell-proc">
        ${(cat.processIds??[]).length
          ? `<span class="cr-inline-tag cr-tag-proc">${(cat.processIds??[]).length}개</span>`
          : '<span class="cr-unmapped-hint">—</span>'}
      </td>
      <td class="cr-cell-status">${activeBadge}</td>
      <td class="cr-cell-action">
        <button class="cr-edit-btn" title="상세 편집">편집 →</button>
      </td>
    `;

    // 행 클릭 → 슬라이드오버 열기
    tr.addEventListener("click", (e) => {
      if (e.target.closest(".cr-row-check") || e.target.closest(".cr-edit-btn")) return;
      openDetail(cat.id);
    });
    tr.querySelector(".cr-edit-btn").addEventListener("click", () => openDetail(cat.id));

    return tr;
  }

  // 그룹 접기/펼치기
  function toggleGroup(groupName) {
    const header = els.tbody.querySelector(`.cr-group-header[data-group="${CSS.escape(groupName)}"]`);
    const rows   = els.tbody.querySelectorAll(`.cr-cat-row[data-group="${CSS.escape(groupName)}"]`);
    const collapsed = header?.classList.toggle("collapsed");
    rows.forEach(r => { r.style.display = collapsed ? "none" : ""; });
  }

  /* ════════════════════════════════════════════
     슬라이드오버 상세 패널
  ════════════════════════════════════════════ */
  function openDetail(catId) {
    selectedCatId = catId;
    // 선택 행 하이라이트
    els.tbody.querySelectorAll(".cr-cat-row").forEach(r =>
      r.classList.toggle("cr-row-selected", r.dataset.catId === catId)
    );
    renderDetailPanel(catId);
    // 패널 열기
    els.detailPanel?.classList.add("open");
    els.detailOverlay?.classList.add("show");
    document.body.style.overflow = "";
  }

  function closeDetail() {
    selectedCatId = null;
    els.detailPanel?.classList.remove("open");
    els.detailOverlay?.classList.remove("show");
    els.tbody.querySelectorAll(".cr-cat-row").forEach(r => r.classList.remove("cr-row-selected"));
  }

  function renderDetailPanel(catId) {
    const cat = catById(catId);
    if (!cat) { closeDetail(); return; }

    const dp = els.detailPanel;
    if (!dp) return;

    const trades = sortedTrades();
    const mats   = sortedMats();

    // ── 멀티 드롭다운 옵션 빌더
    const tradeChecks = trades.map(t => {
      const sel = (cat.tradeIds??[]).includes(t.id);
      return `
        <label class="cr-dd-item${sel?" selected":""}">
          <input type="checkbox" value="${escAttr(t.id)}" ${sel?"checked":""} data-multi="tradeIds" />
          <span class="cr-dd-code">${esc(t.code)}</span>
          <span class="cr-dd-name">${esc(t.name)}</span>
        </label>`;
    }).join("");

    const matChecks = mats.map(m => {
      const sel = (cat.materialTypeIds??[]).includes(m.id);
      return `
        <label class="cr-dd-item${sel?" selected":""}">
          <input type="checkbox" value="${escAttr(m.id)}" ${sel?"checked":""} data-multi="materialTypeIds" />
          <span class="cr-dd-code">${esc(m.code)}</span>
          <span class="cr-dd-name">${esc(m.name)}</span>
        </label>`;
    }).join("");

    // 공정 목록 (그룹 > 세부)
    const procChecks = buildProcessChecks(cat);

    dp.innerHTML = `
      <div class="cr-detail-header">
        <div class="cr-detail-title">
          <span class="cr-detail-group-badge">${esc(cat.revitGroup||"—")}</span>
          <h3 id="crDetailCatName">${esc(cat.revitCategoryUi)}</h3>
        </div>
        <button class="cr-detail-close" id="crDetailClose" title="닫기">✕</button>
      </div>

      <div class="cr-detail-body">

        <!-- 기본 정보 -->
        <div class="cr-detail-section">
          <div class="cr-detail-section-title">기본 정보</div>

          <div class="cr-field">
            <label class="cr-field-label">Revit Category (UI)</label>
            <input type="text" id="cdRevitUi" class="cr-field-input" value="${escAttr(cat.revitCategoryUi)}" />
          </div>

          <div class="cr-field">
            <label class="cr-field-label">
              builtInCategory
              <span class="cr-field-hint">OST_* API 이름</span>
            </label>
            <div class="cr-field-row">
              <input type="text" id="cdBuiltIn" class="cr-field-input" value="${escAttr(cat.builtInCategory)}"
                placeholder="예) OST_Walls" style="flex:1" />
              <button class="cr-auto-btn" id="cdAutoFill" title="자동 채우기">⚡ 자동</button>
            </div>
          </div>

          <div class="cr-field">
            <label class="cr-field-label">Revit 그룹</label>
            <input type="text" id="cdRevitGroup" class="cr-field-input" list="crGroupList"
              value="${escAttr(cat.revitGroup)}" />
            <datalist id="crGroupList">
              ${uniqueGroups().map(g => `<option value="${escAttr(g)}">`).join("")}
            </datalist>
          </div>

          <div class="cr-field">
            <label class="cr-field-label">IFC Class</label>
            <input type="text" id="cdIfcClass" class="cr-field-input"
              value="${escAttr(cat.ifcClass)}" placeholder="예) IfcWall" />
          </div>

          <div class="cr-field">
            <label class="cr-field-label">메모 (한글)</label>
            <input type="text" id="cdNoteKr" class="cr-field-input"
              value="${escAttr(cat.noteKr)}" placeholder="용도 설명" />
          </div>

          <div class="cr-field-row" style="gap:.5rem;margin-top:.3rem">
            <label class="cr-toggle-label">
              <input type="checkbox" id="cdActive" ${cat.active!==false?"checked":""} />
              <span class="cr-toggle-track"></span>
              <span class="cr-toggle-text">활성 카테고리</span>
            </label>
          </div>
        </div>

        <!-- 공종 매핑 -->
        <div class="cr-detail-section">
          <div class="cr-detail-section-title">
            공종 매핑
            <span class="cr-section-count" id="cdTradeCount">${(cat.tradeIds??[]).length}개 선택</span>
          </div>
          <div class="cr-dd-list" id="cdTradeList">
            ${tradeChecks}
          </div>
        </div>

        <!-- 자재 유형 매핑 -->
        <div class="cr-detail-section">
          <div class="cr-detail-section-title">
            자재 유형
            <span class="cr-section-count" id="cdMatCount">${(cat.materialTypeIds??[]).length}개 선택</span>
          </div>
          <div class="cr-dd-list" id="cdMatList">
            ${matChecks}
          </div>
        </div>

        <!-- 모듈러 공정 매핑 -->
        <div class="cr-detail-section">
          <div class="cr-detail-section-title">
            모듈러 공정
            <span class="cr-section-count" id="cdProcCount">${(cat.processIds??[]).length}개 선택</span>
          </div>
          <div class="cr-dd-list cr-proc-list" id="cdProcList">
            ${procChecks}
          </div>
        </div>

      </div><!-- /.cr-detail-body -->

      <div class="cr-detail-footer">
        <button class="btn-danger" id="cdBtnDelete">🗑 삭제</button>
        <div style="display:flex;gap:.5rem">
          <button id="cdBtnCancel">취소</button>
          <button class="btn-primary" id="cdBtnApply">저장</button>
        </div>
      </div>
    `;

    // ── 이벤트 바인딩
    dp.querySelector("#crDetailClose").addEventListener("click", closeDetail);
    dp.querySelector("#cdBtnCancel").addEventListener("click", closeDetail);

    // 체크박스 → 실시간 카운트 업데이트
    dp.querySelectorAll("input[data-multi='tradeIds']").forEach(cb => {
      cb.addEventListener("change", () => {
        cb.closest(".cr-dd-item").classList.toggle("selected", cb.checked);
        const cnt = dp.querySelectorAll("input[data-multi='tradeIds']:checked").length;
        dp.querySelector("#cdTradeCount").textContent = `${cnt}개 선택`;
      });
    });
    dp.querySelectorAll("input[data-multi='materialTypeIds']").forEach(cb => {
      cb.addEventListener("change", () => {
        cb.closest(".cr-dd-item").classList.toggle("selected", cb.checked);
        const cnt = dp.querySelectorAll("input[data-multi='materialTypeIds']:checked").length;
        dp.querySelector("#cdMatCount").textContent = `${cnt}개 선택`;
      });
    });
    dp.querySelectorAll("input[data-multi='processIds']").forEach(cb => {
      cb.addEventListener("change", () => {
        cb.closest(".cr-dd-item").classList.toggle("selected", cb.checked);
        const cnt = dp.querySelectorAll("input[data-multi='processIds']:checked").length;
        dp.querySelector("#cdProcCount").textContent = `${cnt}개 선택`;
      });
    });

    // 자동 채우기
    dp.querySelector("#cdAutoFill").addEventListener("click", () => {
      const map = window.UI_TO_BUILTIN_MAP;
      const uiName = dp.querySelector("#cdRevitUi").value.trim();
      const bid = map?.[uiName];
      if (bid) {
        dp.querySelector("#cdBuiltIn").value = bid;
        toast("success","자동 채우기",`builtInCategory: ${bid}`);
      } else {
        toast("warn","자동 채우기 실패","매핑 데이터에서 찾을 수 없습니다.");
      }
    });

    // 저장 (Apply)
    dp.querySelector("#cdBtnApply").addEventListener("click", () => applyDetail(cat));

    // 삭제
    dp.querySelector("#cdBtnDelete").addEventListener("click", async () => {
      if (!await uiConfirm("카테고리 삭제", `「${cat.revitCategoryUi}」를 삭제할까요?`)) return;
      state.categories = state.categories.filter(c => c.id !== cat.id);
      markDirty();
      closeDetail();
      renderCategories();
      toast("success","삭제 완료",`「${cat.revitCategoryUi}」를 삭제했습니다.`);
    });
  }

  // 공정 체크리스트 빌더 (그룹 > 세부 계층)
  function buildProcessChecks(cat) {
    const processes = state.processes ?? [];
    const selected  = new Set(cat.processIds ?? []);

    function renderProc(parentId, depth) {
      return processes
        .filter(p => (p.parentId || "") === (parentId || ""))
        .sort((a,b) => (a.order??0)-(b.order??0))
        .map(p => {
          const sel = selected.has(p.id);
          const children = renderProc(p.id, depth+1);
          const isGroup  = p.level === "group";
          return `
            <label class="cr-dd-item cr-proc-item depth-${depth}${sel?" selected":""}${isGroup?" is-group":""}">
              <input type="checkbox" value="${escAttr(p.id)}" ${sel?"checked":""} data-multi="processIds" />
              ${isGroup ? `<span class="cr-proc-group-icon">▸</span>` : ""}
              <span class="cr-dd-name">${esc(p.name)}</span>
              ${isGroup ? `<span class="cr-dd-code">${p.level==="group"?"군":""}</span>` : ""}
            </label>
            ${children}`;
        }).join("");
    }

    return renderProc("", 0) || '<div class="cr-empty-hint">공정 데이터 없음</div>';
  }

  // 상세 패널 → state에 반영
  function applyDetail(cat) {
    const dp = els.detailPanel;
    if (!dp) return;

    cat.revitCategoryUi = dp.querySelector("#cdRevitUi")?.value.trim() || cat.revitCategoryUi;
    cat.builtInCategory = dp.querySelector("#cdBuiltIn")?.value.trim() || "";
    cat.revitGroup      = dp.querySelector("#cdRevitGroup")?.value.trim() || cat.revitGroup;
    cat.ifcClass        = dp.querySelector("#cdIfcClass")?.value.trim() || "";
    cat.noteKr          = dp.querySelector("#cdNoteKr")?.value.trim() || "";
    cat.active          = dp.querySelector("#cdActive")?.checked ?? true;
    cat.tradeIds        = [...dp.querySelectorAll("input[data-multi='tradeIds']:checked")].map(c => c.value);
    cat.materialTypeIds = [...dp.querySelectorAll("input[data-multi='materialTypeIds']:checked")].map(c => c.value);
    cat.processIds      = [...dp.querySelectorAll("input[data-multi='processIds']:checked")].map(c => c.value);

    markDirty();
    refreshFilters();
    renderCategories();
    closeDetail();
    toast("success","카테고리 저장",`「${cat.revitCategoryUi}」 변경사항을 적용했습니다.`);
  }

  /* ════════════════════════════════════════════
     전체 render
  ════════════════════════════════════════════ */
  function render() {
    refreshFilters();
    renderMasters();
    renderCategories();
    window.ProcessRegistry?.render?.();
  }

  /* ════════════════════════════════════════════
     CRUD 액션
  ════════════════════════════════════════════ */
  async function addTrade() {
    const name = await uiPrompt("공종 이름", "", "");
    if (name == null || !name.trim()) return;
    const code = await uiPrompt("공종 코드 (영문 약어)", "", slugify(name).toUpperCase().slice(0,6));
    if (code == null) return;
    const maxOrder = Math.max(-1, ...state.trades.map(t => t.order??0));
    state.trades.push({ id: uniqueId("g", state.trades), code: code.trim()||"NEW", name: name.trim(), order: maxOrder+1 });
    markDirty(); render();
    toast("success","공종 추가",`「${name.trim()}」을 추가했습니다.`);
  }

  async function addMaterialType() {
    const name = await uiPrompt("자재 유형 이름", "", "");
    if (name == null || !name.trim()) return;
    const code = await uiPrompt("자재 코드", "", slugify(name).toUpperCase().slice(0,6));
    if (code == null) return;
    const maxOrder = Math.max(-1, ...state.materialTypes.map(m => m.order??0));
    state.materialTypes.push({ id: uniqueId("m", state.materialTypes), code: code.trim()||"NEW", name: name.trim(), order: maxOrder+1 });
    markDirty(); render();
    toast("success","자재 유형 추가",`「${name.trim()}」을 추가했습니다.`);
  }

  async function addCategory() {
    const ui = await uiPrompt("Revit Category (UI 이름)", "", "");
    if (ui == null) return;
    const g = els.groupFilter?.value || uniqueGroups()[0] || "General";
    const newCat = {
      id: uniqueId(ui||"cat", state.categories),
      revitCategoryUi: ui.trim(),
      builtInCategory: "",
      revitGroup: g,
      ifcClass: "", noteKr: "",
      tradeIds: [], materialTypeIds: [], processIds: [],
      active: true,
    };
    state.categories.push(newCat);
    markDirty(); render();
    // 바로 상세 편집 열기
    setTimeout(() => openDetail(newCat.id), 80);
    toast("success","카테고리 추가",`「${ui.trim()||"새 카테고리"}」를 추가했습니다.`);
  }

  function syncFromChecklist() {
    const cl = window.VgChecklist?.getState?.() ?? window.VG_CHECKLIST_DEFAULT;
    const rows = cl?.rows;
    if (!rows?.length) { toast("error","데이터 없음","V/G 체크리스트 데이터를 찾을 수 없습니다."); return; }
    const byUi = new Map(state.categories.map(c => [c.revitCategoryUi.toLowerCase(), c]));
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
      const used = new Set(state.categories.map(c => c.id));
      const id = row.id && !used.has(row.id) ? row.id : uniqueId(ui||row.id, state.categories);
      state.categories.push({
        id, checklistId: row.id,
        revitCategoryUi: ui, builtInCategory: "",
        revitGroup: row.group ?? "", ifcClass: row.ifcClass ?? "", noteKr: row.noteKr ?? "",
        tradeIds: guessTradesFromGroup(row.group), materialTypeIds: [], processIds: [], active: true,
      });
      byUi.set(key, state.categories[state.categories.length-1]);
      added++;
    }
    toast(added?"success":"info","동기화 완료", added ? `${added}개 카테고리를 가져왔습니다.` : "추가할 새 카테고리가 없습니다.");
    markDirty(); render();
  }

  function guessTradesFromGroup(group) {
    const g = (group||"").toLowerCase();
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
    if (!map) { toast("error","데이터 없음","ui-to-builtin 매핑을 불러올 수 없습니다."); return; }
    let n = 0;
    for (const cat of state.categories) {
      if ((cat.builtInCategory||"").trim()) continue;
      const bid = map[(cat.revitCategoryUi||"").trim()];
      if (bid) { cat.builtInCategory = bid; n++; }
    }
    if (n) { markDirty(); render(); toast("success","builtIn 자동채우기",`${n}개를 채웠습니다.`); }
    else toast("info","자동채우기","채울 빈 항목이 없습니다.");
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(state,null,2)], { type:"application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "category-registry.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ════════════════════════════════════════════
     마스터 패널 토글 (view-tab 버튼 방식)
  ════════════════════════════════════════════ */
  function toggleMasters() {
    mastersPanelOpen = !mastersPanelOpen;
    els.mastersWrap?.classList.toggle("open", mastersPanelOpen);
    // view-tab 활성 표시 동기화
    els.masterToggle?.classList.toggle("active", mastersPanelOpen);
    if (mastersPanelOpen) renderMasters();
  }

  /* ════════════════════════════════════════════
     초기화 & 이벤트 바인딩
  ════════════════════════════════════════════ */
  function init() {
    state = loadStorage() ?? loadDefault();
    dirty = false;
    window.UI?.setDirty(TAB_KEY, false);
    render();
  }

  // 버튼 이벤트
  els.btnSave?.addEventListener("click", saveStorage);
  els.btnReset?.addEventListener("click", async () => {
    if (!await uiConfirm("기본값 복원","로컬 저장을 지우고 기본 데이터로 되돌릴까요?\n변경사항은 사라집니다.")) return;
    applyDeployedSeed(loadDefault(), { persist:false });
    toast("info","초기화 완료","기본 데이터로 복원했습니다.");
  });
  els.btnExport?.addEventListener("click", downloadJson);
  els.btnImport?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.categories)) throw new Error();
      if (!await uiConfirm("JSON 가져오기",`「${file.name}」으로 덮어씁니다. 계속할까요?`)) return;
      state = data; markDirty(); render();
      toast("success","가져오기 완료",`「${file.name}」을 불러왔습니다.`);
    } catch { toast("error","형식 오류","올바른 category-registry.json 형식이 아닙니다."); }
  });
  els.btnSyncCl?.addEventListener("click", syncFromChecklist);
  els.btnFillBuiltin?.addEventListener("click", fillBuiltinFromMap);
  els.btnAddCat?.addEventListener("click", addCategory);
  els.btnAddTrade?.addEventListener("click", addTrade);
  els.btnAddMat?.addEventListener("click", addMaterialType);
  els.masterToggle?.addEventListener("click", toggleMasters);

  // 필터
  els.search?.addEventListener("input", renderCategories);
  els.groupFilter?.addEventListener("change", renderCategories);
  els.tradeFilter?.addEventListener("change", renderCategories);
  els.matFilter?.addEventListener("change", renderCategories);
  els.processFilter?.addEventListener("change", renderCategories);
  els.unmappedOnly?.addEventListener("change", renderCategories);
  els.inactiveOnly?.addEventListener("change", renderCategories);

  // 오버레이 클릭 → 닫기
  els.detailOverlay?.addEventListener("click", closeDetail);

  // 키보드
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && els.detailPanel?.classList.contains("open")) closeDetail();
  });

  /* ── 전역 노출 ── */
  function applyDeployedSeed(data, options = {}) {
    const { persist = false } = options;
    if (!Array.isArray(data?.categories)) throw new Error("category-registry 형식이 아닙니다.");
    state = structuredClone(data);
    if (!Array.isArray(state.processes)||!state.processes.length)
      state.processes = structuredClone(window.PROCESS_DATABASE_DEFAULT?.processes ?? []);
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
