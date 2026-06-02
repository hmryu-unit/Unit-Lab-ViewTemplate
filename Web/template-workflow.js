/**
 * 베이스 View Template -> 하위 View Template -> Revit Preset JSON 워크플로
 */
(function () {
  const STORAGE_KEY = "unitlab-template-library-v1";

  /** @type {{ schemaVersion: number, updatedAt: string, nodes: object[] }} */
  let lib = { schemaVersion: 1, updatedAt: "", nodes: [] };

  let selectedId = null;
  let dirty = false;

  const els = {
    panel: document.getElementById("panel-workflow"),
    tree: document.getElementById("wfTree"),
    detail: document.getElementById("wfDetail"),
    status: document.getElementById("wfStatus"),
    btnSave: document.getElementById("wfBtnSave"),
    btnReset: document.getElementById("wfBtnReset"),
    btnAddBase: document.getElementById("wfBtnAddBase"),
    btnAddChild: document.getElementById("wfBtnAddChild"),
    btnDel: document.getElementById("wfBtnDel"),
    btnEditVg: document.getElementById("wfBtnEditVg"),
    btnExportPreset: document.getElementById("wfBtnExportPreset"),
    btnExportAll: document.getElementById("wfBtnExportAll"),
    btnFillBuiltin: document.getElementById("wfBtnFillBuiltin"),
  };

  if (!els.panel) return;

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
    } catch {
      return null;
    }
  }

  function saveStorage() {
    lib.updatedAt = new Date().toISOString().slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lib));
    dirty = false;
    updateStatus();
  }

  function markDirty() {
    dirty = true;
    updateStatus();
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
    while (used.has(id)) {
      id = `vt-${slugify(prefix)}-${n}`;
      n++;
    }
    return id;
  }

  function baseNodes() {
    return lib.nodes.filter((n) => n.role === "base" || !n.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function childrenOf(parentId) {
    return lib.nodes.filter((n) => n.parentId === parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function nodeById(id) {
    return lib.nodes.find((n) => n.id === id);
  }

  function updateStatus() {
    const bases = baseNodes().length;
    const derived = lib.nodes.filter((n) => n.role === "derived" && n.parentId).length;
    const suffix = dirty ? " · 저장 안 됨" : "";
    els.status.textContent = `베이스 ${bases} · 하위 ${derived} · 총 ${lib.nodes.length}개${suffix}`;
  }

  function nodeToPreset(node) {
    if (window.VgChecklist?.buildPresetForNode) {
      return window.VgChecklist.buildPresetForNode(node);
    }
    return {
      preset: {
        templateName: node.revitTemplateName || node.name,
        viewType: node.viewType || "FloorPlan",
        properties: node.properties ?? {},
        categoryOverrides: [],
      },
      warnings: ["V/G 체크리스트 미로드"],
      errors: [],
      blocked: false,
    };
  }

  function renderTree() {
    els.tree.innerHTML = "";
    for (const base of baseNodes()) {
      appendTreeNode(base, 0);
      for (const child of childrenOf(base.id)) {
        appendTreeNode(child, 1);
      }
    }
    if (!lib.nodes.length) {
      els.tree.innerHTML = '<p class="wf-empty">베이스 View Template을 추가하세요.</p>';
    }
  }

  function appendTreeNode(node, depth) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `wf-tree-item depth-${depth}${node.id === selectedId ? " active" : ""}`;
    btn.dataset.id = node.id;
    const role = node.role === "derived" ? "하위" : "베이스";
    btn.innerHTML = `<span class="wf-role">${role}</span><span class="wf-name">${escapeHtml(node.name)}</span>`;
    btn.addEventListener("click", () => selectNode(node.id));
    els.tree.appendChild(btn);
  }

  function selectNode(id) {
    selectedId = id;
    renderTree();
    renderDetail();
  }

  function renderDetail() {
    const node = selectedId ? nodeById(selectedId) : null;
    if (!node) {
      els.detail.innerHTML = '<p class="hint">트리에서 View Template을 선택하세요.</p>';
      return;
    }
    const parent = node.parentId ? nodeById(node.parentId) : null;
    els.detail.innerHTML = `
      <h3>${escapeHtml(node.name)}</h3>
      <p class="hint">${escapeHtml(node.description || "")}</p>
      <div class="wf-form">
        <label>표시 이름 <input type="text" data-f="name" value="${escapeHtml(node.name)}" /></label>
        <label>Revit 템플릿 이름 <input type="text" data-f="revitTemplateName" value="${escapeHtml(node.revitTemplateName || "")}" /></label>
        <label>역할
          <select data-f="role">
            <option value="base" ${node.role === "base" ? "selected" : ""}>베이스</option>
            <option value="derived" ${node.role === "derived" ? "selected" : ""}>하위 (derived)</option>
          </select>
        </label>
        <label>부모 (베이스)
          <select data-f="parentId">
            <option value="">(없음 — 베이스)</option>
            ${baseNodes()
              .map(
                (b) =>
                  `<option value="${b.id}" ${node.parentId === b.id ? "selected" : ""}>${escapeHtml(b.name)}</option>`
              )
              .join("")}
          </select>
        </label>
        <label class="inline-check"><input type="checkbox" data-f="inheritParentVg" ${node.inheritParentVg ? "checked" : ""} /> 부모 V/G 상속 (③에서 이 노드만 편집; export는 조상 병합 full)</label>
        <label>viewType
          <select data-f="viewType">
            <option value="FloorPlan" ${node.viewType === "FloorPlan" ? "selected" : ""}>FloorPlan</option>
            <option value="CeilingPlan" ${node.viewType === "CeilingPlan" ? "selected" : ""}>CeilingPlan</option>
          </select>
        </label>
        <label>discipline <input type="text" data-f="discipline" value="${escapeHtml(node.properties?.discipline ?? "")}" /></label>
        <label>detailLevel
          <select data-f="detailLevel">
            <option value="">(없음)</option>
            <option value="Coarse" ${node.properties?.detailLevel === "Coarse" ? "selected" : ""}>Coarse</option>
            <option value="Medium" ${node.properties?.detailLevel === "Medium" ? "selected" : ""}>Medium</option>
            <option value="Fine" ${node.properties?.detailLevel === "Fine" ? "selected" : ""}>Fine</option>
          </select>
        </label>
        ${parent ? `<p class="hint">부모: <strong>${escapeHtml(parent.name)}</strong> — 하위는 부모와 동일한 V/G는 Preset에서 생략됩니다.</p>` : ""}
      </div>
      <section class="wf-flow card">
        <h4>생성 흐름</h4>
        <ol class="wf-steps">
          <li class="${node.role === "base" ? "done" : ""}">① 베이스 정의</li>
          <li class="done">② V/G 체크리스트에서 ON·HT·%·재지정 (이 노드 ID)</li>
          <li class="${node.role === "derived" && node.parentId ? "done" : ""}">③ 하위 VT — export 시 <em>조상 병합</em> full Preset (ADR-0001)</li>
          <li>④ Preset JSON → Revit 애드인 「Preset에서 View Template 생성」</li>
        </ol>
      </section>
      <pre class="wf-preview" id="wfPresetPreview"></pre>
    `;

    els.detail.querySelectorAll("[data-f]").forEach((el) => {
      const apply = () => {
        const f = el.dataset.f;
        if (f === "role") {
          node.role = el.value;
          if (node.role === "base") {
            node.parentId = null;
            node.inheritParentVg = false;
          }
        } else if (f === "parentId") {
          node.parentId = el.value || null;
          if (node.parentId) node.role = "derived";
        } else if (f === "inheritParentVg") {
          node.inheritParentVg = el.checked;
        } else if (f === "viewType") {
          node.viewType = el.value;
        } else if (f === "discipline" || f === "detailLevel") {
          node.properties = node.properties ?? {};
          node.properties[f] = el.value;
        } else {
          node[f] = el.value;
          if (f === "name" && !node.revitTemplateName) node.revitTemplateName = el.value;
        }
        markDirty();
        refreshPreview();
        if (f === "role" || f === "parentId") {
          renderTree();
          renderDetail();
        }
      };
      if (el.type === "checkbox") el.addEventListener("change", apply);
      else el.addEventListener("change", apply);
      if (el.tagName === "INPUT") el.addEventListener("input", apply);
    });
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
      prefix = `// 오류 — Preset export 불가:\n${(errors ?? []).map((e) => `//   ${e}`).join("\n")}\n\n`;
    } else if (warnings?.length) {
      prefix = `// 경고: ${warnings.join("; ")}\n`;
    }
    pre.textContent = prefix + JSON.stringify(preset, null, 2);
  }

  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function addBase() {
    const name = prompt("베이스 View Template 이름", "A_새_베이스_평면");
    if (name == null || !name.trim()) return;
    const id = uniqueId(name);
    lib.nodes.push({
      id,
      name: name.trim(),
      role: "base",
      parentId: null,
      order: baseNodes().length,
      viewType: "FloorPlan",
      properties: { discipline: "Architectural", detailLevel: "Medium" },
      inheritParentVg: false,
      description: "",
      revitTemplateName: name.trim(),
    });
    window.VgChecklist?.ensureVgSlot?.(id);
    markDirty();
    selectNode(id);
  }

  function addChild() {
    const parentId = selectedId && nodeById(selectedId)?.role === "base" ? selectedId : baseNodes()[0]?.id;
    if (!parentId) {
      alert("먼저 베이스 View Template을 만드세요.");
      return;
    }
    const name = prompt("하위 View Template 이름", "A_새_하위도면");
    if (name == null || !name.trim()) return;
    const parent = nodeById(parentId);
    const id = uniqueId(name);
    lib.nodes.push({
      id,
      name: name.trim(),
      role: "derived",
      parentId,
      order: childrenOf(parentId).length,
      viewType: parent?.viewType ?? "FloorPlan",
      properties: { ...(parent?.properties ?? {}) },
      inheritParentVg: true,
      description: "",
      revitTemplateName: name.trim(),
    });
    window.VgChecklist?.ensureVgSlot?.(id);
    markDirty();
    selectNode(id);
  }

  function deleteNode() {
    if (!selectedId) return;
    const node = nodeById(selectedId);
    if (!confirm(`「${node?.name}」을 삭제할까요?`)) return;
    const childIds = childrenOf(selectedId).map((c) => c.id);
    lib.nodes = lib.nodes.filter((n) => n.id !== selectedId && n.parentId !== selectedId);
    markDirty();
    selectedId = childIds[0] || baseNodes()[0]?.id || null;
    renderTree();
    renderDetail();
  }

  function openChecklistForNode() {
    const node = selectedId ? nodeById(selectedId) : null;
    if (!node) {
      alert("View Template을 선택하세요.");
      return;
    }
    window.VgChecklist?.setActiveViewTemplate?.(node.id);
  }

  function fillBuiltinInRegistry() {
    const map = window.UI_TO_BUILTIN_MAP;
    const reg = window.CategoryRegistry;
    if (!map || !reg?.getState) {
      alert("카테고리·공종 데이터를 불러올 수 없습니다.");
      return;
    }
    const state = reg.getState();
    let n = 0;
    for (const cat of state.categories) {
      if ((cat.builtInCategory || "").trim()) continue;
      const ui = (cat.revitCategoryUi || "").trim();
      const bid = map[ui];
      if (bid) {
        cat.builtInCategory = bid;
        n++;
      }
    }
    if (n) {
      reg.refresh?.();
      alert(`${n}개 builtInCategory를 채웠습니다. 카테고리·공종 탭에서 저장하세요.`);
    } else alert("채울 빈 항목이 없습니다.");
  }

  function applyDeployedSeed(data, options = {}) {
    const { persist = false } = options;
    if (!Array.isArray(data?.nodes)) throw new Error("template-library 형식이 아닙니다.");
    lib = {
      schemaVersion: data.schemaVersion ?? 1,
      updatedAt: data.updatedAt ?? "",
      nodes: data.nodes.map((n) => ({ ...n })),
    };
    dirty = false;
    if (persist) saveStorage();
    else localStorage.removeItem(STORAGE_KEY);
    selectedId = baseNodes()[0]?.id ?? null;
    renderTree();
    renderDetail();
    updateStatus();
    for (const n of lib.nodes) window.VgChecklist?.ensureVgSlot?.(n.id);
  }

  function init() {
    lib = loadStorage() ?? loadDefault();
    dirty = false;
    selectedId = baseNodes()[0]?.id ?? null;
    renderTree();
    renderDetail();
    updateStatus();
  }

  els.btnSave?.addEventListener("click", () => {
    saveStorage();
    alert("저장했습니다.");
  });
  els.btnReset?.addEventListener("click", () => {
    if (!confirm("템플릿 라이브러리를 기본값으로 되돌릴까요?")) return;
    applyDeployedSeed(loadDefault(), { persist: false });
  });
  els.btnAddBase?.addEventListener("click", addBase);
  els.btnAddChild?.addEventListener("click", addChild);
  els.btnDel?.addEventListener("click", deleteNode);
  els.btnEditVg?.addEventListener("click", openChecklistForNode);
  els.btnFillBuiltin?.addEventListener("click", fillBuiltinInRegistry);
  els.btnExportPreset?.addEventListener("click", () => {
    const node = selectedId ? nodeById(selectedId) : null;
    if (!node) return;
    const result = nodeToPreset(node);
    if (result.blocked) {
      alert(window.VgChecklist?.formatPresetBlockMessage?.(result) ?? result.errors?.join("\n"));
      return;
    }
    if (result.warnings?.length) console.warn(result.warnings);
    const safe = (result.preset.templateName || "preset").replace(/[^\w가-힣.-]+/g, "_");
    downloadJson(`${safe}.json`, result.preset);
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
        nodeId: node.id,
        role: node.role,
        parentId: node.parentId,
        file: `${(result.preset.templateName || node.id).replace(/[^\w가-힣.-]+/g, "_")}.json`,
        warnings: result.warnings,
        preset: result.preset,
      });
      downloadJson(`${manifest.presets[manifest.presets.length - 1].file}`, result.preset);
    }
    downloadJson("revit-export-manifest.json", manifest);
    if (manifest.blocked.length) {
      const names = manifest.blocked.map((b) => b.name).join(", ");
      alert(
        `${ok}개 Preset보냄. ${manifest.blocked.length}개는 [중요] 카테고리 builtIn 미비로 건너뜀:\n${names}\n\nmanifest.blocked를 확인하세요.`
      );
    }
  });

  window.TemplateWorkflow = {
    getLibrary: () => lib,
    getNodes: () => lib.nodes,
    nodeToPreset,
    refreshPreview,
    applyDeployedSeed,
  };

  init();
})();
