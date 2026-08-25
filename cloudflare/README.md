# APLS Cloud Content Studio Setup

The repository contains the cloud-ready CMS frontend, the API worker, D1 schema,
shared validation, and GitHub review workflow. Account resources and secrets are
intentionally not committed.

## Architecture

The API is **same-origin**. `cloudflare/worker.js` is copied to `dist-cms/_worker.js`
by `scripts/build-cloud-cms.js`, so Pages runs it in advanced mode: requests under
`/api/` are handled by the worker and everything else falls through to
`env.ASSETS.fetch()`.

There is no standalone Worker. A separate origin was tried and abandoned because
Cloudflare Access answers cross-origin API calls with a login redirect that
`fetch()` cannot follow. Same-origin also removes CORS and the need for a second
Access application.

Pages configuration and the D1 binding live in the **repository-root**
`wrangler.toml`.

## Repository checks

```powershell
npm run validate:cms
npm run validate:cms-media
npm run test:cms
npm run build:cms
```

The Pages build command is `npm run build:cms`; the output directory is
`dist-cms`. The generated `cms/build-config.js` records the exact source commit
so a stale editor build cannot submit against newer website content.

## 1. Cloudflare Pages and Access

Provisioned values for this account:

| Resource | Value |
| --- | --- |
| Pages project | `apls-content-studio` (Direct Upload, production branch `cms`) |
| CMS origin | `https://apls-content-studio.pages.dev` |
| Zero Trust team domain | `aplsbellevue.cloudflareaccess.com` |
| D1 database | `apls-content-studio` |

Access protects the whole origin with a self-hosted application, email one-time
PIN, and an `Editors` policy listing only the approved addresses.

One-time PIN must exist as an **account-level identity provider**, not just be
implied by the application. Add it under Zero Trust -> Team & Resources ->
Identity providers -> Add new -> One-time PIN; it needs no credentials. Without
it the login page offers only "Sign in with Cloudflare", which an editor who has
no Cloudflare account cannot use. Being listed in the `Editors` policy grants
authorisation, not a way to authenticate.

Do not add an editor as a Cloudflare account member. That grants dashboard and
billing access and is unrelated to Access sign-in.

Confirm Access is enforcing:

```powershell
curl.exe -s -o NUL -D - "https://apls-content-studio.pages.dev/api/content"
```

A `302` to `aplsbellevue.cloudflareaccess.com` means Access is active. Do not use
PowerShell `Invoke-WebRequest -MaximumRedirection 0` for this check; it throws on
Access redirects.

Cloudflare's OAuth login (`wrangler login`) grants no Access-write scope, so the
Access application must be created in the Zero Trust dashboard or with an API
token carrying **Access: Apps and Policies -> Edit**.

### Automatic deployment

`.github/workflows/cloudflare-cms.yml` validates, builds, and deploys the CMS
after every push to `main`. Configure these GitHub Actions credentials:

- Repository variable `CLOUDFLARE_ACCOUNT_ID`
- Repository secret `CLOUDFLARE_API_TOKEN`

Create the API token with Cloudflare Pages edit permission and scope it to the
APLS account. The workflow pins Wrangler 3.114.15 and deploys with branch `cms`
so Direct Upload treats the result as production. `workflow_dispatch` can retry
a deployment without another commit.

This workflow is required. Without it, every push to `main` leaves the deployed
editor behind `main` and the stale-build guard silently drops the CMS into local
download mode.

## 2. D1 and secrets

Create the database and apply the migration from `cloudflare/`:

```powershell
npx wrangler@3.114.15 d1 create apls-content-studio
npx wrangler@3.114.15 d1 migrations apply apls-content-studio --remote
```

Put the returned ID in `database_id` in the repository-root `wrangler.toml`.

The worker reads its secrets from the **Pages project**, not from a Worker:

```powershell
npx wrangler@3.114.15 pages secret put CF_ACCESS_AUD --project-name apls-content-studio
```

Repeat for:

- `CF_ACCESS_AUD` (Application Audience tag from the Access app)
- `CF_ACCESS_TEAM_DOMAIN`
- `CMS_ALLOWED_EMAILS` (comma-separated)
- `GITHUB_APP_ID`
- `GITHUB_INSTALLATION_ID`
- `GITHUB_PRIVATE_KEY`

Wrangler prints `Success` but still exits non-zero for these commands; check the
message rather than the exit code.

## 3. GitHub App

Create a GitHub App installed only on `parryying/apls-website` with:

