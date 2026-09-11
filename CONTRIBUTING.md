# Bento CRM — contributor guide (dev only)

This guide takes you from zero to a merged change on the **dev** environment.

> ## Golden rules
>
> 1. **You only ever work against `dev`.** Never push to `main`, never open a pull
>    request that targets `main`. `main` is production (`crmbento.com` /
>    `api.crmbento.com`) and is off-limits for now.
> 2. Your work reaches the dev site by being **merged into `dev`** — a push to
>    `dev` auto-deploys to `dev.crmbento.com` (frontend) and
>    `apidev.crmbento.com` (backend).
> 3. If you are ever unsure which branch you are on, run `git status` before you
>    commit or push.

The two repos:

| Repo | Stack | Local port | Dev URL |
|---|---|---|---|
| `bento-crm` | Angular 21 + a small Node/Express server | 4200 (or 3000) | https://dev.crmbento.com |
| `bento-backend` | Spring Boot 3 / Java 17 / PostgreSQL / Redis | 8080 | https://apidev.crmbento.com |

Clone only the repo(s) you are actually working on. This file is identical in
both.

---

## 1. What you need

### Accounts / access (ask the maintainer)

- A **GitHub account**, added as a **collaborator with Write access** to
  `achrafouajid/bento-crm` and/or `achrafouajid/bento-backend`.
  (Alternative if you are not made a collaborator: **fork** the repo and open
  PRs from your fork — see §7.)
- Nothing else. You do **not** need VPS/SSH access, Docker Hub, or GHCR — the
  deploy runs automatically from GitHub Actions.

### Tools

| Tool | Version | Needed for | Install |
|---|---|---|---|
| Git | any recent | everything | https://git-scm.com |
| Node.js | **22.x** (LTS) | `bento-crm` | https://nodejs.org or `nvm install 22` |
| npm | ships with Node 22 | `bento-crm` | — |
| JDK | **17** (Temurin) | `bento-backend` | https://adoptium.net or `sdk install java 17-tem` |
| Maven | **3.9+** | `bento-backend` | https://maven.apache.org or `sdk install maven` |
| Docker + Docker Compose | any recent | `bento-backend` local DB/Redis (easiest path) | https://docs.docker.com/get-docker |

Check:

```bash
git --version
node --version   # v22.x   (bento-crm)
java -version    # 17.x    (bento-backend)
mvn --version    # 3.9+    (bento-backend)
docker --version # (bento-backend)
```

---

## 2. One-time setup

### Configure your git identity (once per machine)

```bash
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"   # the email on your GitHub account
```

### Clone and land on `dev`

```bash
# frontend
git clone https://github.com/achrafouajid/bento-crm.git
cd bento-crm
git checkout dev

# backend (in another folder)
git clone https://github.com/achrafouajid/bento-backend.git
cd bento-backend
git checkout dev
```

`git branch` should show a `*` next to `dev`. **Do not** run `git checkout main`.

### Optional but recommended: make `main` un-pushable from your machine

A safety net so you can't accidentally push production. Run this **inside each
clone**:

```bash
git remote set-url --push origin no-push-to-any-branch-directly   # disables `git push` with no args
# …then push explicitly to your branches as shown in §3. OR, lighter touch:
git config branch.main.pushRemote NO_PUSH
```

If you skip this, just be careful. The maintainer should also protect `main`
server-side (see §8).

---

## 3. The daily workflow

### 3.1 Start from an up-to-date `dev`

```bash
git checkout dev
git pull origin dev
```

### 3.2 Create a short-lived branch off `dev`

Name it `feat/…`, `fix/…`, or `chore/…` + a few words:

```bash
git checkout -b feat/customer-search-filters
```

### 3.3 Make your changes and run things locally

See §4 (frontend) / §5 (backend). Also run the checks:

```bash
# bento-crm
npm run lint
npm test

# bento-backend
mvn test
```

### 3.4 Commit

```bash
git add -A
git commit -m "Add status + owner filters to the customer list"
```

Write the message in the imperative mood ("Add…", "Fix…", "Refactor…"), one
logical change per commit where practical.

### 3.5 Keep your branch current (if `dev` moved while you worked)

```bash
git fetch origin
git rebase origin/dev
# resolve any conflicts, then: git rebase --continue
```

### 3.6 Push your branch (never `dev`, never `main`)

```bash
git push -u origin feat/customer-search-filters
```

### 3.7 Open a Pull Request **into `dev`**

- GitHub will print a PR link after the push, or go to the repo → *Compare & pull
  request*.
- **base branch = `dev`**, compare branch = your `feat/…` branch.
- If GitHub pre-selects `main` as the base, **change it to `dev`.**
- Fill in what changed and how you tested it. Tag the maintainer for review.

### 3.8 Get it merged

The maintainer reviews and merges into `dev`. **The merge is what deploys** —
there is no build on the PR itself. Within a few minutes:

- frontend → https://dev.crmbento.com
- backend  → https://apidev.crmbento.com/api/v1/actuator/health should be `{"status":"UP"}`

You can watch the run under the repo's **Actions** tab ("Build and deploy …",
branch `dev`).

### 3.9 Clean up

```bash
git checkout dev
git pull origin dev
git branch -d feat/customer-search-filters
git push origin --delete feat/customer-search-filters   # optional
```

---

## 4. Running `bento-crm` locally

```bash
cd bento-crm
npm install
npm start            # http://localhost:4200
#   or: npm run dev  # http://localhost:3000, listens on 0.0.0.0
```

