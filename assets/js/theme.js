/* Alex Hash theme scripts: drawer, sticky header, reveal, AJAX contact form */
(function () {
  "use strict";

  // Sticky header state
  var header = document.querySelector(".ah-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-stuck", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Mobile drawer
  var drawer = document.getElementById("ah-drawer");
  var openBtn = document.querySelector(".ah-burger");
  var closeBtn = document.querySelector("[data-ah-close]");
  function setDrawer(open) {
    if (!drawer) return;
    drawer.classList.toggle("is-open", open);
    document.body.style.overflow = open ? "hidden" : "";
    if (openBtn) openBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if (openBtn) openBtn.addEventListener("click", function () { setDrawer(true); });
  if (closeBtn) closeBtn.addEventListener("click", function () { setDrawer(false); });
  if (drawer) {
    drawer.addEventListener("click", function (e) { if (e.target === drawer) setDrawer(false); });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setDrawer(false); });

  // Reveal on scroll
  var items = document.querySelectorAll(".ah-reveal");
  if (items.length) {
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
      items.forEach(function (el) { io.observe(el); });
    } else {
      items.forEach(function (el) { el.classList.add("is-in"); });
    }
  }

  // Contact form (AJAX when running inside WordPress, graceful demo otherwise)
  var form = document.querySelector("[data-ah-form]");
  if (!form) return;
  var ok = form.querySelector(".ah-alert--ok");
  var err = form.querySelector(".ah-alert--err");
  var submit = form.querySelector("[type=submit]");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (ok) ok.classList.remove("is-visible");
    if (err) err.classList.remove("is-visible");

    var cfg = window.AlexHashForm || null;
    var label = submit ? submit.innerHTML : "";
    if (submit) { submit.disabled = true; submit.innerHTML = cfg && cfg.sending ? cfg.sending : "Sending\u2026"; }

    var done = function (success, message) {
      if (submit) { submit.disabled = false; submit.innerHTML = label; }
      var box = success ? ok : err;
      if (box) {
        if (message) box.textContent = message;
        box.classList.add("is-visible");
        box.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (success) form.reset();
    };

    if (!cfg || !cfg.ajaxUrl) { done(true, null); return; } // static preview mode

    var data = new FormData(form);
    data.append("action", "alexhash_contact");
    data.append("nonce", cfg.nonce);

    fetch(cfg.ajaxUrl, { method: "POST", credentials: "same-origin", body: data })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        done(!!(res && res.success), res && res.data ? res.data.message : null);
      })
      .catch(function () { done(false, null); });
  });
})();
