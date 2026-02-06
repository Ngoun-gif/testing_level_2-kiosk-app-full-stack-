// frontend/js/core/session.js
window.Kiosk = window.Kiosk || {};

Kiosk.session = (function () {
  // ===== CONFIG =====
  const IDLE_MINUTES = 7;
  const WARN_SECONDS = 10;

  const IDLE_MS = IDLE_MINUTES * 60 * 1000;
  const WARN_MS = WARN_SECONDS * 1000;

  // throttle backend touch calls
  const TOUCH_COOLDOWN_MS = 500;

  let idleTimer = null;
  let tickTimer = null;
  let touchCooldown = false;

  const S = () => Kiosk.router.state;

  // ✅ only run session idle on these routes
  function isSessionPage() {
    const r = S().route;
    return ["service", "menu", "product-variant", "cart", "payment-method"].includes(r);
  }

  function backendReady() {
    return !!window.pywebview?.api;
  }

  async function ensureBackendSession() {
    if (!backendReady()) return;

    if (!S().sessionKey) {
      try {
        const res = await Api.call("session_start");
        if (res?.status === "ok" && res?.data?.session_key) {
          S().sessionKey = res.data.session_key;
        }
      } catch (e) {}
    }
  }

  async function touchBackendSession() {
    if (!backendReady()) return;
    if (!S().sessionKey) return;
    if (!isSessionPage()) return;

    if (touchCooldown) return;
    touchCooldown = true;
    setTimeout(() => (touchCooldown = false), TOUCH_COOLDOWN_MS);

    try {
      const res = await Api.call("session_touch", S().sessionKey);

      // If backend says expired/closed/not found => force reset
      if (res?.status !== "ok" || res?.data?.status !== "ACTIVE") {
        await forceResetToSplash();
      }
    } catch (e) {
      await forceResetToSplash();
    }
  }

  function resetIdleTimer() {
    // only track idle on ordering pages
    if (!isSessionPage()) return;

    if (idleTimer) clearTimeout(idleTimer);

    // show warning at (7 min - 10 sec)
    const warnAt = Math.max(0, IDLE_MS - WARN_MS);

    idleTimer = setTimeout(() => {
      if (!isSessionPage()) return;
      if (!S().idleWarning) showWarning();
    }, warnAt);
  }

  function showWarning() {
    if (!isSessionPage()) return;

    S().idleWarning = true;
    S().idleCountdown = WARN_SECONDS;

    if (tickTimer) clearInterval(tickTimer);

    tickTimer = setInterval(async () => {
      // if user navigated away, stop warning
      if (!isSessionPage()) {
        hideWarning();
        return;
      }

      const next = Math.max(0, Number(S().idleCountdown || 0) - 1);
      S().idleCountdown = next;

      if (next <= 0) {
        clearInterval(tickTimer);
        tickTimer = null;
        await forceResetToSplash();
      }
    }, 1000);
  }

  function hideWarning() {
    S().idleWarning = false;
    S().idleCountdown = 0;

    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function clearOrderState() {
    // reset kiosk ordering
    S().service = null;
    S().categoryId = 0;
    S().subCategoryId = 0;
    S().cart = [];

    // reset payment
    S().paymentMethod = null;
    S().lastReceipt = null;

    // order keys (match your router)
    S().orderId = null;
    S().orderNo = null;

    // optional extra keys if they exist elsewhere
    S().editCartIndex = null;
    S().productId = null;
  }

  async function closeBackendSession() {
    if (!backendReady()) {
      S().sessionKey = null;
      return;
    }
    try {
      if (S().sessionKey) {
        await Api.call("session_close", S().sessionKey);
      }
    } catch (e) {}
    S().sessionKey = null;
  }

  async function continueSession() {
    // only makes sense on session pages
    if (!isSessionPage()) {
      hideWarning();
      return;
    }

    hideWarning();
    resetIdleTimer();
    await ensureBackendSession();
    await touchBackendSession();
  }

  async function forceResetToSplash() {
    hideWarning();
    clearOrderState();
    await closeBackendSession();

    // stop timers
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }

    Kiosk.router.go("splash");
  }

  async function onAnyActivity() {
    // ignore splash + payment pages (3-min handled elsewhere)
    if (!isSessionPage()) {
      if (S().idleWarning) hideWarning();
      return;
    }

    if (S().idleWarning) {
      await continueSession();
      return;
    }

    resetIdleTimer();
    await ensureBackendSession();
    await touchBackendSession();
  }

  function bindGlobalActivity() {
    ["click", "touchstart", "keydown"].forEach((ev) => {
      window.addEventListener(ev, onAnyActivity, { passive: true });
    });
  }

  async function mount() {
    // defaults
    if (typeof S().sessionKey === "undefined") S().sessionKey = null;
    if (typeof S().idleWarning === "undefined") S().idleWarning = false;
    if (typeof S().idleCountdown === "undefined") S().idleCountdown = 0;

    bindGlobalActivity();

    // Do not start session until user is on ordering pages
    if (!isSessionPage()) return;

    resetIdleTimer();
    await ensureBackendSession();
    await touchBackendSession();
  }

  return {
    mount,
    continueSession,
    forceResetToSplash,
    // useful for when splash button "Order Now" -> service
    ensureBackendSession,
    resetIdleTimer,
  };
})();
