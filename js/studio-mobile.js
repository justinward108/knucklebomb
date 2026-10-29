/**
 * Poor Camp Studio — Mobile & Capacitor Runtime Bridge (studio-mobile.js)
 *
 * Provides:
 *  1. Safe-area inset & dynamic viewport height (--pc-vh) CSS variables
 *  2. Coarse-pointer (touch) detection & minimum 44x44px hit-target enforcement
 *  3. Screen WakeLock management during active gameplay
 *  4. Haptic feedback helper (Web Vibration API + Capacitor Haptics bridge)
 *  5. Offline-capable PWA Service Worker registration (/sw.js)
 */
(function () {
  "use strict";
  if (window.__poorCampMobileLoaded) return;
  window.__poorCampMobileLoaded = true;

  var isCapacitor = Boolean(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  var isStandalone = isCapacitor ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    Boolean(window.navigator && window.navigator.standalone);
  var isTouch = ("ontouchstart" in window) ||
    (navigator.maxTouchPoints > 0) ||
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);

  function syncViewportVars() {
    var docEl = document.documentElement;
    if (!docEl) return;
    var vh = window.innerHeight * 0.01;
    docEl.style.setProperty("--pc-vh", vh + "px");
    docEl.dataset.pcMobile = isTouch ? "touch" : "pointer";
    docEl.dataset.pcPlatform = isCapacitor
      ? (window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : "capacitor")
      : (isStandalone ? "pwa" : "web");
  }

  function injectMobileStyles() {
    if (document.getElementById("pc-studio-mobile-css")) return;
    var style = document.createElement("style");
    style.id = "pc-studio-mobile-css";
    style.textContent = [
      ":root {",
      "  --pc-safe-top: env(safe-area-inset-top, 0px);",
      "  --pc-safe-right: env(safe-area-inset-right, 0px);",
      "  --pc-safe-bottom: env(safe-area-inset-bottom, 0px);",
      "  --pc-safe-left: env(safe-area-inset-left, 0px);",
      "}",
      "@media (pointer: coarse) {",
      "  button, [role='button'], input[type='button'], input[type='submit'], select, a.pitch-action, .top-return a {",
      "    min-height: 44px;",
      "    touch-action: manipulation;",
      "  }",
      "}",
      "html, body {",
      "  -webkit-tap-highlight-color: transparent;",
      "  overscroll-behavior-y: none;",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  }

  var wakeLockSentinel = null;
  function requestWakeLock() {
    if (!("wakeLock" in navigator) || document.hidden) return;
    navigator.wakeLock.request("screen").then(function (sentinel) {
      wakeLockSentinel = sentinel;
      sentinel.addEventListener("release", function () {
        wakeLockSentinel = null;
      });
    }).catch(function () {});
  }

  function haptic(pattern) {
    try {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
        window.Capacitor.Plugins.Haptics.impact({ style: "LIGHT" });
        return;
      }
      if (navigator.vibrate) {
        navigator.vibrate(pattern || 12);
      }
    } catch (_) {}
  }

  function configureCapacitorPlugins() {
    if (!isCapacitor || !window.Capacitor || !window.Capacitor.Plugins) return;
    var Plugins = window.Capacitor.Plugins;
    try {
      if (Plugins.SplashScreen && Plugins.SplashScreen.hide) {
        setTimeout(function () {
          Plugins.SplashScreen.hide({ fadeOutDuration: 250 });
        }, 300);
      }
    } catch (_) {}
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  function init() {
    injectMobileStyles();
    syncViewportVars();
    window.addEventListener("resize", syncViewportVars, { passive: true });
    window.addEventListener("orientationchange", syncViewportVars, { passive: true });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && isTouch) requestWakeLock();
    });
    document.addEventListener("pointerdown", function (e) {
      if (isTouch && !wakeLockSentinel) requestWakeLock();
      var btn = e.target && e.target.closest ? e.target.closest("button, [role='button']") : null;
      if (btn && isTouch) haptic(8);
    }, { passive: true });
    configureCapacitorPlugins();
    registerServiceWorker();
  }

  window.PoorCampMobile = {
    isCapacitor: isCapacitor,
    isStandalone: isStandalone,
    isTouch: isTouch,
    haptic: haptic,
    requestWakeLock: requestWakeLock,
    syncViewportVars: syncViewportVars
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
