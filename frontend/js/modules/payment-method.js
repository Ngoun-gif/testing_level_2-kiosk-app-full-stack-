// frontend/js/modules/payment-method.js
window.Kiosk = window.Kiosk || {};
Kiosk.modules = Kiosk.modules || {};

Kiosk.modules["payment-method"] = {
  template: tpl("tpl-payment-method"),

  data() {
    return {
      router: Kiosk.router,
      selected: "counter", // 'counter' | 'qrcode'
      renderTick: 0
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
      return cart.reduce((s, i) => s + Number(i?.qty || 1), 0);
    }
  },

  mounted() {
    // if cart empty, go back
    if (!this.lines.length) {
      this.router.setFooter("Cart is empty");
      this.router.go("menu");
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

    this.renderTick++;
  },

  methods: {
    select(method) {
      this.selected = method;
      this.router.state.paymentMethod = method;
      this.renderTick++;
    },

    back() {
      this.router.go("cart");
    },

    continueNext() {
      if (this.count === 0) return;

      if (this.selected === "qrcode") {
        this.router.go("payment-qr");
      } else {
        this.router.go("pay-counter");
      }
    }
  }
};
