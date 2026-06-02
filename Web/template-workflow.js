/**
 * 베이스 View Template -> 하위 View Template -> Revit Preset JSON 워크플로
 */
(function () {
  const STORAGE_KEY = "unitlab-template-library-v1";
  const TAB_KEY     = "workflow";

  /** @type {{ schemaVersion: number, updatedAt: string, nodes: object[] }} */
  let lib = { schemaVersion: 1, updatedAt: "", nodes: [] };

  let selectedId = null;
  let dirty = false;

  const els = {
    panel:          document.getElementById("panel-workflow"),
    tree:           document.getElementById("wfTree"),
    detail:         document.getElementById("wfDetailBody"),   // card-body 타깃 (wfDetail은 카드 wrapper)
    detailTitle:    document.querySelector("#wfDetail .card-head-left h3"), // 카드 헤더 제목
    status:         document.getElementById("wfStatus"),
    btnSave:        document.getElementById("wfBtnSave"),
    btnReset:       document.getElementById("wfBtnReset"),
    btnAddBase:     document.getElementById("wfBtnAddBase"),
    btnAddChild:    document.getElementById("wfBtnAddChild"),
    btnDel:         document.getElementById("wfBtnDel"),
    btnEditVg:      document.getElementById("wfBtnEditVg"),
    btnExportPreset:document.getElementById("wfBtnExportPreset"),
    btnExportAll:   document.getElementById("wfBtnExportAll"),
    btnFillBuiltin: document.getElementById("wfBtnFillBuiltin"),
  };

  if (!els.panel) return;

  /* ── 헬퍼 ── */
  function toast(type, title, message, duration) {
    window.UI?.toast({ type, title, message, duration });
  }

  async function uiConfirm(title, message) {
    if (window.UI?.confirm) return window.UI.confirm({ title, message });
    return window.confirm(`${title}\n${message}`);
  }

  async function uiPrompt(title, defaultValue = "") {
    if (window.UI?.prompt) return window.UI.prompt({ title, defaultValue });
    return window.prompt(title, defaultValue);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function slugify(t) {
    return String(t ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "vt";
  }

  function uniqueId(prefix) {
    const used = new Set(lib.nodes.map((n) => n.id));
    let id = `vt-${slugify(prefix)}`;
    let n = 2;
    while (used.has(id)) { id = `vt-${slugify(prefix)}-${n}`; n++; }
    return id;
  }

  /* ── 데이터 접근 ── */
  function baseNodes() {
    return lib.nodes.filter((n) => n.role === "base" || !n.parentId)
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function childrenOf(parentId) {
    return lib.nodes.filter((n) => n.parentId === parentId)
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function nodeById(id) {
    return lib.nodes.find((n) => n.id === id);
  }

  /* ── 저장/로드 ── */
  function loadDefault() {
    const raw = window.TEMPLATE_LIBRARY_DEFAULT;
    return raw?.nodes ? structuredClone(raw) : { schemaVersion: 1, updatedAt: "", nodes: [] };
  }

  function loadStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return Array.isArray(d.nodes) ? d : null;
    } catch { return null; }
  }

  function saveStorage() {
    lib.updatedAt = new Date().toISOString().slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lib));
    dirty = false;
    window.UI?.setDirty(TAB_KEY, false);
    updateStatus();
    toast("success", "저장 완료", `템플릿 라이브러리를 브라우저에 저장했습니다.`);
  }

  function markDirty() {
    dirty = true;
    window.UI?.setDirty(TAB_KEY, true);
    updateStatus();
  }

  /* ── 상태 표시 ── */
  function updateStatus() {
    if (!els.status) return;
    const bases   = baseNodes().length;
    const derived = lib.nodes.filter((n) => n.role === "derived" && n.parentId).length;
    const suffix  = dirty ? " · 💾 저장 안 됨" : " · 저장됨";
    els.status.textContent = `베이스 ${bases} · 하위 ${derived} · 총 ${lib.nodes.length}개${suffix}`;
  }

  /* ── Preset 생성 ── */
  function nodeToPreset(node) {
    if (window.VgChecklist?.buildPresetForNode) {
      return window.VgChecklist.buildPresetForNode(node);
    }
    return {
      preset: {
        templateName:      node.revitTemplateName || node.name,
        viewType:          node.viewType || "FloorPlan",
        properties:        node.properties ?? {},
        categoryOverrides: [],
      },
      warnings: ["V/G 체크리스트 미로드"],
      errors:   [],
      blocked:  false,
    };
  }

  /* ── 트리 렌더 ── */
  function renderTree() {
    els.tree.innerHTML = "";

    if (!lib.nodes.length) {
      els.tree.innerHTML = `
        <div class="wf-tree-empty">
          <span class="empty-icon">🗂</span>
          <div>베이스 View Template을 추가하세요.</div>
          <div style="font-size:.73rem;margin-top:.2rem;color:var(--tx-4)">툴바의 「+ 베이스 VT」 버튼 클릭</div>
        </div>`;
      return;
    }

    for (const base of baseNodes()) {
      appendTreeNode(base, false);
      for (const child of childrenOf(base.id)) {
        appendTreeNode(child, true);
      }
    }
  }

  function appendTreeNode(node, isChild) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `wf-node${isChild ? " child" : ""}${node.id === selectedId ? " active" : ""}`;
    btn.dataset.id = node.id;
    btn.title = node.description || node.name;
    btn.innerHTML = `
      <span class="wf-node-type">${node.role === "derived" ? "하위" : "베이스"}</span>
      <span class="wf-node-name">${escapeHtml(node.name)}</span>
    `;
    btn.addEventListener("click", () => selectNode(node.id));
    els.tree.appendChild(btn);
  }

  function selectNode(id) {
    selectedId = id;
    renderTree();
    renderDetail();
  }

  /* ── 상세 렌더 ── */
  function renderDetail() {
    const node = selectedId ? nodeById(selectedId) : null;

    // 카드 헤더 제목 업데이트
    if (els.detailTitle) {
      els.detailTitle.textContent = node ? `상세 편집 — ${node.name}` : "상세 편집";
    }

    if (!node) {
      els.detail.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem 1rem;color:var(--tx-4);gap:.65rem;text-align:center;">
          <span style="font-size:2.5rem;opacity:.4">👈</span>
          <span style="font-size:.85rem;">트리에서 View Template을 선택하세요</span>
        </div>`;
      return;
    }

    const parent     = node.parentId ? nodeById(node.parentId) : null;
    const crState    = window.CategoryRegistry?.getState?.();
    const processOpts = window.ProcessRegistry?.processOptionsHtml?.(crState, node.processId ? [node.processId] : [], false) ?? "";

    els.detail.innerHTML = `
      <p class="hint" style="margin-bottom:.75rem">${escapeHtml(node.description || "")}</p>
      <div class="wf-form">
        <label>표시 이름
          <input type="text" data-f="name" value="${escapeHtml(node.name)}" />
        </label>
        <label>Revit 템플릿 이름
          <input type="text" data-f="revitTemplateName" value="${escapeHtml(node.revitTemplateName || "")}" />
        </label>
        <label>역할
          <select data-f="role">
            <option value="base"    ${node.role === "base"    ? "selected" : ""}>베이스</option>
            <option value="derived" ${node.role === "derived" ? "selected" : ""}>하위 (derived)</option>
          </select>
        </label>
        <label>부모 (베이스)
          <select data-f="parentId">
            <option value="">(없음 — 베이스)</option>
            ${baseNodes()
              .map((b) => `<option value="${b.id}" ${node.parentId === b.id ? "selected" : ""}>${escapeHtml(b.name)}</option>`)
              .join("")}
          </select>
        </label>
        <label class="inline-check" style="margin:0">
          <input type="checkbox" data-f="inheritParentVg" ${node.inheritParentVg ? "checked" : ""} />
          부모 V/G 상속 (③에서 이 노드만 편집; export는 조상 병합 full)
        </label>
        <label>viewType
          <select data-f="viewType">
            <option value="FloorPlan"   ${node.viewType === "FloorPlan"   ? "selected" : ""}>FloorPlan</option>
            <option value="CeilingPlan" ${node.viewType === "CeilingPlan" ? "selected" : ""}>CeilingPlan</option>
          </select>
        </label>
        <label>관련 모듈러 공정
          <select data-f="processId">
            <option value="">(없음)</option>
            ${processOpts}
          </select>
        </label>
        <label>discipline
          <input type="text" data-f="discipline" value="${escapeHtml(node.properties?.discipline ?? "")}" />
        </label>
        <label>detailLevel
          <select data-f="detailLevel">
            <option value="">(없음)</option>
            <option value="Coarse" ${node.properties?.detailLevel === "Coarse" ? "selected" : ""}>Coarse</option>
            <option value="Medium" ${node.properties?.detailLevel === "Medium" ? "selected" : ""}>Medium</option>
            <option value="Fine"   ${node.properties?.detailLevel === "Fine"   ? "selected" : ""}>Fine</option>
          </select>
        </label>
        ${parent ? `<p class="hint">부모: <strong>${escapeHtml(parent.name)}</strong> — 하위는 부모와 동일한 V/G는 Preset에서 생략됩니다.</p>` : ""}
      </div>

      <section class="wf-flow card" style="margin-bottom:.75rem">
        <h4 style="margin:0 0 .5rem;font-size:.85rem">생성 흐름</h4>
        <ol class="wf-steps">
          <li class="${node.role === "base" ? "done" : ""}">① 베이스 정의</li>
          <li class="done">② V/G 체크리스트에서 ON·HT·%·재지정 (이 노드 ID)</li>
          <li class="${node.role === "derived" && node.parentId ? "done" : ""}">③ 하위 VT — export 시 조상 병합 full Preset</li>
          <li>④ Preset JSON → Revit 애드인 「Preset에서 View Template 생성」</li>
        </ol>
      </section>

      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem">
        <span style="font-size:.75rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Preset 미리보기</span>
        <button type="button" id="wfPreviewRefresh" class="btn-icon" style="font-size:.75rem;padding:.15rem .45rem;" title="새로고침">↺</button>
      </div>
      <pre class="wf-preview" id="wfPresetPreview"></pre>
    `;

    // 폼 이벤트 바인딩
    els.detail.querySelectorAll("[data-f]").forEach((el) => {
      const apply = () => {
        const f = el.dataset.f;
        if (f === "role") {
          node.role = el.value;
          if (node.role === "base") { node.parentId = null; node.inheritParentVg = false; }
        } else if (f === "parentId") {
          node.parentId = el.value || null;
          if (node.parentId) node.role = "derived";
        } else if (f === "inheritParentVg") {
          node.inheritParentVg = el.checked;
        } else if (f === "viewType") {
          node.viewType = el.value;
        } else if (f === "processId") {
          node.processId = el.value || null;
        } else if (f === "discipline" || f === "detailLevel") {
          node.properties = node.properties ?? {};
          node.properties[f] = el.value;
        } else {
          node[f] = el.value;
          if (f === "name" && !node.revitTemplateName) node.revitTemplateName = el.value;
        }
        markDirty();
        refreshPreview();
        if (f === "role" || f === "parentId") { renderTree(); renderDetail(); }
      };
      if (el.type === "checkbox") el.addEventListener("change", apply);
      else el.addEventListener("change", apply);
      if (el.tagName === "INPUT") el.addEventListener("input", apply);
    });

    document.getElementById("wfPreviewRefresh")?.addEventListener("click", refreshPreview);
    refreshPreview();
  }

  function refreshPreview() {
    const pre = document.getElementById("wfPresetPreview");
    if (!pre || !selectedId) return;
    const node = nodeById(selectedId);
    if (!node) return;
    const { preset, warnings, errors, blocked } = nodeToPreset(node);
    let prefix = "";
    if (blocked) {
      prefix = `// ❌ 오류 — Preset export 불가:\n${(errors ?? []).map((e) => `//   ${e}`).join("\n")}\n\n`;
    } else if (warnings?.length) {
      prefix = `// ⚠ 경고: ${warnings.join("; ")}\n`;
    }
    pre.textContent = prefix + JSON.stringify(preset, null, 2);
  }

  /* ── 다운로드 ── */
  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ── CRUD ── */
  async function addBase() {
    const name = await uiPrompt("베이스 View Template 이름", "A_새_베이스_평면");
    if (name == null || !name.trim()) return;
    const id = uniqueId(name);
    lib.nodes.push({
      id,
      name:             name.trim(),
      role:             "base",
      parentId:         null,
      order:            baseNodes().length,
      viewType:         "FloorPlan",
      properties:       { discipline: "Architectural", detailLevel: "Medium" },
      inheritParentVg:  false,
      description:      "",
      revitTemplateName: name.trim(),
    });
    window.VgChecklist?.ensureVgSlot?.(id);
    markDirty();
    selectNode(id);
    toast("success", "베이스 VT 추가", `「${name.trim()}」을 추가했습니다.`);
  }

  async function addChild() {
    const parentId = selectedId && nodeById(selectedId)?.role === "base"
      ? selectedId
      : baseNodes()[0]?.id;

    if (!parentId) {
      toast("warn", "베이스 필요", "먼저 베이스 View Template을 만드세요.");
      return;
    }

    const name = await uiPrompt("하위 View Template 이름", "A_새_하위도면");
    if (name == null || !name.trim()) return;

    const parent = nodeById(parentId);
    const id = uniqueId(name);
    lib.nodes.push({
      id,
      name:             name.trim(),
      role:             "derived",
      parentId,
      order:            childrenOf(parentId).length,
      viewType:         parent?.viewType ?? "FloorPlan",
      properties:       { ...(parent?.properties ?? {}) },
      inheritParentVg:  true,
      description:      "",
      revitTemplateName: name.trim(),
    });
    window.VgChecklist?.ensureVgSlot?.(id);
    markDirty();
    selectNode(id);
    toast("success", "하위 VT 추가", `「${name.trim()}」을 추가했습니다.`);
  }

  async function deleteNode() {
    if (!selectedId) {
      toast("info", "선택 필요", "삭제할 View Template을 먼저 선택하세요.");
      return;
    }
    const node = nodeById(selectedId);
    const ok = await uiConfirm(
      `「${node?.name}」 삭제`,
      node?.role === "base"
        ? "베이스 VT와 그 하위 VT를 모두 삭제합니다. 계속할까요?"
        : "이 하위 VT를 삭제합니다. 계속할까요?"
    );
    if (!ok) return;

    const deletedName = node?.name;
    lib.nodes = lib.nodes.filter((n) => n.id !== selectedId && n.parentId !== selectedId);
    markDirty();
    selectedId = baseNodes()[0]?.id || null;
    renderTree();
    renderDetail();
    toast("success", "삭제 완료", `「${deletedName}」을 삭제했습니다.`);
  }

  function openChecklistForNode() {
    const node = selectedId ? nodeById(selectedId) : null;
    if (!node) {
      toast("info", "선택 필요", "V/G를 편집할 View Template을 선택하세요.");
      return;
    }
    window.VgChecklist?.setActiveViewTemplate?.(node.id);
  }

  async function fillBuiltinInRegistry() {
    const map = window.UI_TO_BUILTIN_MAP;
    const reg = window.CategoryRegistry;
    if (!map || !reg?.getState) {
      toast("error", "데이터 없음", "카테고리·공종 데이터를 불러올 수 없습니다.");
      return;
    }
    const state = reg.getState();
    let n = 0;
    for (const cat of state.categories) {
      if ((cat.builtInCategory || "").trim()) continue;
      const bid = map[(cat.revitCategoryUi || "").trim()];
      if (bid) { cat.builtInCategory = bid; n++; }
    }
    if (n) {
      reg.refresh?.();
      toast("success", "builtIn 자동채우기", `${n}개 builtInCategory를 채웠습니다. 카테고리·공종 탭에서 저장하세요.`);
    } else {
      toast("info", "자동채우기", "채울 빈 항목이 없습니다.");
    }
  }

  function applyDeployedSeed(data, options = {}) {
    const { persist = false } = options;
    if (!Array.isArray(data?.nodes)) throw new Error("template-library 형식이 아닙니다.");
    lib = {
      schemaVersion: data.schemaVersion ?? 1,
      updatedAt:     data.updatedAt ?? "",
      nodes:         data.nodes.map((n) => ({ ...n })),
    };
    dirty = false;
    window.UI?.setDirty(TAB_KEY, false);
    if (persist) saveStorage();
    else localStorage.removeItem(STORAGE_KEY);
    selectedId = baseNodes()[0]?.id ?? null;
    renderTree();
    renderDetail();
    updateStatus();
    for (const n of lib.nodes) window.VgChecklist?.ensureVgSlot?.(n.id);
  }

  /* ── 초기화 ── */
  function init() {
    lib    = loadStorage() ?? loadDefault();
    dirty  = false;
    window.UI?.setDirty(TAB_KEY, false);
    selectedId = baseNodes()[0]?.id ?? null;
    renderTree();
    renderDetail();
    updateStatus();
  }

  /* ── 이벤트 바인딩 ── */
  els.btnSave?.addEventListener("click", saveStorage);

  els.btnReset?.addEventListener("click", async () => {
    const ok = await uiConfirm(
      "기본 예시 복원",
      "템플릿 라이브러리를 기본값으로 되돌릴까요? 저장되지 않은 변경사항은 사라집니다."
    );
    if (!ok) return;
    applyDeployedSeed(loadDefault(), { persist: false });
    toast("info", "초기화 완료", "기본 예시 데이터로 복원했습니다.");
  });

  els.btnAddBase?.addEventListener("click",  addBase);
  els.btnAddChild?.addEventListener("click", addChild);
  els.btnDel?.addEventListener("click",      deleteNode);
  els.btnEditVg?.addEventListener("click",   openChecklistForNode);
  els.btnFillBuiltin?.addEventListener("click", fillBuiltinInRegistry);

  els.btnExportPreset?.addEventListener("click", () => {
    const node = selectedId ? nodeById(selectedId) : null;
    if (!node) {
      toast("info", "선택 필요", "Preset으로 내보낼 View Template을 선택하세요.");
      return;
    }
    const result = nodeToPreset(node);
    if (result.blocked) {
      toast("error", "Export 불가", (window.VgChecklist?.formatPresetBlockMessage?.(result) ?? result.errors?.join("\n")).slice(0, 200));
      return;
    }
    if (result.warnings?.length) console.warn(result.warnings);
    const safe = (result.preset.templateName || "preset").replace(/[^\w가-힣.-]+/g, "_");
    downloadJson(`${safe}.json`, result.preset);
    toast("success", "Preset JSON", `「${result.preset.templateName}」 다운로드했습니다.`);
  });

  els.btnExportAll?.addEventListener("click", () => {
    const manifest = { exportedAt: new Date().toISOString(), presets: [], blocked: [] };
    let ok = 0;
    for (const node of lib.nodes) {
      const result = nodeToPreset(node);
      if (result.blocked) {
        manifest.blocked.push({ nodeId: node.id, name: node.name, errors: result.errors });
        continue;
      }
      ok++;
      if (result.warnings?.length) console.warn(node.name, result.warnings);
      manifest.presets.push({
        nodeId: node.id, role: node.role, parentId: node.parentId,
        file: `${(result.preset.templateName || node.id).replace(/[^\w가-힣.-]+/g, "_")}.json`,
        warnings: result.warnings, preset: result.preset,
      });
      downloadJson(manifest.presets[manifest.presets.length - 1].file, result.preset);
    }
    downloadJson("revit-export-manifest.json", manifest);

    if (manifest.blocked.length) {
      toast("warn", `${ok}개 완료 · ${manifest.blocked.length}개 건너뜀`,
        `[중요] builtIn 미비: ${manifest.blocked.map((b) => b.name).join(", ")}`,
        6000);
    } else {
      toast("success", "전체 Preset 전송 완료", `${ok}개 파일을 내보냈습니다.`);
    }
  });

  /* ── 전역 노출 ── */
  window.TemplateWorkflow = {
    getLibrary:      () => lib,
    getNodes:        () => lib.nodes,
    nodeToPreset,
    refreshPreview,
    applyDeployedSeed,
  };

  init();
})();
