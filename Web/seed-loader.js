/**
 * 배포본 시드: *.json fetch (HTTP) → 실패 시 *-data.js embedded → 세 모듈 + localStorage
 */
(function () {
  const SEEDS = [
    { key: "registry",       url: "category-registry.json",  fallback: () => window.CATEGORY_REGISTRY_DEFAULT },
    { key: "templateLibrary",url: "template-library.json",   fallback: () => window.TEMPLATE_LIBRARY_DEFAULT },
    { key: "checklist",      url: "vg-checklist.json",       fallback: () => window.VG_CHECKLIST_DEFAULT },
    { key: "processDb",      url: "process-database.json",   fallback: () => window.PROCESS_DATABASE_DEFAULT },
  ];

  function toast(type, title, message, duration) {
    window.UI?.toast({ type, title, message, duration });
  }

  async function uiConfirm(title, message) {
    if (window.UI?.confirm) return window.UI.confirm({ title, message });
    return window.confirm(`${title}\n${message}`);
  }

  async function fetchSeed(url, fallback) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return { data: await res.json(), source: url };
    } catch { /* file:// or network */ }
    const fb = fallback();
    return { data: fb ? structuredClone(fb) : null, source: "embedded (*-data.js)" };
  }

  async function loadAllSeeds() {
    const seeds = {};
    const sources = [];
    for (const item of SEEDS) {
      const { data, source } = await fetchSeed(item.url, item.fallback);
      seeds[item.key] = data;
      sources.push(`${item.url} ← ${source}`);
    }
    return { seeds, sources };
  }

  async function applyDeployedSeeds(options = {}) {
    const { persist = true } = options;
    const { seeds, sources } = await loadAllSeeds();

    if (!seeds.registry?.categories)    throw new Error("category-registry 시드를 읽을 수 없습니다.");
    if (!seeds.templateLibrary?.nodes)  throw new Error("template-library 시드를 읽을 수 없습니다.");
    if (!seeds.checklist?.rows)         throw new Error("vg-checklist 시드를 읽을 수 없습니다.");

    if (seeds.processDb?.processes?.length) {
      seeds.registry = seeds.registry ?? {};
      seeds.registry.processes = seeds.processDb.processes;
    }

    window.CategoryRegistry?.applyDeployedSeed?.(seeds.registry,       { persist });
    window.TemplateWorkflow?.applyDeployedSeed?.(seeds.templateLibrary, { persist });
    window.VgChecklist?.applyDeployedSeed?.(seeds.checklist,            { persist });

    return { sources };
  }

  async function onLoadDeployedClick() {
    const ok = await uiConfirm(
      "최신 시드 불러오기",
      "배포된 최신 JSON으로 브라우저 데이터를 덮어씁니다.\n\n" +
      "• localStorage 초안이 사라집니다\n" +
      "• Git 정본과 맞추려면 이후 편집 → JSON 다운로드 → 커밋\n\n" +
      "계속할까요?"
    );
    if (!ok) return;

    const btn = document.getElementById("btnLoadDeployedSeed");
    const loadingToast = toast("info", "불러오는 중…", "최신 시드를 가져오고 있습니다.", 0);

    if (btn) { btn.disabled = true; btn.textContent = "⏳ 불러오는 중…"; }

    try {
      const { sources } = await applyDeployedSeeds({ persist: true });
      const embeddedCount = sources.filter((s) => s.includes("embedded")).length;
      if (embeddedCount > 0) {
        toast("warn", "시드 불러오기 완료 (일부 내장)", `${4 - embeddedCount}개 JSON 파일, ${embeddedCount}개 내장 데이터 사용`, 5000);
      } else {
        toast("success", "최신 시드 반영 완료", "서버에서 모든 JSON을 성공적으로 불러왔습니다.");
      }
      console.info("Seed sources:", sources.join("\n"));
    } catch (e) {
      toast("error", "시드 불러오기 실패", e?.message ?? String(e), 0);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "🔄 최신 시드"; }
      // 로딩 토스트 닫기
      if (loadingToast) {
        loadingToast.classList.add("fade-out");
        loadingToast.addEventListener("animationend", () => loadingToast.remove(), { once: true });
      }
    }
  }

  document.getElementById("btnLoadDeployedSeed")?.addEventListener("click", onLoadDeployedClick);

  window.UnitLabSeed = { loadAllSeeds, applyDeployedSeeds };
})();
