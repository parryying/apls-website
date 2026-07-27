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

  function calendlyUrl() {
    // Pre-fill the family's name + email from the inquiry form (if captured),
    // so they don't have to type them again in Calendly.
    var finalUrl = url;
    var prefill = window.APLS_INQUIRY_PREFILL;
    if (prefill && (prefill.name || prefill.email)) {
      var params = [];
      if (prefill.name) params.push('name=' + encodeURIComponent(prefill.name));
      if (prefill.email) params.push('email=' + encodeURIComponent(prefill.email));
      finalUrl += (finalUrl.indexOf('?') === -1 ? '?' : '&') + params.join('&');
    }
    return finalUrl;
  }

  // Build the live calendar in place of the placeholder. It shows real
  // availability right away so families can preview open times; when an inquiry
  // form is gating it, the calendar is displayed but not clickable until submit.
  var host = document.createElement('div');
  host.className = 'tour-calendar';

  var widget = document.createElement('div');
  widget.className = 'calendly-inline-widget';
  widget.setAttribute('data-url', calendlyUrl());
  widget.style.minWidth = '320px';
  widget.style.height = '700px';
  host.appendChild(widget);

  box.replaceWith(host);

  // Load Calendly's embed script once.
  var s = document.createElement('script');
  s.src = 'https://assets.calendly.com/assets/external/widget.js';
  s.async = true;
  document.body.appendChild(s);

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

      // Re-initialise so the family's name/email pre-fill into Calendly. If the
      // embed script hasn't loaded yet, we leave the already-shown calendar as
      // is (still fully usable, just without pre-fill).
      var prefill = window.APLS_INQUIRY_PREFILL;
      if (prefill && (prefill.name || prefill.email) &&
          window.Calendly && window.Calendly.initInlineWidget) {
        widget.innerHTML = '';
        window.Calendly.initInlineWidget({ url: calendlyUrl(), parentElement: widget });
      }

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

