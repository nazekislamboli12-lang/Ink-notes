# Ink Notes — setup (all free)

Ink Notes is a web app you install on your phone like a normal app. You photograph a whiteboard or page of handwritten notes, an AI types it into an editable page, you fix it, and add it to a notebook. Notebooks can be saved as PDF.

Everything is free: Google's free Gemini key for the AI, and free hosting for the app. No card needed anywhere.

---

## Step 1 — Get a free Gemini API key (2 minutes)

1. Open https://aistudio.google.com/apikey in Chrome and sign in with your Google account.
2. Click **Create API key** and copy the key. Do NOT add a billing account; the free tier needs none.
3. Keep the key private. You will paste it into the app later (Step 4). It is saved only on your phone.

## Step 2 — Put the app online (needed once)

The app must be opened from a web address (https) so the camera, "install" and offline mode work. Pick ONE option.

### Option A — GitHub Pages (easiest, no software to install)

1. Create a free account at https://github.com.
2. Click **+** (top right) → **New repository**. Name it `ink-notes`, keep it **Public**, click **Create repository**.
3. On the empty repo page, click **uploading an existing file**.
4. Unzip `ink-notes-app.zip` on your computer. Open the `ink-notes` folder, select EVERYTHING inside it (index.html, app.js, the `icons` and `vendor` folders, etc.) and drag it into the GitHub page. Wait for the upload to finish, then click **Commit changes**.
   - Check that the `icons` and `vendor` folders are there with their files inside.
5. Go to **Settings → Pages**. Under "Branch" choose **main** and **/ (root)**, then **Save**.
6. After 1–2 minutes the page shows your address: `https://YOUR-NAME.github.io/ink-notes/`.

Nothing secret is in these files (your key is never uploaded), so a public repository is fine.

### Option B — Firebase Hosting (you asked about Firebase)

Firebase is optional for this app. You only use its free **Hosting**. You do NOT need Firestore, Storage, Authentication or "AI Logic" (see the note at the bottom).

1. Install Node.js from https://nodejs.org (the LTS version).
2. Open a terminal in the unzipped `ink-notes` folder and run:
   ```
   npm install -g firebase-tools
   firebase login
   firebase init hosting
   ```
   When asked: choose **Create a new project** (give it any name), **public directory: `.`** (a single dot), **single-page app: No**, and **do not overwrite index.html**. Do not enable GitHub deploys.
3. Run `firebase deploy`. It prints your address, like `https://your-project.web.app`.
4. Stay on the free **Spark** plan. If Firebase ever asks you to switch to Blaze or add a card, stop: you don't need it.

(The included `firebase.json` is already set up.)

## Step 3 — Install it on your phone

1. Open your address in **Chrome** on your phone.
2. Tap the **⋮** menu → **Install app** (or **Add to Home screen**).
3. Open **Ink Notes** from your home screen.

## Step 4 — Connect the AI

1. In the app tap the sliders icon (top right) → **Settings**.
2. Paste your key, tap **Test my key**. It should say "Works with …".
3. Tap **Save**.

## Step 5 — Use it

1. **New notebook** → name it, for example "Botany".
2. **Add page** → **Take a photo** (or **Photo from gallery**).
3. Wait. The page opens in review mode:
   - Tap **Show photo** to lay your photo over the typed page and compare.
   - Yellow text = the AI was not sure.
   - **Select tool** (arrow): tap something to move it; drag the round handles to resize arrows/circles; tap the pencil to retype text; the bin deletes it. Double-tap text to retype it. Undo/redo are at the top.
   - **Text, pen, arrow, line, circle, box, brace** tools add new things. Pick colors and thickness in the bar above the tools.
4. Press **Add to notebook**. Press **Discard** if the photo was bad.
5. **Add page → Image or PDF from my files** adds normal pages (images or PDFs). You can write and draw on them too. **Blank page** gives an empty one.
6. Tap the **star** on a page to bookmark it. The star on the home screen lists every bookmark.
7. In a notebook, the **download** icon saves the whole notebook as a PDF. In a page's **⋯** menu you can save that page as an image.
8. Pages can be moved with the arrows under each thumbnail.

## Step 6 — Back up your notes (important)

Your notes live inside your phone's browser storage. If you clear the browser data or uninstall, they are gone.
**Settings → Save backup** creates a file. Do it every week or two and keep the file in Google Drive. **Restore backup** puts everything back (also how you move notes to a new phone).

---

## Good to know

- **Free limits:** Google's free Gemini tier has a small daily/per-minute limit and Google changes it from time to time. A few photos at a time is fine. If you see "limit reached", wait and try again.
- **Models:** the default is `gemini-3.8-flash`. If a model stops being free or is renamed, the app tries other free ones automatically. You can type another model name in Settings.
- **Privacy:** photos are sent to Google for reading. On the free tier Google may use them to improve its products. Don't use it for private documents.
- **Accuracy:** AI can misread messy handwriting or place an arrow a little off. That is exactly what the review screen is for.
- **Firebase AI Logic is not used:** in the current Firebase rules it requires an extra security setup (App Check, mandatory since 2 Nov 2026), so a direct free key is simpler. Cloud Storage for Firebase may also need a paid plan, so the app keeps everything on your device instead.
- **Updating the app later:** upload the new files over the old ones (GitHub) or run `firebase deploy` again. The app updates the next time you open it with internet.
