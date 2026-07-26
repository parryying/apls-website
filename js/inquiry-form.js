/*
  APLS inquiry form (Phase 2a)
  -------------------------------------------------
  Turns the "Send a quick inquiry" placeholder into a live, embedded form
  AS SOON AS a real form link is added — no other code changes needed.

  HOW TO ACTIVATE:
  1. Build a free form at https://tally.so with these fields:
       • Parent name          • Email               • Phone
       • Child's first name    • Child's age / DOB    • Desired start date
       • Program interest (Chinese / Japanese; preschool / after-school / etc.)
       • Where did you hear about us?
     (Tip: in Tally you can set the form to redirect to your Calendly link
      after submit, so families flow straight into booking a tour.)
  2. Copy the form's share link (looks like https://tally.so/r/XXXXXX).
  3. In enrollment.html, find the element with id="inquiry-form" and paste
     your link into its data-tally-url="..." attribute.
  That's it — the placeholder is replaced with the live form automatically.

  A non-Tally form URL (Google Forms, Jotform, etc.) also works — it is
  embedded directly in an iframe.
*/
(function () {
  // Signals to tour-booking.js whether a real, submit-detectable inquiry
  // form is active (only Tally forms emit a submit event we can listen for).
  window.APLS_INQUIRY_ACTIVE = false;

  var box = document.getElementById('inquiry-form');
  if (!box) return;

  var url = (box.getAttribute('data-tally-url') || '').trim();

  // Only activate once a real link has been pasted in.
  if (!/^https?:\/\//i.test(url) || /PASTE_TALLY_FORM_LINK_HERE/i.test(url)) return;

  var iframe = document.createElement('iframe');
  iframe.title = 'APLS inquiry form';
  iframe.width = '100%';
  iframe.style.border = '0';
  iframe.setAttribute('loading', 'lazy');

  var loadTally = false;

  if (/tally\.so/i.test(url)) {
    // Normalize a Tally share link (…/r/ID) to its embed URL (…/embed/ID).
    var embedUrl = url.replace('/r/', '/embed/');
    embedUrl += (embedUrl.indexOf('?') === -1 ? '?' : '&') +
      'alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1';
    iframe.setAttribute('data-tally-src', embedUrl);
    iframe.height = '500';
    loadTally = true;
  } else {
    // Generic fallback: embed any other form URL directly.
    iframe.src = url;
    iframe.height = '760';
  }

  box.replaceWith(iframe);

  if (loadTally) {
    var s = document.createElement('script');
    s.src = 'https://tally.so/widgets/embed.js';
    s.async = true;
    document.body.appendChild(s);

    // Only Tally forms report submission back to the page, so only they can
    // gate the tour calendar. Tell tour-booking.js to lock it until submit.
    window.APLS_INQUIRY_ACTIVE = true;

    // When the family submits the inquiry, capture their name + email from the
    // Tally submission and unlock the tour calendar (pre-filling Calendly).
    window.addEventListener('message', function (e) {
      var data = e && e.data;
      if (typeof data !== 'string' || data.indexOf('Tally.FormSubmitted') === -1) return;

      var prefill = {};
      try {
        var payload = JSON.parse(data).payload || {};
        var fields = payload.fields || [];
        var first = '', last = '', full = '', email = '';

        fields.forEach(function (f) {
          var title = (f.title || '').toLowerCase();
          var val = f.answer && (f.answer.value != null ? f.answer.value : f.answer.raw);
          if (val == null || val === '') return;
          if (Array.isArray(val)) val = val.join(', ');

          if (f.type === 'INPUT_EMAIL' || title.indexOf('email') !== -1) {
            email = val;
          } else if (title.indexOf('first name') !== -1 && title.indexOf('child') === -1) {
            first = val;
          } else if (title.indexOf('last name') !== -1 && title.indexOf('child') === -1) {
            last = val;
          } else if (title === 'name' || (title.indexOf('parent') !== -1 && title.indexOf('name') !== -1)) {
            full = val;
          }
        });

        var name = (full || (first + ' ' + last)).trim();
        if (name) prefill.name = name;
        if (email) prefill.email = email;
      } catch (err) {
        // If parsing ever fails, just proceed without pre-fill.
      }

      window.APLS_INQUIRY_PREFILL = prefill;
      document.dispatchEvent(new CustomEvent('apls:inquiry-submitted', { detail: prefill }));
    });
  }
})();
