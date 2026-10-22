# Plate & Progress — your own hosted app

Food log, diet plans, recipes, water, workouts and progress. People sign in with **Google only**, and each person's data is saved in **their own Google Drive**. There is no server and no database: the website talks to Google directly from the browser.

It works on any computer, and on iPhone and Android it can be added to the home screen like an app.

---

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The app |
| `config.js` | **Your settings** (Google client ID, admin email, optional AI helper) |
| `platform.js` | Google sign-in and Google Drive saving |
| `access-codes.json` | The list of workout access codes (only scrambled codes, never the real ones) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Makes the app installable on phones |
| `worker/ai-helper.js` | Optional AI helper for reading PDFs/photos, recipe ideas and nutrition lookup |
| `tools/` | Only for rebuilding `index.html`; not needed on the website |

---

## Step 1 — Put the app on GitHub Pages (free)

1. Sign in at **github.com** (create a free account if you need one).
2. Click **+** (top right) → **New repository**. Name it `plate-progress`, choose **Public**, click **Create repository**.
3. On the new repository page click **uploading an existing file**. Drag in **everything inside this folder** (keep the `icons` and `worker` folders). Click **Commit changes**.
4. Go to **Settings → Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**, branch **main**, folder **/ (root)**. Click **Save**.
5. After a minute the page shows your address, for example
   `https://YOUR-NAME.github.io/plate-progress/`
   Keep this address — you need it in Step 2.

The app opens but sign-in won't work until Step 2 is done.

---

## Step 2 — Turn on "Sign in with Google" (free)

1. Go to **console.cloud.google.com** and sign in with your Gmail.
2. At the top, click the project picker → **New project**. Name it `Plate and Progress` → **Create**, then select it.
3. **APIs & Services → Library**: search **Google Drive API** → **Enable**.
4. **OAuth consent screen** (newer consoles call this **Google Auth Platform → Branding / Audience / Data access**):
   - App name: `Plate & Progress`, support email: your Gmail.
   - Audience / user type: **External**.
   - Scopes / Data access: add `.../auth/drive.file`, `openid`, `email`, `profile`.
     `drive.file` only lets the app see files **it created** — it can't read anything else in anyone's Drive.
   - **Test users**: add the Gmail address of every person who will use the app (up to 100 while the app is in Testing).
5. **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: add `https://YOUR-NAME.github.io` (just the domain, no `/plate-progress`, no trailing slash).
   - Click **Create** and copy the **Client ID** (ends in `.apps.googleusercontent.com`).
6. Back on GitHub, open `config.js` → pencil icon (**Edit**) → paste the Client ID into `GOOGLE_CLIENT_ID` → **Commit changes**.

Wait a minute, open your site, and tap **Continue with Google**.

> **"Google hasn't verified this app"** — while the app is in **Testing**, Google shows this warning to your test users. They tap **Continue**. To remove the warning and allow anyone (not just test users), use **Publish app** on the consent screen. Because the app only uses `drive.file`, Google treats it as a non-sensitive app; it may ask you to verify your home page and privacy policy.

---

## Step 3 — Workout access codes (admin)

The admin is the Gmail set in `ADMIN_EMAIL` in `config.js`. The admin always has the Workout tab.

To give someone access:

1. In the app, open **Profile & data → Admin · Workout access codes**.
2. Enter their **Gmail address** and a name → **Generate code**.
3. Send them the code (Copy or Share on WhatsApp).
4. Click **Copy line**, then on GitHub open `access-codes.json` → **Edit** and paste the line inside the `[ ]` list (put a comma between lines). **Commit changes.**

   ```json
   [
     {"h":"f51478bfd8f1e3…","label":"Ravi","who":"ra***@gmail.com","created":"2026-10-22"}
   ]
   ```

5. The person signs in with **that** Gmail, opens **Workout**, and enters the code.

A code works **only** for the Gmail it was made for. To turn access off, delete that line (or add `"off": true`) and commit.

Tip: set `ACCESS_FILE_EDIT_URL` in `config.js` to
`https://github.com/YOUR-NAME/plate-progress/edit/main/access-codes.json`
and the admin panel shows a button that opens it directly.

---

## Step 4 (optional) — AI helper

Reading the trainer's PDFs/photos, BMI reports, label scanning, nutrition lookup and "Fresh recipe ideas" need an AI model. An API key can't be put in a public website, so a tiny free **Cloudflare Worker** holds it. Without this step those buttons simply don't appear; everything else works.

1. Get an API key at **console.anthropic.com** (pay per use; a typical food-plan PDF or lookup costs a fraction of a cent to a few cents).
2. Sign up at **dash.cloudflare.com** → **Workers & Pages → Create → Create Worker** → **Deploy**, then **Edit code**. Replace everything with the contents of `worker/ai-helper.js` → **Deploy**.
3. Worker → **Settings → Variables and secrets**, add:
   - `ANTHROPIC_API_KEY` (type **Secret**) — your key
   - `GOOGLE_CLIENT_ID` — same as in `config.js`
   - `ALLOWED_ORIGIN` — `https://YOUR-NAME.github.io`
   - optional `ALLOWED_EMAILS` — comma-separated Gmails allowed to use AI (to control cost)
4. Copy the Worker address (like `https://plate-progress-ai.YOUR-NAME.workers.dev`) into `AI_ENDPOINT` in `config.js` and commit.

The helper only answers people signed in to **your** app with Google, and only from your site's address.

---

## Step 5 — Google Sites

Google Sites can't run this app inside its pages: embedded code runs in a locked-down frame where Google sign-in and Drive saving are blocked. Link to it instead:

1. In your Google Site, **Insert → Button**.
2. Name: `Open Plate & Progress`, Link: your GitHub Pages address → **Insert**.

Optionally add the app icon (`icons/icon-512.png`) above the button.

---

## Step 6 — Install on phones

- **iPhone (Safari):** open the site → **Share** → **Add to Home Screen**.
- **Android (Chrome):** open the site → **⋮** → **Install app** (or **Add to Home screen**).

It opens full screen with the Plate & Progress icon.

---

## Moving data from the Claude version

Google keeps each app's files separate, so this site can't see the data file the Claude version saved. To bring meals across:

1. In the Claude version: **Profile & data → Export to Excel**.
2. In this site: create your profile, then **Profile & data → Import Meal Log from Excel**.

Re-enter weights and re-upload trainer plans (or copy them by hand); they're quick to redo.

---

## Good to know

- **Where data lives:** one private file per person, `Plate and Progress data (do not edit).json`, plus the readable Excel food log, both in their own Google Drive. Nothing is stored on GitHub or Cloudflare. The browser only remembers which Drive file to open.
- **Saving:** the app saves a few seconds after each change. Each save writes a fresh copy and moves the old one to Drive **Trash**, which Google empties after 30 days.
- **Sign-in lasts about an hour.** After that, the status at the top says the session expired — tap it, or **Continue with Google**, to carry on. Nothing is lost.
- **Access codes are a lock on the app, not a bank vault:** the app's code is public on GitHub, so a technical person could switch the Workout tab on in their own browser. Their data would still be only theirs.
- **Updating the app later:** replace `index.html` (and other files) on GitHub with the new versions. People get the update the next time they open the app.
