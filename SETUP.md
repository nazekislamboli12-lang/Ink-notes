# Ink Notes v2 — setup (all free)

**Important: this zip has NO folders. All files sit in one place. Upload every file.**
(The old version failed because the `vendor` and `icons` folders did not upload to GitHub.)

## Update your existing GitHub site (keeps your notes)
Use the SAME repository and address as before, so the notes already on your phone stay.
1. Open your repository on github.com. Delete the old `icons` and `vendor` folders (open the folder → ⋯ → Delete directory → Commit).
2. Click **Add file → Upload files**.
3. Unzip `ink-notes-app-v2.zip`. Select ALL files inside and drag them into the page. Wait until all 17 files are listed. Click **Commit changes**.
4. Wait 1–2 minutes. Open your site in Chrome, reload twice.
5. Back up first if you worry: old app → Settings → Save backup. Restore it in the new app (Settings → Restore backup).

## New install (first time)
1. Free account at https://github.com → **+ → New repository** → name `ink-notes`, Public → Create.
2. **uploading an existing file** → drag all files → Commit.
3. **Settings → Pages** → Branch `main`, folder `/ (root)` → Save. Address: `https://YOUR-NAME.github.io/ink-notes/`.

(Optional: Firebase Hosting also works — `firebase init hosting`, public directory `.`, then `firebase deploy`. No other Firebase service is needed.)

## Check that it worked
Open the app → ⚙ Settings → **Check installation**. It must say "All 15 files found ✓". If files are missing it names them.

## Install on phone
Chrome → ⋮ → **Install app**. (If you installed the old version, remove it first, then install again.)

## Gemini key (free)
https://aistudio.google.com/apikey → Create API key (no card). In the app: Settings → paste key → Test my key → Save.

## Using it
- **Add page → photo**: the AI types the page, copies ink colors, rotates sideways text, and REDRAWS illustrations as editable lines and shapes (a drawing moves and deletes as one group).
- Missed a drawing? Draw it with the pen tool, or use the crop tool (last tool) to paste an exact copy from the photo.
- **Select** a thing → round handle on top rotates it; ±90° buttons; corner handles resize; for text the corner handle changes size. Any color with the rainbow circle.
- **Two fingers**: pinch to zoom, drag to move around. One finger on the grey area also scrolls. No need for the zoom tool.
- **Save as PDF** (download icon in a notebook): "Choose which pages" (pages already saved show "PDF ✓", "Not saved yet" selects the rest) or whole notebook. A page's ⋯ menu can save just that page.
- Back up your notes: Settings → Save backup, every week or two.

## Honest notes
- Illustrations are redrawn by the AI as lines and shapes, so they look clean but are an approximation; complex drawings may need touch-ups. Use the crop tool if you want an exact photo copy instead.
- Free Gemini limits apply; photos go to Google.
