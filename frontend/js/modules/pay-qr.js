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
    lines() {
      return (this.router.state.cart || []).filter(Boolean);
    },
    total() {
      const cart = this.router.state.cart || [];
      return cart.reduce((sum, i) => sum + Number(i?.line_total || 0), 0);
    },
    count() {
      const cart = this.router.state.cart || [];
      return cart.reduce((s, i) => s + Number(i?.qty ?? 1), 0);
    }
  },

  mounted() {
    if (!this.lines.length) {
      this.router.setFooter("Cart is empty");
      this.router.go("menu");
      return;
    }
    this.router.state.paymentMethod = "qrcode";
  },

  methods: {
    back() {
      this.router.go("payment-method");
    },

    async printReceipt() {
      if (this.count === 0 || this.printing) return;

      this.printing = true;
      try {
        const cart = this.router.state.cart || [];
        const total = this.total;

        const payload = Kiosk.utils.buildReceiptPayload({
          cart,
          total,
          paymentMethod: "qrcode"
        });

        const res = await window.pywebview.api.print_receipt(payload);
        if (!res?.ok) throw new Error(res?.error || "Print failed");

        // store for receipt screen / reprint
        this.router.state.lastReceipt = payload;

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
