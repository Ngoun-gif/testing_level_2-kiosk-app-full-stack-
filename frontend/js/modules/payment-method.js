// frontend/js/modules/payment-method.js
window.Kiosk = window.Kiosk || {};
Kiosk.modules = Kiosk.modules || {};

Kiosk.modules["payment-method"] = {
  template: tpl("tpl-payment-method"),

  data() {
    return {
      router: Kiosk.router,

      // UI selection (keep old naming for template compatibility)
      selected: "counter", // 'counter' | 'qrcode'

      saving: false,
      loading: false,
      renderTick: 0,

      // ✅ DB snapshot
      order: null
    };
  },

  computed: {
    orderId() {
      return Number(this.router.state.orderId || 0);
    },

    // ✅ use DB snapshot, not cart
    lines() {
      return (this.order?.items || []).filter(Boolean);
    },

    total() {
      return Number(this.order?.total_amount ?? 0);
    },

    count() {
      return (this.order?.items || []).reduce((s, it) => s + Number(it?.qty || 1), 0);
    }
  },

  async mounted() {
    // ✅ must have order
    if (!this.orderId) {
      this.router.setFooter("Order not created. Please checkout again.");
      this.router.go("cart");
      return;
    }

    // default selection (keep previous if stored)
    const prev = this.router.state.paymentMethod;
    if (prev === "counter" || prev === "qrcode") {
      this.selected = prev;
    } else {
      this.selected = "counter";
      this.router.state.paymentMethod = "counter";
    }

    // ✅ load order snapshot
    this.loading = true;
    try {
      const res = await Api.call("order_get_full", this.orderId);
      if (res?.status !== "ok") {
        this.router.setFooter(res?.message || "Failed to load order");
        this.router.go("cart");
        return;
      }

      this.order = res.data;

      // if order was cancelled somehow, block payment
      const st = String(this.order?.status || "");
      if (st === "CANCELLED") {
        this.router.setFooter("Order was cancelled. Please order again.");
        this.router.go("menu");
        return;
      }

      this.renderTick++;
    } catch (e) {
      this.router.setFooter(String(e?.message || e || "Load order error"));
      this.router.go("cart");
    } finally {
      this.loading = false;
    }
  },

  methods: {
    select(method) {
      if (method !== "counter" && method !== "qrcode") return;
      this.selected = method;
      this.router.state.paymentMethod = method;
      this.renderTick++;
    },

    back() {
      // ✅ Back does NOT cancel (recommended)
      // (If user returns to cart and checks out again, it creates a new order,
      // so ideally they should continue payment instead. For now keep as your flow.)
      this.router.go("cart");
    },

    async cancelOrder() {
      const oid = Number(this.router.state.orderId || 0);
      if (!oid) return;

      this.saving = true;
      try {
        await Api.call("order_cancel", oid);
      } catch (e) {
        console.warn("order_cancel failed:", e);
      } finally {
        this.saving = false;
      }

      // clear kiosk state
      this.router.state.cart = [];
      this.router.state.paymentMethod = null;
      this.router.state.lastReceipt = null;
      this.router.state.orderId = null;
      this.router.state.orderNo = null;

      this.router.setFooter("Order cancelled");
      this.router.go("splash");
    },

    async continueNext() {
      if (!this.orderId) {
        this.router.setFooter("Missing order. Go back to cart.");
        this.router.go("cart");
        return;
      }

      // ✅ if DB snapshot has no items, something wrong
      if (!this.lines.length) {
        this.router.setFooter("Order items missing. Please checkout again.");
        this.router.go("cart");
        return;
      }

      const payType = (this.selected === "qrcode") ? "qr" : "counter";

      this.saving = true;
      try {
        const res = await Api.call("order_set_payment_type", this.orderId, payType);
        if (res?.status !== "ok") {
          this.router.setFooter(res?.message || "Failed to save payment method");
          return;
        }

        this.router.setFooter(`Payment: ${payType}`);

        if (payType === "qr") this.router.go("payment-qr");
        else this.router.go("pay-counter");
      } catch (e) {
        this.router.setFooter(String(e?.message || e || "Payment method error"));
      } finally {
        this.saving = false;
      }
    }
  }
};
