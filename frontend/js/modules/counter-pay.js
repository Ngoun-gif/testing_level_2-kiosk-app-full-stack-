// frontend/js/modules/counter-pay.js
window.Kiosk = window.Kiosk || {};
Kiosk.modules = Kiosk.modules || {};

Kiosk.modules["pay-counter"] = {
  template: tpl("tpl-pay-counter"),

  data() {
    return {
      router: Kiosk.router,
      printing: false,
      loading: false,

      // ✅ DB snapshot (so total never undefined)
      order: null,

      // =========================
      // ⏱ Payment timeout (3 min)
      // =========================
      paySeconds: 180,
      _payInterval: null,
      _activityHandler: null
    };
  },

  computed: {
    orderId() {
      return Number(this.router.state.orderId || 0);
    },

    // ✅ safe total from DB snapshot
    total() {
      return Number(this.order?.total_amount ?? 0);
    },

    // ✅ for button disable (count===0)
    count() {
      return (this.order?.items || []).reduce((s, it) => s + Number(it?.qty || 1), 0);
    },

    // Optional: display "02:59"
    payMMSS() {
      const s = Math.max(0, Number(this.paySeconds || 0));
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      return `${mm}:${ss}`;
    }
  },

  async mounted() {
    if (!this.orderId) {
      this.router.setFooter("Order not found. Please checkout again.");
      this.router.go("cart");
      return;
    }

    // UI state
    this.router.state.paymentMethod = "counter";

    // ✅ set payment type in DB
    try {
      await Api.call("order_set_payment_type", this.orderId, "counter");
    } catch (e) {
      console.warn("order_set_payment_type(counter) failed:", e);
    }

    // ✅ load order snapshot so template always has total/items
    this.loading = true;
    try {
      const res = await Api.call("order_get_full", this.orderId);
      if (res?.status !== "ok") {
        this.router.setFooter(res?.message || "Failed to load order");
        this.router.go("payment-method");
        return;
      }

      this.order = res.data;

      // if cancelled, block
      if (String(this.order?.status || "") === "CANCELLED") {
        this.router.setFooter("Order was cancelled.");
        await this._resetToSplash(true);
        return;
      }

      // ✅ Start 3-min payment timeout AFTER order is loaded
      this._startPaymentTimer();
    } catch (e) {
      this.router.setFooter(String(e?.message || e || "Load order error"));
      this.router.go("payment-method");
    } finally {
      this.loading = false;
    }
  },

  // Vue3 hook supported
  beforeUnmount() {
    this._stopPaymentTimer();
  },

  methods: {
    // =========================
    // ⏱ Payment Timeout Logic
    // =========================
    _startPaymentTimer() {
      this._stopPaymentTimer();

      // reset to full 3 minutes
      this.paySeconds = 180;

      // any activity resets payment timer
      this._activityHandler = () => {
        // only reset if still on this screen and not printing
        if (this.router.state.route !== "pay-counter") return;
        if (this.printing) return;
        this.paySeconds = 180;
      };

      ["click", "touchstart", "keydown"].forEach((ev) => {
        window.addEventListener(ev, this._activityHandler, { passive: true });
      });

      this._payInterval = setInterval(async () => {
        // stop if route changed
        if (this.router.state.route !== "pay-counter") {
          this._stopPaymentTimer();
          return;
        }

        // don't expire while printing
        if (this.printing) return;

        this.paySeconds = Math.max(0, Number(this.paySeconds || 0) - 1);

        if (this.paySeconds <= 0) {
          this._stopPaymentTimer();
          await this._expirePayment();
        }
      }, 1000);
    },

    _stopPaymentTimer() {
      if (this._payInterval) {
        clearInterval(this._payInterval);
        this._payInterval = null;
      }
      if (this._activityHandler) {
        ["click", "touchstart", "keydown"].forEach((ev) => {
          window.removeEventListener(ev, this._activityHandler);
        });
        this._activityHandler = null;
      }
    },

    async _expirePayment() {
      // business rule: payment timeout cancels order
      try {
        if (this.orderId) {
          await Api.call("order_cancel", this.orderId);
        }
      } catch (e) {
        console.warn("order_cancel failed:", e);
      }

      this.router.setFooter("Payment timeout. Order cancelled.");
      await this._resetToSplash(true);
    },

    async _resetToSplash(clearOrder) {
      // clear cart
      this.router.state.cart = [];
      this.router.state.paymentMethod = null;
      this.router.state.lastReceipt = null;

      if (clearOrder) {
        this.router.state.orderId = null;
        this.router.state.orderNo = null;
      }

      // optional: reset service for next user
      this.router.state.service = null;

      // cleanup edit/product navigation
      this.router.state.editCartIndex = null;
      this.router.state.productId = null;

      this.router.go("splash");
    },

    back() {
      // ✅ Back does NOT cancel
      this._stopPaymentTimer();
      this.router.go("payment-method");
    },

    async printReceipt() {
      if (this.printing) return;
      if (!this.orderId) return;

      // stop timer while printing (avoid auto cancel)
      this._stopPaymentTimer();

      this.printing = true;
      try {
        // 1) Mark PAID (manual rule)
        const paidRes = await Api.call("order_mark_paid", this.orderId);
        if (paidRes?.status !== "ok") {
          throw new Error(paidRes?.message || "Failed to mark paid");
        }

        // 2) Reload full snapshot (latest)
        const fullRes = await Api.call("order_get_full", this.orderId);
        if (fullRes?.status !== "ok") {
          throw new Error(fullRes?.message || "Failed to load order");
        }

        const o = fullRes.data;
        this.order = o;

        // 3) Build receipt payload from shared helper
        const payload = Kiosk.receiptPayload.fromOrder(o);

        // 4) Print
        const pr = await window.pywebview.api.print_receipt(payload);
        if (!pr?.ok) throw new Error(pr?.error || "Print failed");

        // 5) Mark PRINTED
        const printedRes = await Api.call("order_mark_printed", this.orderId);
        if (printedRes?.status !== "ok") {
          console.warn("order_mark_printed failed:", printedRes?.message);
        }

        // store for receipt screen
        this.router.state.lastReceipt = payload;

        // clear cart after print success
        this.router.state.cart = [];

        this.router.setFooter("Printed ✅");
        this.router.go("receipt");
      } catch (e) {
        console.error(e);
        this.router.setFooter("Print failed ❌ " + (e.message || ""));

        // restart timer so user can try again
        this._startPaymentTimer();
      } finally {
        this.printing = false;
      }
    }
  }
};
