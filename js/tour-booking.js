/*
  APLS tour booking
  -------------------------------------------------
  This turns the "Schedule a tour" placeholder into a LIVE booking calendar
  as soon as a real scheduling link is added — no other code changes needed.

  It supports TWO providers:

  ┌─ Cal.com (RECOMMENDED — free GROUP tours) ─────────────────────────────┐
  │ Cal.com's free plan lets MULTIPLE families book the SAME time slot      │
  │ (turn on "Offer seats" in your event type). Calendly charges for this.  │
  │                                                                         │
  │ HOW TO ACTIVATE:                                                        │
  │ 1. Create a free account at https://cal.com and make an event type,     │
  │    e.g. "Campus Tour". In its settings, turn ON "Offer seats" and set   │
  │    how many families can join one slot (e.g. 8).                        │
  │ 2. Your event link looks like  https://cal.com/your-name/campus-tour    │
  │    — the part you need is  your-name/campus-tour                        │
  │ 3. In tour.html, find id="tour-booking" and paste that into            │
  │    data-cal-link="your-name/campus-tour".                               │
  │ That's it — the live Cal.com calendar appears automatically.            │
  └─────────────────────────────────────────────────────────────────────────┘

  ┌─ Calendly (fallback, 1 family per slot on the free plan) ──────────────┐
  │ Paste a link into data-calendly-url="https://calendly.com/.../..." .    │
  └─────────────────────────────────────────────────────────────────────────┘

  If BOTH are set, Cal.com wins. Until a real link is added, the friendly
  placeholder box stays visible.
*/
(function () {
  var box = document.getElementById('tour-booking');
  if (!box) return;

  var lock = document.getElementById('tour-lock');

  var calLink = (box.getAttribute('data-cal-link') || '').trim();
  var calendlyUrl = (box.getAttribute('data-calendly-url') || '').trim();

  // A real Cal.com link looks like "name/event-slug" (no spaces, no placeholder).
  var isCal = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\/[a-z0-9-]+/i.test(calLink) &&
    !/paste/i.test(calLink);
  // A real Calendly link.
  var isCalendly = /^https:\/\/calendly\.com\/.+/i.test(calendlyUrl);

  if (!isCal && !isCalendly) return; // keep the placeholder

  // Pull the family's name + email from the inquiry form (if captured) so they
  // don't have to type them again in the scheduler.
  function prefill() {
    var p = window.APLS_INQUIRY_PREFILL;
    return (p && (p.name || p.email)) ? p : null;
  }

  // Build the live calendar in place of the placeholder.
  var host = document.createElement('div');
  host.className = 'tour-calendar';

  var widget = document.createElement('div');
  host.appendChild(widget);
  box.replaceWith(host);

  // --- Renderers ----------------------------------------------------------

  function renderCal() {
    widget.id = widget.id || 'apls-cal-inline';
    widget.style.minWidth = '320px';
    widget.style.width = '100%';
    widget.style.height = '700px';
    widget.style.overflow = 'auto';

    // Load the Cal.com embed loader once (official snippet).
    (function (C, A, L) {
      var p = function (a, ar) { a.q.push(ar); };
      var d = C.document;
      C.Cal = C.Cal || function () {
        var cal = C.Cal; var ar = arguments;
        if (!cal.loaded) {
          cal.ns = {}; cal.q = cal.q || [];
          d.head.appendChild(d.createElement('script')).src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          var api = function () { p(api, arguments); };
          var namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === 'string') {
            cal.ns[namespace] = cal.ns[namespace] || api;
            p(cal.ns[namespace], ar); p(cal, ['initNamespace', namespace]);
          } else { p(cal, ar); }
          return;
        }
        p(cal, ar);
      };
    })(window, 'https://app.cal.com/embed/embed.js', 'init');

    var ns = 'apls-tour';
    window.Cal('init', ns, { origin: 'https://cal.com' });

    function draw() {
      var config = { layout: 'month_view' };
      var pf = prefill();
      if (pf) {
        if (pf.name) config.name = pf.name;
        if (pf.email) config.email = pf.email;
      }
      widget.innerHTML = '';
      window.Cal.ns[ns]('inline', {
        elementOrSelector: '#' + widget.id,
        calLink: calLink,
        config: config
      });
      window.Cal.ns[ns]('ui', { hideEventTypeDetails: false, layout: 'month_view' });
    }

    draw();
    return { redraw: draw };
  }

  function renderCalendly() {
    function calendlyWithPrefill() {
      var url = calendlyUrl;
      var pf = prefill();
      if (pf) {
        var params = [];
        if (pf.name) params.push('name=' + encodeURIComponent(pf.name));
        if (pf.email) params.push('email=' + encodeURIComponent(pf.email));
        url += (url.indexOf('?') === -1 ? '?' : '&') + params.join('&');
      }
      return url;
    }

    widget.className = 'calendly-inline-widget';
    widget.setAttribute('data-url', calendlyWithPrefill());
    widget.style.minWidth = '320px';
    widget.style.height = '700px';

    var s = document.createElement('script');
    s.src = 'https://assets.calendly.com/assets/external/widget.js';
    s.async = true;
    document.body.appendChild(s);

    function redraw() {
      if (window.Calendly && window.Calendly.initInlineWidget) {
        widget.innerHTML = '';
        window.Calendly.initInlineWidget({ url: calendlyWithPrefill(), parentElement: widget });
      }
    }
    return { redraw: redraw };
  }

  var scheduler = isCal ? renderCal() : renderCalendly();

  // --- Inquiry-form gating (unchanged behaviour) --------------------------

  // If a submit-detectable inquiry form is active, the inquiry is mandatory:
  // show the calendar as a locked preview until the family submits the form.
  if (window.APLS_INQUIRY_ACTIVE) {
    host.classList.add('is-locked');
    if (lock) lock.hidden = true;

    // A transparent overlay lets families see real openings but blocks picking,
    // with a clear message telling them to submit the form first.
    var badge = document.createElement('div');
    badge.className = 'tour-lock-badge';
    badge.innerHTML = '<span class="msg">🔒 Fill out the quick form above to pick a time —' +
      ' these are real openings.</span>';
    host.appendChild(badge);

    document.addEventListener('apls:inquiry-submitted', function () {
      if (lock) lock.hidden = true;
      host.classList.remove('is-locked');
      if (badge) badge.remove();

      // Re-initialise so the family's name/email pre-fill into the scheduler.
      if (prefill()) scheduler.redraw();

      // Scroll so the "form submitted" confirmation AND the Step 2 heading are
      // both visible (not just the calendar) — offset for the sticky header so
      // nothing hides behind it.
      var target = document.querySelector('.inquiry-done') ||
        document.getElementById('tour-step-2') || host;
      var header = document.querySelector('header');
      var offset = (header ? header.getBoundingClientRect().height : 0) + 16;
      var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    }, { once: true });
  }
})();

