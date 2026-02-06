// frontend/js/modules/splash.js
window.Kiosk = window.Kiosk || {};
Kiosk.modules = Kiosk.modules || {};

Kiosk.modules.splash = {
  template: tpl("tpl-splash"),

  mounted() {
    // init bootstrap carousel AFTER DOM is ready
    const el = document.getElementById("splashCarousel");
    if (el && window.bootstrap?.Carousel) {
      const old = bootstrap.Carousel.getInstance(el);
      if (old) old.dispose();

      new bootstrap.Carousel(el, {
        interval: 2500,
        ride: "carousel",
        pause: false,
        touch: false,
        wrap: true
      });
    }

    Kiosk.router.setFooter("Welcome");
  },

  methods: {
    async goService() {
      // ✅ Start backend session ONLY when leaving splash
      try {
        await Kiosk.session.ensureBackendSession?.();
      } catch (e) {}

      // go to ordering flow
      Kiosk.router.go("service");

      // start idle timer for ordering pages
      Kiosk.session.resetIdleTimer?.();
    }
  }
};
