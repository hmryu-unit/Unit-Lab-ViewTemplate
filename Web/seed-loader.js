/**
 * 배포본 시드: *.json fetch (HTTP) → 실패 시 *-data.js embedded → 세 모듈 + localStorage
 */
(function () {
  const SEEDS = [
    {
      key: "registry",
      url: "category-registry.json",
      fallback: () => window.CATEGORY_REGISTRY_DEFAULT,
    },
    {
      key: "templateLibrary",
      url: "template-library.json",
      fallback: () => window.TEMPLATE_LIBRARY_DEFAULT,
    },
    {
      key: "checklist",
      url: "vg-checklist.json",
      fallback: () => window.VG_CHECKLIST_DEFAULT,
    },
  ];

  async function fetchSeed(url, fallback) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        return { data: await res.json(), source: url };
      }
    } catch {
      /* file:// or network */
    }
    const fb = fallback();
    return {
      data: fb ? structuredClone(fb) : null,
      source: "embedded (*-data.js)",
    };
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

    if (!seeds.registry?.categories) {
      throw new Error("category-registry 시드를 읽을 수 없습니다.");
    }
    if (!seeds.templateLibrary?.nodes) {
      throw new Error("template-library 시드를 읽을 수 없습니다.");
    }
    if (!seeds.checklist?.rows) {
      throw new Error("vg-checklist 시드를 읽을 수 없습니다.");
    }

    window.CategoryRegistry?.applyDeployedSeed?.(seeds.registry, { persist });
    window.TemplateWorkflow?.applyDeployedSeed?.(seeds.templateLibrary, { persist });
    window.VgChecklist?.applyDeployedSeed?.(seeds.checklist, { persist });

    return { sources };
  }

  async function onLoadDeployedClick() {
    const msg =
      "배포된 최신 시드(JSON)로 브라우저 데이터를 덮어씁니다.\n\n" +
      "· localStorage 초안이 사라집니다\n" +
      "· Git 정본과 맞추려면 이후 편집 → JSON 다운로드 → 커밋\n\n" +
      "계속할까요?";
    if (!confirm(msg)) return;

    const btn = document.getElementById("btnLoadDeployedSeed");
    if (btn) btn.disabled = true;
    try {
      const { sources } = await applyDeployedSeeds({ persist: true });
      alert("최신 시드를 반영했습니다.\n\n" + sources.join("\n"));
    } catch (e) {
      alert(e?.message ?? String(e));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  document.getElementById("btnLoadDeployedSeed")?.addEventListener("click", onLoadDeployedClick);

  window.UnitLabSeed = { loadAllSeeds, applyDeployedSeeds };
})();
