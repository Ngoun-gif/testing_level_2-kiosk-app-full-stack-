// frontend/js/modules/receipt.js
window.Kiosk = window.Kiosk || {};
Kiosk.modules = Kiosk.modules || {};

Kiosk.modules["receipt"] = {
  template: tpl("tpl-receipt"),

  data() {
    return {
      router: Kiosk.router,
      secondsLeft: 15,
      _timer: null,
      _interval: null,
      _doneOnce: false
    };
  },

  mounted() {
    // safety: avoid multiple timers if somehow mounted twice
    if (this._timer) clearTimeout(this._timer);
    if (this._interval) clearInterval(this._interval);

    this.secondsLeft = 15;

    // countdown UI
    this._interval = setInterval(() => {
      this.secondsLeft = Math.max(0, this.secondsLeft - 1);
    }, 1000);

    // auto return
    this._timer = setTimeout(() => {
      this._finishToSplash();
    }, 15000);
  },

  beforeUnmount() {
    if (this._timer) clearTimeout(this._timer);
    if (this._interval) clearInterval(this._interval);
    this._timer = null;
    this._interval = null;
  },

  methods: {
    done() {
      this._finishToSplash();
    },

    backNow() {
      this._finishToSplash();
    },

    _finishToSplash() {
      if (this._doneOnce) return;
      this._doneOnce = true;

      // stop timers immediately
      if (this._timer) clearTimeout(this._timer);
      if (this._interval) clearInterval(this._interval);
      this._timer = null;
      this._interval = null;

      // ✅ reset kiosk state after successful print flow
      this.router.state.cart = [];
      this.router.state.paymentMethod = null;
      this.router.state.lastReceipt = null;

      // ✅ Level 2: clear created order state
      this.router.state.orderId = null;
      this.router.state.orderNo = null;

      // ✅ optional: reset service so new user must confirm again
      // (If you prefer default dine_in, you can remove this line)
      this.router.state.service = null;

      // reset other navigation/edit states (safe)
      this.router.state.editCartIndex = null;
      this.router.state.productId = null;

      this.router.setFooter("Ready");
      this.router.go("splash");
    }
  }
};
