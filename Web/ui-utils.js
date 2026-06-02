/**
 * ui-utils.js
 * 공통 UI 헬퍼: 토스트 알림, 확인 다이얼로그, 저장 상태 배지
 */
(function () {
  "use strict";

  /* ──────────────────────────────────────────────
     토스트 알림 시스템
  ────────────────────────────────────────────── */
  const ICONS = {
    success: "✅",
    warn:    "⚠️",
    error:   "❌",
    info:    "ℹ️",
  };

  /**
   * 토스트 표시
   * @param {object} opts
   * @param {'success'|'warn'|'error'|'info'} [opts.type='info']
   * @param {string} opts.title
   * @param {string} [opts.message]
   * @param {number} [opts.duration=3500]  ms, 0 = 수동 닫기
   */
  function showToast({ type = "info", title, message = "", duration = 3500 }) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", "alert");
    toast.innerHTML = `
      <span class="toast-icon">${ICONS[type] ?? ICONS.info}</span>
      <div class="toast-body">
        ${title ? `<div class="toast-title">${escHtml(title)}</div>` : ""}
        ${message ? `<div class="toast-msg">${escHtml(message)}</div>` : ""}
      </div>
      <button class="toast-close" aria-label="닫기" title="닫기">✕</button>
    `;

    const close = () => {
      toast.classList.add("fade-out");
      toast.addEventListener("animationend", () => toast.remove(), { once: true });
    };

    toast.querySelector(".toast-close").addEventListener("click", close);
    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(close, duration);
    }

    return toast;
  }

  /* ──────────────────────────────────────────────
     확인 다이얼로그 (confirm 대체)
  ────────────────────────────────────────────── */
  /**
   * @param {object} opts
   * @param {string} opts.title
   * @param {string} [opts.message]
   * @param {string} [opts.confirmLabel='확인']
   * @param {string} [opts.cancelLabel='취소']
   * @param {'danger'|'warn'|'primary'} [opts.confirmStyle='danger']
   * @returns {Promise<boolean>}
   */
  function showConfirm({ title, message = "", confirmLabel = "확인", cancelLabel = "취소", confirmStyle = "danger" }) {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";

      const confirmBtnClass =
        confirmStyle === "danger"  ? "btn-danger" :
        confirmStyle === "warn"    ? "btn-warn" :
        "primary";

      backdrop.innerHTML = `
        <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-title" id="modal-title">${escHtml(title)}</div>
          ${message ? `<div class="modal-body">${escHtml(message)}</div>` : ""}
          <div class="modal-actions">
            <button class="modal-cancel">${escHtml(cancelLabel)}</button>
            <button class="modal-confirm ${confirmBtnClass}">${escHtml(confirmLabel)}</button>
          </div>
        </div>
      `;

      const finish = (result) => {
        backdrop.remove();
        resolve(result);
      };

      backdrop.querySelector(".modal-cancel").addEventListener("click", () => finish(false));
      backdrop.querySelector(".modal-confirm").addEventListener("click", () => finish(true));

      // Esc 키로 취소
      const onKey = (e) => {
        if (e.key === "Escape") { finish(false); document.removeEventListener("keydown", onKey); }
        if (e.key === "Enter")  { finish(true);  document.removeEventListener("keydown", onKey); }
      };
      document.addEventListener("keydown", onKey);

      // 배경 클릭으로 취소
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) finish(false);
      });

      document.body.appendChild(backdrop);
      // 확인 버튼에 포커스
      requestAnimationFrame(() => backdrop.querySelector(".modal-confirm").focus());
    });
  }

  /* ──────────────────────────────────────────────
     입력 프롬프트 (prompt 대체)
  ────────────────────────────────────────────── */
  /**
   * @param {object} opts
   * @param {string} opts.title
   * @param {string} [opts.message]
   * @param {string} [opts.defaultValue='']
   * @param {string} [opts.placeholder='']
   * @param {string} [opts.confirmLabel='확인']
   * @returns {Promise<string|null>}  null = 취소
   */
  function showPrompt({ title, message = "", defaultValue = "", placeholder = "", confirmLabel = "확인" }) {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";

      backdrop.innerHTML = `
        <div class="modal-box" role="dialog" aria-modal="true">
          <div class="modal-title">${escHtml(title)}</div>
          ${message ? `<div class="modal-body">${escHtml(message)}</div>` : ""}
          <div style="margin-bottom:1rem">
            <input type="text" class="prompt-input" value="${escAttr(defaultValue)}" placeholder="${escAttr(placeholder)}"
              style="display:block;width:100%;padding:.5rem .6rem;border:1px solid var(--blue);border-radius:var(--radius-s);
                     background:var(--bg-2);color:var(--tx-1);font-size:.85rem;"/>
          </div>
          <div class="modal-actions">
            <button class="modal-cancel">취소</button>
            <button class="modal-confirm primary">${escHtml(confirmLabel)}</button>
          </div>
        </div>
      `;

      const inp = backdrop.querySelector(".prompt-input");

      const finish = (result) => {
        backdrop.remove();
        resolve(result);
      };

      backdrop.querySelector(".modal-cancel").addEventListener("click", () => finish(null));
      backdrop.querySelector(".modal-confirm").addEventListener("click", () => finish(inp.value));

      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") finish(inp.value);
        if (e.key === "Escape") finish(null);
      });

      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) finish(null);
      });

      document.body.appendChild(backdrop);
      requestAnimationFrame(() => { inp.focus(); inp.select(); });
    });
  }

  /* ──────────────────────────────────────────────
     저장 안 됨 배지 (전역)
  ────────────────────────────────────────────── */
  let _dirtySet = new Set(); // 탭별 dirty 상태

  function setDirtyBadge(tabKey, isDirty) {
    if (isDirty) _dirtySet.add(tabKey);
    else         _dirtySet.delete(tabKey);

    const badge = document.getElementById("globalDirtyBadge");
    if (!badge) return;

    if (_dirtySet.size > 0) {
      badge.classList.add("show");
      badge.title = `저장되지 않은 변경사항: ${[..._dirtySet].join(", ")}`;
    } else {
      badge.classList.remove("show");
    }
  }

  /* ──────────────────────────────────────────────
     키보드 단축키 (Ctrl+S)
  ────────────────────────────────────────────── */
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      // 활성 탭의 저장 버튼 클릭
      const activePanel = document.querySelector(".panel.active");
      if (!activePanel) return;
      const saveBtn = activePanel.querySelector(".action-bar .btn-primary") ||
                        activePanel.querySelector(".btn-primary");
      if (saveBtn) {
        saveBtn.click();
        showToast({ type: "info", title: "Ctrl+S", message: "저장 버튼을 실행했습니다.", duration: 1500 });
      }
    }
  });

  /* ──────────────────────────────────────────────
     내부 유틸
  ────────────────────────────────────────────── */
  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escAttr(s) {
    return escHtml(s).replace(/'/g, "&#39;");
  }

  /* ──────────────────────────────────────────────
     전역 노출
  ────────────────────────────────────────────── */
  window.UI = {
    toast:   showToast,
    confirm: showConfirm,
    prompt:  showPrompt,
    setDirty: setDirtyBadge,
  };

})();