- Metadata: read
- Contents: read and write
- Pull requests: read and write

GitHub issues a **PKCS#1** key (`BEGIN RSA PRIVATE KEY`), but the worker calls
`crypto.subtle.importKey("pkcs8", ...)`. Convert before storing it:

```powershell
& "C:\Program Files\Git\usr\bin\openssl.exe" pkcs8 -topk8 -nocrypt -in <downloaded>.pem -out <converted>.pem
```

Store only the converted key, and delete the temporary file afterwards. Do not
put the key in browser JavaScript, repository files, or GitHub Pages variables.

## 4. GitHub Actions

`Review CMS Content` validates pull requests targeting `main` when an approved
data file, `images/uploads/**`, or `pdfs/uploads/**` changes. CMS-generated
branches must start with `cms/`. Successful same-repository submissions deploy
their exact commit to the existing cPanel staging environment and add the
staging URL to the pull request.

The workflow reuses the existing `cpanel-staging` environment, variables, and
`CPANEL_SSH_PRIVATE_KEY` secret. Production remains the separate protected,
manual exact-SHA workflow.

**Never create a branch named exactly `cms`.** Git cannot hold `refs/heads/cms`
as both a file and a directory, so it blocks every `cms/<editor>/<timestamp>`
branch and GitHub reports `422 Reference update failed`.

### One-time bootstrap

The review workflow and validation scripts must first be reviewed and merged
into `main`. GitHub evaluates pull-request workflows from the protected base
branch, so CMS-generated content pull requests should not be enabled until this
infrastructure commit is present on `main`. After bootstrap, routine Sharon
submissions are created on separate `cms/<editor>/<timestamp>` branches.

## 5. Draft lifetime

A draft is kept while a submission is open, so a refresh restores submitted work
and a follow-up submission still carries its uploaded image bytes. The worker
deletes a draft only when the editor selects **Reset draft** or when
`/api/submissions/current` observes the pull request merged or closed.

A rejected submission therefore needs its pull request **closed** before the
editor returns to published content.

## 6. One open submission per editor

A second submission supersedes the first. After the new pull request is created,
`supersedePreviousSubmissions` finds the editor's earlier submissions, and for
any still open it adds a "Superseded by a newer Content Studio submission"
comment, closes the pull request, and deletes its branch.

This matches the editor's mental model: the CMS shows one status panel, so only
one review should be waiting. It also keeps stale branches from accumulating.
The review dialog warns before the second submit that the previous update will
be replaced.

Superseding never touches pull requests from other editors or branches outside
`cms/*`, and a failure to close an old pull request is logged without failing
the new submission.

## 7. Pilot checks

Before allowing a real update:

1. Sign in with an allowed email and verify a denied email cannot load the CMS.
2. Save a structured draft, refresh, and confirm it reloads from D1.
3. Upload an Event image and confirm WebP conversion, 2,000-pixel maximum edge,
   1 MB normal limit, and IndexedDB recovery.
4. Submit a harmless update and confirm a `cms/*` branch and pull request appear.
5. Refresh after submitting and confirm the draft is restored.
6. Submit a second time and confirm the image is still included and checks pass.
7. Confirm invalid data is blocked in the review dialog before submission.
8. Confirm a valid submission deploys the exact PR commit to `/_newsite/`.
9. Confirm production is unchanged until Parry runs the protected workflow.
10. Replace a PDF from Forms and documents, then confirm the new file appears
    under `pdfs/uploads/YYYY/` on staging and the Forms page links to it.

## 8. PDF documents

`data/documents.js` drives the handbook and policy list on `forms.html`.
Program application forms stay in `data/tuition.js` as `applicationUrl`, so a
program never has two sources of truth; the Programs editor uploads into that
same field.

Uploads land in `pdfs/uploads/YYYY/<slug>-<hash>.pdf`. The worker checks the
path shape, a 10 MB ceiling, and a `%PDF-` signature, so a renamed file cannot
enter the repository.

`prepare-site.sh` keeps a hand-maintained allowlist for the original PDFs but
copies `pdfs/uploads/` wholesale. Without that, an uploaded PDF would pass
review and then be silently dropped at deploy, leaving a broken link on the live
site with nothing failing.

Event image alt text is optional. When it is blank the website derives it from
the item title and date, so a missing description cannot block a submission.

Event images appear full size only on the featured item; other items show a
thumbnail on the Events page.

The local `file://` CMS intentionally retains Save on this computer and Download
update as an owner fallback. Those controls change to cloud save and Submit for
review only on the protected hosted origin.