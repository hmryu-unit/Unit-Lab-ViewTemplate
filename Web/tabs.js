/**
 * 탭 전환 — 사이드바 nav-item 동기화
 * (탑바는 flow-chip 대신 브레드크럼 텍스트로 변경됨 — index.html 인라인 스크립트에서 처리)
 */
(function () {
  function switchTab(name) {
    // 패널 전환
    document.querySelectorAll(".panel").forEach((p) => {
      p.classList.toggle("active", p.id === `panel-${name}`);
    });
    // 사이드바 활성 상태
    document.querySelectorAll(".nav-item[data-tab]").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === name);
    });
  }

  // 사이드바 버튼
  document.querySelectorAll(".nav-item[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  window.switchTab = switchTab;
})();
