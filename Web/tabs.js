/**
 * 탭 전환 — 사이드바 nav-item + 탑바 flow-chip 동시 동기화
 */
(function () {
  function switchTab(name) {
    // 패널
    document.querySelectorAll(".panel").forEach((p) => {
      p.classList.toggle("active", p.id === `panel-${name}`);
    });
    // 사이드바
    document.querySelectorAll(".nav-item[data-tab]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === name);
    });
    // 탑바 플로우 칩
    document.querySelectorAll(".flow-chip[data-tab]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === name);
    });
  }

  // 사이드바 버튼
  document.querySelectorAll(".nav-item[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // 탑바 flow-chip 버튼
  document.querySelectorAll(".flow-chip[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  window.switchTab = switchTab;
})();
