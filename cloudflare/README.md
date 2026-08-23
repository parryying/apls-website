# APLS Cloud Content Studio Setup

The repository contains the cloud-ready CMS frontend, Worker API, D1 schema,
shared validation, and GitHub review workflow. Account resources and secrets are
intentionally not committed.

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

1. Use the Direct Upload Pages project `apls-content-studio`.
2. Keep `cms` as its production branch.
3. Build with `npm run build:cms`; the output directory is `dist-cms`.
4. Add `cms.apls.org`, or use the Pages domain during the pilot.
5. Create a Cloudflare Access self-hosted application covering the CMS origin.
6. Allow only Sharon's and Parry's approved email addresses.
7. Enable email one-time PIN authentication.

The CMS and API must use the same protected origin, or the API must be mounted
under `/api/*` through a Worker route for that origin.

### Automatic deployment

`.github/workflows/cloudflare-cms.yml` validates, builds, and deploys the CMS
after every push to `main`. Configure these GitHub Actions credentials:

- Repository variable `CLOUDFLARE_ACCOUNT_ID`
- Repository secret `CLOUDFLARE_API_TOKEN`

Create the API token with Cloudflare Pages edit permission and scope it to the
APLS account. The workflow pins Wrangler 3.114.15 and deploys with branch `cms`
so Direct Upload treats the result as production. `workflow_dispatch` can retry
a deployment without another commit.

## 2. D1 and Worker

From `cloudflare/`, create the database and apply the migration:

```powershell
npx wrangler d1 create apls-content-studio
npx wrangler d1 migrations apply apls-content-studio --remote
```

Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.toml` with the returned ID.

Set non-secret variables in `wrangler.toml` and configure these encrypted
secrets through `wrangler secret put`:

- `CF_ACCESS_AUD`
- `CF_ACCESS_TEAM_DOMAIN`
- `CMS_ALLOWED_EMAILS` (comma-separated)
- `GITHUB_APP_ID`
- `GITHUB_INSTALLATION_ID`
- `GITHUB_PRIVATE_KEY`

Deploy with:

```powershell
npx wrangler deploy
```

## 3. GitHub App

Create a GitHub App installed only on `parryying/apls-website` with:

- Metadata: read
- Contents: read and write
- Pull requests: read and write

Do not put its private key in browser JavaScript, repository files, or GitHub
Pages variables. Store it only as a Worker secret.

## 4. GitHub Actions

`Review CMS Content` validates pull requests targeting `main` when an approved
data file or `images/uploads/**` changes. CMS-generated branches must start with
`cms/`. Successful same-repository submissions deploy their exact commit to the
existing cPanel staging environment and add the staging URL to the pull request.

The workflow reuses the existing `cpanel-staging` environment, variables, and
`CPANEL_SSH_PRIVATE_KEY` secret. Production remains the separate protected,
manual exact-SHA workflow.

### One-time bootstrap

The review workflow and validation scripts must first be reviewed and merged
into `main`. GitHub evaluates pull-request workflows from the protected base
branch, so CMS-generated content pull requests should not be enabled until this
infrastructure commit is present on `main`. After bootstrap, routine Sharon
submissions are created on separate `cms/<editor>/<timestamp>` branches.

## 5. Pilot checks

Before allowing a real update:

1. Sign in with an allowed email and verify a denied email cannot load the CMS.
2. Save a structured draft, refresh, and confirm it reloads from D1.
3. Upload an Event image and confirm WebP conversion, 2,000-pixel maximum edge,
   1 MB normal limit, IndexedDB recovery, and required alt text.
4. Submit a harmless update and confirm a `cms/*` branch and pull request appear.
5. Confirm invalid data fails checks and does not deploy staging.
6. Confirm a valid submission deploys the exact PR commit to `/_newsite/`.
7. Confirm production is unchanged until Parry runs the protected workflow.

The local `file://` CMS intentionally retains Save on this computer and Download
update as an owner fallback. Those controls change to cloud save and Submit for
review only on the protected hosted origin.