# IT Job Log: setup (about 15 minutes)

The project has two parts that talk to each other:

| Part | Where it lives | Files |
|---|---|---|
| **Backend** (Sheet, sign-up and login, rules, history, backups) | Google Apps Script, inside a Google Sheet | `apps-script/Code.gs` |
| **Page** (what people see) | GitHub Pages, so it works from any device, anywhere | `github-pages/index.html`, `style.css`, `script.js` |

Do the backend first, because the page needs its address.

## Part 1: backend (Apps Script)

1. Create a new Google Sheet and name it **IT Job Log**.
2. Open **Extensions > Apps Script**.
3. Replace the contents of `Code.gs` with `apps-script/Code.gs`.
4. Select `setup` in the function dropdown and click **Run**. Approve the permissions (Sheets, and Drive for the weekly backup). If Google says "hasn't verified this app", click **Advanced > Go to (project)**. This creates the tabs, the invite list and the backup schedule.
5. **Deploy > New deployment > Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the web app address (it ends in `/exec`).
7. Paste the address into your browser. You should see `{"ok":true,"data":{"service":"IT Job Log API","status":"running"}}`. If so, the backend is live.

## Part 2: the page (GitHub Pages)

1. `github-pages/script.js` already has your backend address in `API_URL` near the top. If you ever create a brand-new deployment, replace it with the new address (keep the quotes).
2. Create a new GitHub repository (it must be **public** on a free account).
3. Upload `index.html`, `style.css` and `script.js` to the root of the repository.
4. In the repository go to **Settings > Pages**. Under **Build and deployment** choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
5. After about a minute the page is live at `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`. Bookmark it, and on a phone use "Add to Home Screen".

Nothing secret is in the repository. The backend address is not a password. What protects the data is the sign-in.

## Signing up

- Only the names in `ALLOWED_USERS` near the top of `Code.gs` can sign up: **El Jefe** and **Nana**.
- Each person opens the page, taps **First time here? Sign up**, types their name and chooses their own password (at least 8 characters). Nobody else ever sees it.
- Once a name has signed up, it cannot be signed up again. When both have signed up, the Sign up link disappears.
- **Sign up before you share the link widely.** Until both people have signed up, anyone with the page address who types an unclaimed name could take that account. Best order: you sign up first, send the link to the other person, wait for them to sign up, and then it is fully closed.

## Passwords and security

- Passwords are never stored. Only a salted, scrambled version is kept in the **Users** tab.
- Five wrong passwords lock that name for 15 minutes. Sign-up guesses share one counter.
- Because the backend address is public, someone who found it could trigger that lock by guessing wrong on purpose. It stops them getting in, but it could keep you out for 15 minutes. No data is exposed. Waiting it out fixes it.
- Sessions last 6 hours of activity, then the person signs in again.
- **Change your password:** Account tab.
- **Someone forgot their password:** in the **Users** tab of the Sheet, delete that person's **Salt** and **Password hash** cells. Their name becomes unclaimed, and they sign up again with a new password. Do this when they are ready to sign up straight away.
- **Allowing another person later:** add their name to `ALLOWED_USERS`, then run `setup` again and create a new deployment version (see below).
- **Blocking someone:** set their **Active** cell in the Users tab to No.
- On a shared computer, change `localStorage` to `sessionStorage` in `script.js` (see the comment above the `store` function).

## What the Sheet holds

| Tab | Contents |
|---|---|
| Jobs | Every job. Deleted jobs stay here, flagged Yes in the Deleted column |
| Staff | Fills itself as new names are logged. Add phone numbers and notes here |
| Devices | Fills itself as devices are logged |
| History | Every change to a job: who, when, old value, new value |
| Config | Categories and statuses. Edit the lists here, no code needed |
| Users | Who may sign in |
| Error Log | Anything that went wrong |

Rename people and devices from the app (not by typing in the Sheet) so their jobs update with them. The staff and device screens for this are not in the page yet; the backend already supports it.

**Backups:** every Sunday around 2am the Sheet is copied into a Drive folder called *IT Job Log Backups*. The newest 8 are kept. You can also run `weeklyBackup` by hand.

## Updating later

- **Page changes** (`index.html`, `style.css`, `script.js`): upload the new file to GitHub. The page refreshes in about a minute. If you do not see the change, do a hard refresh (Ctrl+Shift+R, or close and reopen the app on a phone).
- **Backend changes** (`Code.gs`): paste the new code, then **Deploy > Manage deployments > pencil icon > Version: New version > Deploy**. Saving alone does not update the live backend. Editing the existing deployment keeps the same address, so `script.js` does not need changing. A brand-new deployment creates a new address, which would need pasting into `script.js` again.

## If something goes wrong

- **"This page is not connected yet":** `API_URL` in `script.js` still has the placeholder.
- **"Could not reach the server":** check your internet, then check the address in `script.js` is the `/exec` one. Open it in a browser: you should see the "running" message. If you see a Google sign-in page instead, the deployment's access is not set to **Anyone**.
- **Page shows no styling:** `style.css` is not in the same folder as `index.html` in the repository.
- **Any error shown on screen** is also written to the **Error Log** tab in the Sheet. Send me the text and I will fix it.
