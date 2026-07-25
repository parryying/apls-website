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
  }
})();
