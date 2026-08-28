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

  var calLink = (box.getAttribute('data-cal-link') || '').trim();
  var calendlyUrl = (box.getAttribute('data-calendly-url') || '').trim();

  // A real Cal.com link looks like "name/event-slug" (no spaces, no placeholder).
  var isCal = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\/[a-z0-9-]+/i.test(calLink) &&
    !/paste/i.test(calLink);
  // A real Calendly link.
  var isCalendly = /^https:\/\/calendly\.com\/.+/i.test(calendlyUrl);

  if (!isCal && !isCalendly) return; // keep the placeholder

  // Build the live calendar in place of the placeholder.
  var host = document.createElement('div');
  host.className = 'tour-calendar';

  var widget = document.createElement('div');
  host.appendChild(widget);
  box.replaceWith(host);

  // --- Renderers ----------------------------------------------------------

  function renderCal() {
    widget.id = widget.id || 'apls-cal-inline';
    widget.className = 'tour-booking-widget';
    widget.style.minWidth = '320px';
    widget.style.width = '100%';
    widget.style.overflow = 'visible';

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
    widget.className = 'calendly-inline-widget tour-booking-widget';
    widget.setAttribute('data-url', calendlyUrl);
    widget.style.minWidth = '320px';

    var s = document.createElement('script');
    s.src = 'https://assets.calendly.com/assets/external/widget.js';
    s.async = true;
    document.body.appendChild(s);

    function redraw() {
      if (window.Calendly && window.Calendly.initInlineWidget) {
        widget.innerHTML = '';
        window.Calendly.initInlineWidget({ url: calendlyUrl, parentElement: widget });
      }
    }
    return { redraw: redraw };
  }

  function renderScheduler() {
    if (isCal) renderCal();
    else renderCalendly();
  }

  if (document.readyState === 'complete') renderScheduler();
  else window.addEventListener('load', renderScheduler, { once: true });
})();

