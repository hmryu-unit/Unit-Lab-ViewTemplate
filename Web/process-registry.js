/**
 * 모듈러 공정 DB UI (② 카테고리 · 공종 탭 하단)
 */
(function () {
  /* ── UI 헬퍼 ── */
  function toast(type, title, message, duration) {
    window.UI?.toast({ type, title, message, duration });
  }

  async function uiConfirm(title, message) {
    if (window.UI?.confirm) return window.UI.confirm({ title, message });
    return window.confirm(`${title}\n${message}`);
  }

  const els = {
    body: document.getElementById("crProcessesBody"),
    detail: document.getElementById("crProcessDetail"),
    filter: document.getElementById("crProcessFilter"),
    btnReload: document.getElementById("crBtnReloadProcess"),
    groupOnly: document.getElementById("crProcessGroupOnly"),
  };

  if (!els.body) return;

  function getState() {
    return window.CategoryRegistry?.getState?.() ?? null;
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

  function processMap(state) {
    return new Map((state?.processes ?? []).map((p) => [p.id, p]));
  }

  function processLabel(map, id) {
    const p = map.get(id);
    return p ? p.name : id;
  }

  function sortedProcesses(state) {
    const list = state?.processes ?? [];
    const byParent = new Map();
    for (const p of list) {
      const key = p.parentId || "";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(p);
    }
    for (const arr of byParent.values()) {
      arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    const out = [];
    function walk(parentId, depth) {
      for (const p of byParent.get(parentId || "") ?? []) {
        out.push({ ...p, depth });
        walk(p.id, depth + 1);
      }
    }
    walk("", 0);
    return out;
  }

  function tradeLabels(state, tradeIds) {
    const m = new Map((state?.trades ?? []).map((t) => [t.id, t]));
    return (tradeIds ?? []).map((id) => m.get(id)?.name ?? id).join(", ");
  }

  function renderDetail(state, proc) {
    if (!els.detail) return;
    if (!proc) {
      els.detail.innerHTML = "<p class=\"hint\">공정 행을 클릭하면 설명·선후행·연결 공종을 표시합니다.</p>";
      return;
    }
    const pmap = processMap(state);
    const pre = (proc.predecessorIds ?? []).map((id) => processLabel(pmap, id)).join(" → ") || "—";
    const suc = (proc.successorIds ?? []).map((id) => processLabel(pmap, id)).join(" → ") || "—";
    els.detail.innerHTML = `
      <h3>${escapeHtml(proc.name)} <span class="proc-level">${proc.level === "group" ? "공정군" : "세부"}</span></h3>
      <p>${escapeHtml(proc.description || "")}</p>
      <dl class="proc-meta">
        <dt>선행</dt><dd>${escapeHtml(pre)}</dd>
        <dt>후속</dt><dd>${escapeHtml(suc)}</dd>
        <dt>연결 공종</dt><dd>${escapeHtml(tradeLabels(state, proc.tradeIds))}</dd>
        <dt>BIM 코드</dt><dd>${escapeHtml(proc.bimCode || "—")}</dd>
        <dt>시방서</dt><dd>${escapeHtml(proc.specRef || "—")}</dd>
      </dl>
    `;
  }

  function render() {
    const state = getState();
    if (!state) return;

    const groupOnly = els.groupOnly?.checked;
    const filterId = els.filter?.value ?? "";
    const pmap = processMap(state);
    const flat = sortedProcesses(state).filter((p) => {
      if (groupOnly && p.level !== "group") return false;
      if (filterId && p.id !== filterId && p.parentId !== filterId) return false;
      return true;
    });

    els.body.innerHTML = "";
    let selected = null;

    for (const p of flat) {
      const tr = document.createElement("tr");
      tr.className = `proc-row depth-${p.depth} level-${p.level}`;
      const pre = (p.predecessorIds ?? []).map((id) => processLabel(pmap, id)).join(", ") || "—";
      const suc = (p.successorIds ?? []).map((id) => processLabel(pmap, id)).join(", ") || "—";
      tr.innerHTML = `
        <td class="proc-name-cell" style="padding-left:${0.6 + p.depth * 1.1}rem">
          ${p.level === "group" ? "<strong>" : ""}${escapeHtml(p.name)}${p.level === "group" ? "</strong>" : ""}
        </td>
        <td>${p.level === "group" ? "군" : "세부"}</td>
        <td class="proc-links">${escapeHtml(pre)}</td>
        <td class="proc-links">${escapeHtml(suc)}</td>
        <td>${escapeHtml(tradeLabels(state, p.tradeIds))}</td>
      `;
      tr.addEventListener("click", () => {
        els.body.querySelectorAll(".proc-row").forEach((r) => r.classList.remove("selected"));
        tr.classList.add("selected");
        renderDetail(state, p);
      });
      els.body.appendChild(tr);
    }

    if (!flat.length) {
      els.body.innerHTML = '<tr><td colspan="5" class="empty-row">표시할 공정이 없습니다.</td></tr>';
    }

    refreshProcessFilter(state);
    if (!selected && flat.length) renderDetail(state, flat[0]);
  }

  function refreshProcessFilter(state) {
    if (!els.filter) return;
    const cur = els.filter.value;
    const groups = (state?.processes ?? []).filter((p) => p.level === "group");
    els.filter.innerHTML =
      '<option value="">전체 공정군</option>' +
      groups.map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)}</option>`).join("");
    if ([...els.filter.options].some((o) => o.value === cur)) els.filter.value = cur;
  }

  async function reloadFromSeed() {
    const ok = await uiConfirm(
      "공정 DB 복원",
      "공정 DB를 배포 시드(process-database)로 되돌릴까요?\n현재 편집 내용은 사라집니다."
    );
    if (!ok) return;
    const seed = window.PROCESS_DATABASE_DEFAULT?.processes;
    if (!seed?.length) {
      toast("error", "데이터 없음", "process-database-data.js를 불러올 수 없습니다.");
      return;
    }
    const state = getState();
    if (!state) return;
    state.processes = structuredClone(seed);
    window.CategoryRegistry?.markDirty?.();
    window.CategoryRegistry?.refresh?.();
    toast("success", "공정 DB 복원", `${seed.length}개 공정을 시드에서 복원했습니다.`);
  }

  els.btnReload?.addEventListener("click", reloadFromSeed);
  els.filter?.addEventListener("change", render);
  els.groupOnly?.addEventListener("change", render);

  window.ProcessRegistry = {
    render,
    sortedProcesses,
    processLabel: (state, id) => processLabel(processMap(state), id),
    processOptionsHtml(state, selectedIds, groupsOnly) {
      const sel = new Set(selectedIds ?? []);
      return sortedProcesses(state)
        .filter((p) => !groupsOnly || p.level === "group")
        .map((p) => {
          const pad = p.depth ? "　".repeat(p.depth) : "";
          return `<option value="${escapeAttr(p.id)}" ${sel.has(p.id) ? "selected" : ""}>${pad}${escapeHtml(p.name)}</option>`;
        })
        .join("");
    },
  };

  // 사이드바 탭 전환 시 재렌더 (신규 구조: .nav-item[data-tab])
  document.querySelector('.nav-item[data-tab="categories"]')?.addEventListener("click", () => render());

  // category-registry.js init 이후 실행되므로 최초 공정 테이블 렌더
  render();
})();
