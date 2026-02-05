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
      _interval: null
    };
  },

  mounted() {
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
  },

  methods: {
    done() {
      this._finishToSplash();
    },
    backNow() {
      this._finishToSplash();
    },
    _finishToSplash() {
      // clear cart AFTER successful print screen
      this.router.state.cart = [];
      this.router.state.paymentMethod = null;
      this.router.setFooter("Ready");
      this.router.go("splash");
    }
  }
};
