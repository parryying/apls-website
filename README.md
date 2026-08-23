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

Open `cms/index.html` to use the local fallback editor for programs, tuition,
calendar, teacher, gallery, and events data. The protected hosted version uses
the same editor and previews, while adding cloud drafts and GitHub review
submissions. See `cloudflare/README.md` for account setup and rollout checks.

The hosted CMS deploys automatically after every push to `main`. The
`Deploy Cloud CMS` GitHub Actions workflow validates and tests the content,
builds the exact pushed commit, and deploys it to Cloudflare Pages. It requires
the repository variable `CLOUDFLARE_ACCOUNT_ID` and the repository secret
`CLOUDFLARE_API_TOKEN`.

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

Automatic errors block download or review submission. Warnings remain
reviewable and require explicit confirmation. The
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
flags incomplete, duplicate, out-of-range, or reversed dates before submission. Its
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

The CMS never publishes production directly. On the protected hosted CMS,
**Submit for review** saves changed data and optimized images to a `cms/*`
GitHub branch, opens a pull request, runs shared validation, and deploys the
exact validated commit to staging. Parry reviews and merges the pull request,
then uses the protected production workflow. The local `file://` editor retains
**Download update** only as an owner emergency fallback.

Teacher and Event fields support cloud-only image upload. The browser accepts
JPEG, PNG, and WebP originals up to 10 MB, corrects orientation, resizes the
longest edge to 2,000 pixels, converts to WebP, targets 500 KB, blocks normal
outputs above 1 MB, and keeps pending images in IndexedDB until submission.
Only optimized website copies under `images/uploads/YYYY/` are committed.

Shared checks are available locally and in GitHub Actions:

```powershell
npm run validate:cms
npm run validate:cms-media
npm run test:cms
```

## Deploying

The cPanel deployments are manual GitHub Actions workflows:

- **Deploy cPanel Staging** publishes a selected commit to
  `https://www.apls.org/_newsite/`.
- **Deploy cPanel Production** publishes the exact staging-tested commit to
  `https://www.apls.org/`. It also requires the confirmation value `PUBLISH`
  and uses the protected `cpanel-production` environment.

Both workflows use `.github/scripts/prepare-site.sh` to package only public site
files. The CMS, audits, temporary files, archived forms, previews, repository
configuration, and obsolete PDF revisions are not uploaded.

Required repository variables are `CPANEL_HOST`, `CPANEL_PORT`,
`CPANEL_USERNAME`, `CPANEL_STAGING_PATH`, and `CPANEL_PRODUCTION_PATH`. The
required secret is `CPANEL_SSH_PRIVATE_KEY`.

### Production launch

1. Commit and push the intended release. Record its full commit SHA.
2. Run **Deploy cPanel Staging** with that SHA, then verify the staging site on
	desktop and mobile.
3. Confirm that the existing live-site backup and restore procedure are
	available. Do not use `_newsite` as the old-site backup.
4. Run **Deploy cPanel Production** with the same SHA, enter `PUBLISH`, approve
	the production environment, and watch the workflow to completion.
5. In a private browser window, verify the homepage, Programs, Enrollment,
	Tuition, Forms, Calendar, Tour, PDFs, video, chat, and mobile navigation.
	Also verify `/robots.txt`, `/sitemap.xml`, HTTPS/www redirects, and legacy
	`/index.php`, `/pro_preschool.php`, and `/calendar.php` redirects.

SFTP overwrites matching files one at a time and does not delete stale remote
files. A deployment can therefore serve a brief mixture of file versions while
it runs. Keep the old PHP files until the new site has been stable and its 301
redirects have been verified.

If a critical production check fails, stop making changes and restore the
existing cPanel backup, beginning with the old `.htaccess` and homepage files.
Then verify the old homepage and PHP routes before resuming normal traffic.
