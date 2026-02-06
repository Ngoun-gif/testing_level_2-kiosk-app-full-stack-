// frontend/js/core/router.js
window.Kiosk = window.Kiosk || {};

Kiosk.router = {
  state: Vue.reactive({
    route: "splash",
    footerMsg: "Ready",

    // kiosk states
    service: null,
    categoryId: 0,
    subCategoryId: 0,
    cart: [],

    // payment states
    paymentMethod: null,
    lastReceipt: null,

    // ✅ session states (Level 2)
    sessionKey: null,
    idleWarning: false,
    idleCountdown: 0,

    orderId: null,
    orderNo: null,

  }),

  go(name) {
    this.state.route = name;
    this.state.footerMsg = `Open: ${name}`;
  },

  setFooter(msg) {
    this.state.footerMsg = msg;
  }
};
