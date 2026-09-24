/* Alex Hash — analytics layer (GA4 + Google Ads conversions)
 * Config comes from window.AlexHashTracking = { ga4: 'G-XXXX', adsId: 'AW-...', conversionLabel: '...' }
 * Every event is also pushed to window.dataLayer so GTM can pick it up.
 */
(function () {
  'use strict';
  var CFG = window.AlexHashTracking || {};
  var page = document.body ? (document.body.getAttribute('data-ah-page') || document.title) : document.title;

  function track(name, params) {
    var data = params || {};
    data.page_name = page;
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, data);
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: name }, data));
    // Mirror into Microsoft Clarity so recordings can be filtered by action
    if (typeof window.clarity === 'function') {
      try {
        window.clarity('event', name);
        if (name === 'generate_lead') { window.clarity('set', 'lead', 'yes'); }
        if (name === 'whatsapp_click') { window.clarity('set', 'whatsapp', 'yes'); }
        if (data.enquiry_type) { window.clarity('set', 'enquiry_type', String(data.enquiry_type)); }
      } catch (err) {}
    }
  }
  window.ahTrack = track;

  /* --- Google Ads conversion (fired on a real lead) --- */
  function adsConversion(value) {
    if (typeof window.gtag !== 'function' || !CFG.adsId) { return; }
    var target = CFG.conversionLabel ? CFG.adsId + '/' + CFG.conversionLabel : CFG.adsId;
    window.gtag('event', 'conversion', {
      send_to: target,
      value: value || 0,
      currency: 'AED'
    });
  }

  /* --- 1. Contact intent clicks --- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!a) { return; }
    var href = (a.getAttribute('href') || '').toLowerCase();
    var label = (a.getAttribute('data-ah-track') || a.textContent || '').trim().slice(0, 80);

    if (href.indexOf('wa.me') > -1 || href.indexOf('whatsapp') > -1) {
      track('whatsapp_click', { link_text: label, location: a.closest('.ah-fab') ? 'floating_button' : 'page' });
      adsConversion();
    } else if (href.indexOf('tel:') === 0) {
      track('call_click', { link_text: label });
      adsConversion();
    } else if (href.indexOf('mailto:') === 0) {
      track('email_click', { link_text: label });
    } else if (a.classList.contains('ah-btn--primary') || a.hasAttribute('data-ah-track')) {
      track('cta_click', { link_text: label, destination: a.getAttribute('href') || '' });
    } else if (href.indexOf('http') === 0 && a.hostname && a.hostname !== location.hostname) {
      track('outbound_click', { link_text: label, destination: a.href });
    }
  }, true);

  /* --- 2. Contact form funnel --- */
  var form = document.querySelector('[data-ah-form]');
  if (form) {
    var started = false;
    form.addEventListener('focusin', function () {
      if (started) { return; }
      started = true;
      track('form_start', {});
    });
    form.addEventListener('change', function (e) {
      var n = e.target.name;
      if (n === 'ah_subject' || n === 'ah_quantity') {
        track('form_field_set', { field: n, value: String(e.target.value || '').slice(0, 60) });
      }
    });
    form.addEventListener('submit', function () {
      track('form_submit', {
        enquiry_type: (form.querySelector('[name="ah_subject"]') || {}).value || '',
        machines: (form.querySelector('[name="ah_quantity"]') || {}).value || ''
      });
    });

    // Success message => qualified lead
    var seen = false;
    var watch = new MutationObserver(function () {
      if (seen) { return; }
      if (form.parentNode && form.parentNode.querySelector('.ah-alert--ok')) {
        seen = true;
        track('generate_lead', {
          currency: 'AED',
          value: 1,
          enquiry_type: (form.querySelector('[name="ah_subject"]') || {}).value || ''
        });
        adsConversion(1);
      }
    });
    watch.observe(form.parentNode || form, { childList: true, subtree: true });

    if (/[?&]ah_sent=ok/.test(location.search)) {
      track('generate_lead', { currency: 'AED', value: 1, method: 'no_js' });
      adsConversion(1);
    }
  }

  /* --- 3. Scroll depth --- */
  var marks = [25, 50, 75, 90];
  var hit = {};
  function onScroll() {
    var h = document.documentElement;
    var max = (h.scrollHeight - h.clientHeight) || 1;
    var pct = Math.round((window.scrollY / max) * 100);
    for (var i = 0; i < marks.length; i++) {
      if (pct >= marks[i] && !hit[marks[i]]) {
        hit[marks[i]] = true;
        track('scroll_depth', { percent: marks[i] });
      }
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* --- 4. Engaged time milestones --- */
  var secs = 0, active = true;
  document.addEventListener('visibilitychange', function () { active = !document.hidden; });
  setInterval(function () {
    if (!active) { return; }
    secs += 5;
    if (secs === 15 || secs === 30 || secs === 60 || secs === 120 || secs === 300) {
      track('time_on_page', { seconds: secs });
    }
  }, 5000);

  /* --- 5. Section visibility (which content actually gets read) --- */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var el = en.target;
          var name = el.getAttribute('data-ah-section') ||
            (el.querySelector('h2') ? el.querySelector('h2').textContent.trim().slice(0, 60) : 'section');
          track('section_view', { section: name });
          io.unobserve(el);
        }
      });
    }, { threshold: 0.4 });
    document.querySelectorAll('.ah-section, .ah-plan, .ah-machine').forEach(function (el) { io.observe(el); });
  }

  /* --- 6. FAQ interactions --- */
  document.querySelectorAll('details').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) {
        var q = d.querySelector('summary');
        track('faq_open', { question: q ? q.textContent.trim().slice(0, 90) : '' });
      }
    });
  });

  /* --- 7. Rage/exit signals for optimisation --- */
  var clicks = 0, timer = null;
  document.addEventListener('click', function () {
    clicks++;
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (clicks >= 4) { track('rage_click', { clicks: clicks }); }
      clicks = 0;
    }, 1200);
  });
})();