- The dev build talks to a backend at **`http://localhost:8080/api/v1`**
  (see `src/environments/environment.ts`). Run `bento-backend` locally (§5) for a
  full stack, or temporarily point `environment.ts` at
  `https://apidev.crmbento.com/api/v1` to use the shared dev backend.
- **Do not commit** a changed `environment.ts` / `environment.dev.ts` /
  `environment.prod.ts` unless changing the API URL is the actual point of your
  PR. `environment.dev.ts` must stay pointed at `https://apidev.crmbento.com`.
- Ignore the old "AI Studio / GEMINI_API_KEY" text in `README.md` — it's
  leftover boilerplate; the app needs no `.env`.
- Useful: `npm run lint`, `npm test`, `npm run build:dev` (compiles exactly what
  CI ships to dev).

---

## 5. Running `bento-backend` locally

### Easiest: everything in Docker

```bash
cd bento-backend
cp .env.example .env          # then edit .env: set REDIS_PASSWORD, PGADMIN_*, a 32+ char JWT_SECRET
docker compose up -d          # postgres + redis + app + pgadmin
# API:        http://localhost:8080/api/v1
# Swagger:    http://localhost:8080/swagger-ui.html
# health:     http://localhost:8080/api/v1/actuator/health
docker compose logs -f app
```

### Or: DB/Redis in Docker, app from Maven (faster iteration)

```bash
cp .env.example .env
docker compose up -d postgres redis
export $(grep -v '^#' .env | xargs)      # load DB_*, REDIS_* into your shell
export DB_HOST=localhost REDIS_HOST=localhost
mvn spring-boot:run
```

- Flyway runs the migrations in `src/main/resources/db/migration` on startup
  against a **local** database — never against dev or prod.
- `mvn test` uses Testcontainers and needs Docker running.
- Never point your local `.env` at the dev or prod database.

---

## 6. Conventions & what not to do

**Do**

- One PR = one focused change. Small PRs get reviewed faster.
- Rebase on `origin/dev` before asking for review.
- Run `lint` + `test` before pushing.
- Keep secrets out of commits. `.env` is git-ignored — keep it that way.

**Never**

- `git push origin main` / `git push origin HEAD:main` — production.
- Open or re-target a PR to `main`.
- `git push --force` to `dev` or `main` (force-push only your own `feat/…`
  branch, and only if you know why).
- Commit `node_modules/`, `target/`, `dist/`, `.env`, IDE folders.
- Edit `.github/workflows/`, `deploy.sh`, `docker-compose*.yml`, or
  `environment.prod.ts` unless that is explicitly your task — ping the
  maintainer first.

### Recovery: "I committed on the wrong branch"

You committed to local `dev` (or `main`) instead of a feature branch, but
**haven't pushed**:

```bash
git branch feat/my-change            # save your work onto a new branch
git reset --hard origin/dev          # (or origin/main) reset the local branch back
git checkout feat/my-change          # carry on from here
```

If you already pushed to `dev` by mistake, tell the maintainer immediately —
don't try to force-push a fix.

---

## 7. If you use a fork instead of a collaborator branch

```bash
# fork on github.com first (Fork button), then:
git clone https://github.com/<you>/bento-crm.git
cd bento-crm
git remote add upstream https://github.com/achrafouajid/bento-crm.git
git checkout -b feat/thing upstream/dev
# …work…
git push -u origin feat/thing
```

Open the PR from `<you>:feat/thing` **into `achrafouajid/bento-crm:dev`**.
Keep in sync with `git fetch upstream && git rebase upstream/dev`.

---

## 8. For the maintainer — lock `main` so contributors can't touch it

Run once per repo (needs `gh auth login` as the repo owner):

```bash
# Require PRs + 1 review for main, block direct pushes and force-pushes
gh api -X PUT repos/achrafouajid/bento-crm/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks=null' \
  -F 'enforce_admins=false' \
  -f 'required_pull_request_reviews[required_approving_review_count]=1' \
  -f 'restrictions=null' \
  -F 'allow_force_pushes=false' -F 'allow_deletions=false'

# Repeat for bento-backend
gh api -X PUT repos/achrafouajid/bento-backend/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks=null' \
  -F 'enforce_admins=false' \
  -f 'required_pull_request_reviews[required_approving_review_count]=1' \
  -f 'restrictions=null' \
  -F 'allow_force_pushes=false' -F 'allow_deletions=false'
```

To also stop a contributor from pushing straight to `dev` (force PRs there too),
add the same protection to the `dev` branch with
`required_pull_request_reviews` and `enforce_admins=false`.

Add a collaborator: repo → **Settings → Collaborators → Add people**, role
**Write**.

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `git push` rejected, "protected branch" on `main` | You targeted `main`. Push your `feat/…` branch and open a PR into `dev`. |
| PR shows hundreds of changed files | Your branch is based on an old `dev`. `git fetch origin && git rebase origin/dev`. |
| Frontend loads but every API call fails | Backend isn't running locally, or `environment.ts` points somewhere unreachable. Start `bento-backend` (§5) or point at `https://apidev.crmbento.com/api/v1`. |
| `mvn spring-boot:run` fails to connect to DB | `docker compose up -d postgres redis` first, and `export DB_HOST=localhost REDIS_HOST=localhost`. |
| Dev site didn't update after merge | Check the repo's **Actions** tab, branch `dev`. A red run means the deploy failed — send the log to the maintainer. |
| `npm install` errors on Node version | You're not on Node 22. `nvm install 22 && nvm use 22`. |
