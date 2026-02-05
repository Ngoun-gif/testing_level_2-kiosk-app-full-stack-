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
    goService() {
      Kiosk.router.go("service");
    }
  }
};
