/**
 * 사이드바 배지 카운트 업데이트
 * 각 모듈이 init 완료 후 호출
 */
(function () {
  function update() {
    // 워크플로 카운트
    const wfNodes = window.TemplateWorkflow?.getNodes?.() ?? [];
    const wfBadge = document.getElementById("sideWfCount");
    if (wfBadge) wfBadge.textContent = wfNodes.length || "—";

    // 카테고리 카운트
    const crState = window.CategoryRegistry?.getState?.();
    const crBadge = document.getElementById("sideCrCount");
    if (crBadge) crBadge.textContent = crState?.categories?.length || "—";

    // 체크리스트 카운트
    const clState = window.VgChecklist?.getState?.();
    const clBadge = document.getElementById("sideClCount");
    if (clBadge) clBadge.textContent = clState?.rows?.length || "—";
  }

  // DOM 로드 완료 후 1회 + 0.5초마다 갱신 (각 모듈 init 타이밍 고려)
  setTimeout(update, 300);
  setTimeout(update, 1000);

  // 탭 전환 시도 갱신
  document.querySelectorAll(".nav-item[data-tab], .flow-chip[data-tab]").forEach((el) => {
    el.addEventListener("click", () => setTimeout(update, 100));
  });

  window.updateSidebarCounts = update;
})();
