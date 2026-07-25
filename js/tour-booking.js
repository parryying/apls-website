/*
  APLS tour booking (Phase 1 — Calendly)
  -------------------------------------------------
  This turns the "Schedule a tour" placeholder into a live Calendly
  booking calendar AS SOON AS a real Calendly link is added — no other
  code changes needed.

  HOW TO ACTIVATE:
  1. Create a free Calendly account and a "School Tour" event type.
  2. Copy your scheduling link (looks like https://calendly.com/your-name/school-tour).
  3. In enrollment.html, find the element with id="tour-booking" and paste
     your link into its data-calendly-url="..." attribute.
  That's it — the placeholder is replaced with the live calendar automatically.

  Until a real link is added, the friendly placeholder box stays visible.
*/
(function () {
  var box = document.getElementById('tour-booking');
  if (!box) return;

  var url = (box.getAttribute('data-calendly-url') || '').trim();

  // Only activate for a real Calendly link (ignores the placeholder text).
  if (!/^https:\/\/calendly\.com\/.+/i.test(url)) return;

  var lock = document.getElementById('tour-lock');

  function buildCalendly() {
    var widget = document.createElement('div');
    widget.className = 'calendly-inline-widget';
    widget.setAttribute('data-url', url);
    widget.style.minWidth = '320px';
    widget.style.height = '700px';
    box.replaceWith(widget);

    // Load Calendly's embed script once.
    var s = document.createElement('script');
    s.src = 'https://assets.calendly.com/assets/external/widget.js';
    s.async = true;
    document.body.appendChild(s);
  }

  // If a submit-detectable inquiry form is active, the inquiry is mandatory:
  // keep the calendar locked until the family submits the form.
  if (window.APLS_INQUIRY_ACTIVE) {
    box.hidden = true;
    if (lock) lock.hidden = false;

    document.addEventListener('apls:inquiry-submitted', function () {
      if (lock) lock.hidden = true;
      box.hidden = false;
      buildCalendly();
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, { once: true });
    return;
  }

  // No inquiry form to gate behind — show the calendar directly.
  buildCalendly();
})();
