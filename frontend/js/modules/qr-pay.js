// frontend/js/modules/qr-pay.js
window.Kiosk = window.Kiosk || {};
Kiosk.modules = Kiosk.modules || {};

Kiosk.modules["payment-qr"] = {
  template: tpl("tpl-payment-qr"),

  data() {
    return {
      router: Kiosk.router,
      printing: false
    };
  },

  computed: {
    orderId() {
      return Number(this.router.state.orderId || 0);
    }
  },

  mounted() {
    if (!this.orderId) {
      this.router.setFooter("Order not found. Please checkout again.");
      this.router.go("cart");
      return;
    }
    this.router.state.paymentMethod = "qrcode";
  },

  methods: {
    back() {
      this.router.go("payment-method");
    },

    async printReceipt() {
      if (this.printing) return;
      if (!this.orderId) return;

      this.printing = true;
      try {
        // 1) Mark PAID (for now manual: user presses Print after paying)
        // Later in Level 2 dynamic QR, backend will auto mark paid when callback success.
        const paidRes = await Api.call("order_mark_paid", this.orderId);
        if (paidRes?.status !== "ok") {
          throw new Error(paidRes?.message || "Failed to mark paid");
        }

        // 2) Load full order snapshot
        const fullRes = await Api.call("order_get_full", this.orderId);
        if (fullRes?.status !== "ok") {
          throw new Error(fullRes?.message || "Failed to load order");
        }

        const o = fullRes.data;

        // 3) Receipt payload
        const payload = {
          order_id: o.id,
          order_no: o.order_no,
          service_type: o.service_type,
          payment_method: "qrcode",
          status: "PAID",
          total: Number(o.total_amount || 0),
          created_at: o.created_at,
          items: (o.items || []).map(it => ({
            name: it.name,
            qty: Number(it.qty || 1),
            base_price: Number(it.base_price || 0),
            line_total: Number(it.line_total || 0),
            variants: (it.variants || []).map(v => ({
              group_name: v.group_name,
              value_name: v.value_name,
              extra_price: Number(v.extra_price || 0)
            }))
          }))
        };

        // 4) Print
        const pr = await window.pywebview.api.print_receipt(payload);
        if (!pr?.ok) throw new Error(pr?.error || "Print failed");

        // 5) Mark PRINTED
        const printedRes = await Api.call("order_mark_printed", this.orderId);
        if (printedRes?.status !== "ok") {
          console.warn("order_mark_printed failed:", printedRes?.message);
        }

        this.router.state.lastReceipt = payload;
        this.router.state.cart = [];

        this.router.setFooter("Printed ✅");
        this.router.go("receipt");
      } catch (e) {
        console.error(e);
        this.router.setFooter("Print failed ❌ " + (e.message || ""));
      } finally {
        this.printing = false;
      }
    }
  }
};
