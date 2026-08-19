# Asia Pacific Language School — Website

A hand-built static website for Asia Pacific Language School (APLS), a Chinese &
Japanese preschool and language school in Bellevue, WA.

## What this is

Plain HTML + CSS. **No framework, no build step, no dependencies.** To view it,
just open `index.html` in any web browser.

## Structure

```
apls-website/
├── index.html        Homepage
├── css/styles.css    All site styling
└── images/           Illustrations and logo
```

## Editing

Content meant to be updated is marked in the HTML with `<!-- ✏️ EDIT: ... -->`
comments.

### Time-limited enrollment badges

Every **Now enrolling** badge for a program with fixed start/end dates must include
`data-enrollment-end="YYYY-MM-DD"`, using that program's final day. The shared
`js/enrollment-status.js` script keeps the badge visible through the final day and
removes it automatically the next day.

When dates are updated for a future year, update `data-enrollment-end` everywhere
that program's badge appears. Do not publish a fixed-date program badge without an
end date.

```html
<span class="badge-open" data-enrollment-end="2027-08-20">Now enrolling</span>
```

### Quick-answer chatbox

The site-wide **Ask APLS** widget is a client-side, rule-based FAQ chatbox. It
does not use an LLM, external API, database, or visitor tracking.

- Edit approved answers and matching phrases in `data/chat-knowledge.js`.
- Edit prices only in `data/tuition.js`; chat tuition answers read that file.
- Interface behavior lives in `js/chatbox.js` and styles live in `css/styles.css`.
- Questions without a reliable match direct visitors to the Contact page.

### CMS preview

Open `cms/index.html` to use the browser-based content editor for programs,
tuition, calendar, teacher, gallery, and events data. The editor provides live
previews and stores drafts in the current browser.

The Programs & Tuition editor has one workspace per program. Each program owns
one tuition heading, note, and table used by the full Tuition page, its program
page, and chat answers. It also stores the current term, enrollment status,
application URL, dates, and schedule summary for future enrollment workflows.
Application links on the Forms and program pages already read these records.

Shared fees and policies are edited once beneath the program workspace. Use the
program checkboxes to control where each shared item appears; create a separate
shared item when a program has a different rate, such as the Summer Camp sibling
discount.

The program editor runs automatic checks while fields are edited:

- Open, waitlisted, and coming-soon programs require an application URL.
- End dates cannot precede start dates, and Open programs cannot remain open
	after their end date.
- Fixed-term programs are warned when dates are missing.
- Program dates are compared with matching program events in the Calendar.
- Extended-care availability must agree with the shared extended-care fee.
- For per-class programs, scheduled dates are counted and checked for invalid or
	duplicate dates, dates outside the program range, declared class counts, and
	tuition totals calculated from the per-class rate.

Automatic errors block tuition export. Warnings remain reviewable and require an
explicit confirmation before tuition or calendar data can be exported. The
After-School and Saturday public schedule tables are rendered from the same
structured class-date lists used by these checks.

After-School and Saturday School start/end dates are owned by their program
workspaces. Entering either boundary automatically creates or updates locked
First day and Last day rows in the Calendar workbook. If the target school year
does not exist, the CMS creates its calendar shell automatically. The public
Calendar page also overlays these events directly from program data, so replacing
`tuition.js` is enough for the website calendar to reflect the new boundaries.

The Calendar editor uses one spreadsheet-style row per event. Enter real start
and end dates; the CMS calculates weekday labels, groups events by month, and
flags incomplete, duplicate, out-of-range, or reversed dates before export. Its
live month-grid preview shows events on their actual dates, including multi-day
ranges. Numbered markers correspond to a complete monthly agenda with full event
names, date ranges, categories, and notes; selecting either returns focus to its
spreadsheet row.

The Gallery editor curates free official Instagram embeds. Publish a post from
the public `@aplsfamilies` account, copy its post or Reel URL, and add that URL
in the Gallery workspace. Instagram stores and serves the photo; the website
stores only the selected URL, caption, order, and visibility setting. The
permanent local photo gallery remains visible when Instagram is unavailable.

The Events & Announcements editor manages multiple published, draft, or archived
items. Events can include dates, times, location, flyer, and action links;
announcements can omit event-specific details. Enabling **Show on school
calendar** adds a locked Calendar row while `events.js` remains the source of
truth.

The CMS preview does not publish directly. Use **Export data file** to download
the updated `tuition.js`, `calendar.js`, `teachers.js`, `gallery.js`, or
`events.js`, then replace the matching file in `data/` and deploy the website
normally.

## Deploying

This folder is the complete, portable website. To publish, upload the contents
of `apls-website/` to the website host. No special server or software required.
