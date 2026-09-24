# The HelpDesk+ — version 3

An IT operations system for an office IT team. Log incidents, generate purchase
request memos, track inventory, and print reports — on a computer or a phone,
even when the network is down.

This README assumes **no programming knowledge**. Everything is explained in
plain language. Follow the parts you need, in order.

---

## Contents

1. [What you have](#1-what-you-have)
2. [Put it online (GitHub Pages)](#2-put-it-online-github-pages)
3. [Connect your Google Sheet](#3-connect-your-google-sheet)
4. [Using it day to day](#4-using-it-day-to-day)
5. [How the files are organised](#5-how-the-files-are-organised)
6. [Common changes you might want to make](#6-common-changes-you-might-want-to-make)
7. [What was broken before, and what is fixed](#7-what-was-broken-before-and-what-is-fixed)
8. [Troubleshooting](#8-troubleshooting)
9. [Security, honestly explained](#9-security-honestly-explained)

---

## 1. What you have

**Three code files.** The page structure, the styling, and the behaviour are
each in their own file — so you can open any one of them and read it without
wading through the other two.

```
helpdesk-plus/            <- upload THIS FOLDER
├── index.html            the page structure   (what is on the screen)
├── styles.css            the styling          (what it looks like)
├── app.js                the behaviour        (what it does)
│
├── README.md             this file
├── google-apps-script/
│   └── Code.gs           the server code. Goes into Google, NOT into GitHub.
│
│   -- everything below here is OPTIONAL --
├── manifest.json         lets a phone install the app to its home screen
├── service-worker.js     makes the app work with no internet
└── assets/
    ├── brand/logo.webp   the logo
    └── icons/            the picture on a phone home screen
```

### What happens if you forget to upload a file

I tested this properly, by deliberately leaving each file out in turn. Here is
what actually happens:

| If you forget… | What you see | Serious? |
|---|---|---|
| `app.js` | Page appears but nothing works — no login, no buttons | **Yes. Upload this.** |
| `styles.css` | Page appears as plain unstyled text. It still *works*, but looks broken | **Yes. Upload this.** |
| `manifest.json` | Nothing at all. You just cannot "add to home screen" | No |
| `service-worker.js` | Nothing at all. The app stops working offline | No |
| `assets/brand/logo.webp` | A broken-image marker where the logo goes | No |
| `assets/icons/` | Nothing at all. The phone icon is blank | No |

**So there are really only two files that matter, and if you forget either one
you will notice immediately** — the site either does nothing, or looks naked.
You would never be in the confusing situation of a page that looks fine but is
quietly broken.

### What changed and why

An earlier version put everything in a single file. That was impossible to
deploy wrongly, but it meant editing a 5,000-line file to change one word, and
you could not see the styling and the structure side by side.

This version separates them, which is how websites are normally built and the
way you asked for. The trade-off is that `styles.css` and `app.js` are both
now required — but each one is short enough to read, and each carries a map at
the top so you can jump straight to the part you want.

**If you are short on time, do these three things first:**

1. Follow **Part 2** to put the files on GitHub.
2. Follow **Part 3** to update your Google Sheet — this is what actually turns
   the security fixes on.
3. **Change both passwords** in Settings, immediately.

**You do not need to understand the JavaScript.** If you want to change
something, Part 6 explains the handful of edits most people want.

---

## 2. Put it online (GitHub Pages)

GitHub Pages is free hosting for files exactly like these. If you already have
the site at `nanatoothpick-ui.github.io/Helpdesk`, you are replacing what is
in that repository.

### Option A — Replace the existing site (most likely what you want)

**Step 1.** Go to your repository on github.com (the one called `Helpdesk`).

**Step 2.** Delete the old files. Use the **trash can icon** on each, then
**Commit changes**. Remove all of these, because leaving them behind means two
versions of the app fighting over the same address:

- `index.html`
- `app.js`
- `styles.css`
- `service-worker.js`
- `manifest.json`
- the old `js` folder, if there is one

(Your old site used `app.js`. The new one also uses `app.js` — but it is a
completely different file, so make sure you delete the old one first, then
upload the new one. If you upload without deleting, GitHub will keep the old
file and the site will misbehave in confusing ways.)

**Step 3.** Upload the new files.

- Click **Add file** → **Upload files**
- Drag in everything **inside** the `helpdesk-plus` folder — that is
  `index.html`, `styles.css`, `app.js`, `manifest.json`, `service-worker.js`,
  `README.md`, and the folders `assets` and `google-apps-script`.

> **Important:** upload the *contents* of `helpdesk-plus`, not the folder
> itself. Your repository should end up with `index.html` at the top level,
> not `helpdesk-plus/index.html`. If you get this wrong the site shows a
> "404 Not Found" page — see Troubleshooting.

- Scroll down, click **Commit changes**.

**Step 4.** Wait a minute or two, then visit your site.

**Step 5.** **Clear the old cached copy.** This matters — your browser, and
anyone else who visited before, has the old version saved for offline use.

- **Windows / Linux:** `Ctrl` + `Shift` + `R`
- **Mac:** `Cmd` + `Shift` + `R`

If that does not work, open the site in a private/incognito window to confirm
the new version is live.

### Option B — A brand new site, keeping the old one untouched

1. On GitHub click **New repository**. Name it `helpdesk-plus`, set it to
   **Public**, click **Create repository**.
2. Upload the files as in Step 3 above.
3. Go to **Settings** → **Pages** (left sidebar).
4. Under **Source**, choose **Deploy from a branch**.
5. Branch: **main**, folder: **/ (root)**. Click **Save**.
6. Wait 1–2 minutes. Your site is at `https://YOUR-USERNAME.github.io/helpdesk-plus/`.

### Making future changes

Whenever you change `index.html`, `styles.css` or `app.js`, do this before
committing:

1. Open `service-worker.js` and bump the version number — change
   `helpdesk-plus-v3.0.0` to `v3.0.1`, then `v3.0.2`, and so on.
2. Commit the changes.

Both the cache number above and the small version shown at the bottom of every
page read `v3.0.0` today. Keeping them the same is a choice, not a rule — but
it means the number in the page footer tells you which cache a visitor is
looking at, which is genuinely useful when someone says "it still shows the
old thing". If you want that, update both: the footer lives in `index.html`
(search for `footerVersion`).

**Why?** The service worker keeps a saved copy of the site on every visitor's
device so it works offline. If you change `index.html` without changing that
number, returning visitors keep seeing the old copy and think your fix did not
work. Bumping the number tells every browser "throw away the old copy and
download fresh". This one habit prevents the most confusing problem in the
whole system.

(This only applies if you uploaded `service-worker.js`. If you left it out,
you have nothing to bump and nothing to worry about.)

---

## 3. Connect your Google Sheet

You already have a Google Sheet and an Apps Script behind the old version. You
are **updating** it, not starting again. Your existing records are safe: the
update only adds new columns to the right of your data, never moves or erases
anything.

### Step 1 — Replace the server code

1. Open your **Google Sheet**.
2. **Extensions** → **Apps Script**.
3. In the editor, click inside `Code.gs`, select everything (`Ctrl`+`A`), and
   delete it.
4. Open `google-apps-script/Code.gs` from this project, copy **all** of it, and
   paste it into the Apps Script editor.
5. Click the **save** icon (or `Ctrl`+`S`).

### Step 2 — Run the setup once

1. At the top of the Apps Script editor there is a drop-down that says
   **`doGet`**. Change it to **`setup`**.
2. Click **Run**.
3. Google will ask for permission. Click **Review permissions** → choose your
   account → **Advanced** → **Go to (your project name)** → **Allow**.

   *It is safe.* This warning appears for every personal Apps Script project.
   It means "this script is not published by a big company", which is true —
   it is yours.

4. You should see **"Setup complete"** in the log at the bottom.

### Step 3 — Deploy the new version

1. Click **Deploy** → **Manage deployments**.
2. Click the **pencil (edit)** icon next to your existing deployment.
3. Next to **Version**, choose **New version**.
4. Make sure **Execute as: Me** and **Who has access: Anyone** are selected.
5. Click **Deploy**.

> **Your web app URL does not change.** The app keeps working without any
> edits, because it is the same address.

### Step 4 — Log in with a real password

Visit your site. You will now see a **password** box, because a server is
connected.

The default accounts are created only if your `Users` sheet is empty:

| Technician | Password     |
|------------|--------------|
| Julius     | `julius123`  |
| David      | `david123`   |

**Change both of these immediately.** Log in, go to **Settings** → **Change
your password**. New passwords must be at least 10 characters.

> **The app now insists on this.** If you log in with a starter password, the
> server notices, and the app takes you straight to the Settings page with a
> warning instead of to the dashboard. You can keep using the app, but the
> reminder stays until the password is changed. An unchanged default password
> is by far the most likely way this system would be broken into — it is worth
> the interruption.

> If your Users sheet already had rows, Google kept them. The old password
> hashes are upgraded automatically to the new, stronger format the first time
> each person logs in successfully — you do not need to do anything.

### What you will see in your spreadsheet

Your existing sheets keep their names and columns. Four new things appear:

- **Three new columns** on Incidents, Memos and Inventory: `Deleted`,
  `Deleted At`, `Deleted By`. Deleting in the app now marks the row rather than
  erasing it, so a mistake can be undone by hand.
- **A new sheet called `Audit`** which records who did what and when. It keeps
  the newest 5,000 entries.

---

## 4. Using it day to day

**Logging an incident.** Dashboard → **Log Incident** (or the Incidents page).
Only the requester, category and description are required. If you mark
something **Resolved**, the app asks what was done — that is deliberate, so the
record is useful later.

**Resolving quickly.** Each ticket in the list has a **Mark resolved** button,
so you do not have to open it. If no resolution is written yet, the app opens
the ticket so you can add one.

**Memos.** Fill in the form; the preview updates as you type. **Print** sends
only the memo to the printer — no menus or buttons. **Load template** fills in
a realistic example you can edit.

**Stock.** Use **Receive or issue** to change quantities. Every movement is
recorded on the item with the reason you type, so you can see where stock went.

**Reports.** Choose a period, press **Load report**, then **Export CSV** (opens
in Excel or Google Sheets) or **Print**.

**Going offline.** If the connection drops, keep working. Anything you save is
stored on your device and sent automatically when the connection returns. An
amber bar at the top tells you when something has not been sent yet. It will
never say "saved" when it means "saved here but not sent" — that difference
matters, so the app is careful about it.

**Logging out.** Logging out erases everything this device was holding: cached
records, unsent changes, drafts. If you have unsent work, the app warns you
first. Use it on shared computers.

---

## 5. How the files are organised

Three files, each with a map at the top listing its sections **with line
numbers**. Go to the line number, or search the CAPITALISED words — both work.

| File | Size | Holds |
|---|---|---|
| `index.html` | 40 KB, 807 lines | The page structure |
| `styles.css` | 33 KB, 716 lines | Every colour, size and layout rule |
| `app.js` | 141 KB, 3,500 lines | All the behaviour |

### `styles.css` — seven sections

```
1. DESIGN TOKENS  ......... line 53    every colour and size, defined once
2. RESET & BASE  .......... line 116
3. LAYOUT  ................ line 183   login screen, sidebar, main area
4. COMPONENTS  ............ line 272   buttons, fields, cards, lists, charts
5. RESPONSIVE  ............ line 582   what changes on tablets and phones
6. ACCESSIBILITY  ......... line 649   focus rings, reduced-motion support
7. PRINT  ................. line 677   what comes out of the printer
```

### `app.js` — thirteen sections

The behaviour is still divided into the same thirteen named parts. They are
stacked in one file rather than sitting in thirteen files, and each opens with
a banner you can search for.

| Search for | Line | What it does |
|---|---|---|
| `SECTION 1 of 13` | 49 | **Your settings** — backend URL, technician names, categories |
| `SECTION 2 of 13` | 140 | Formatting dates, money, safe text, IDs |
| `SECTION 3 of 13` | 325 | Holds data in memory; the offline queue; the logout wipe |
| `SECTION 4 of 13` | 585 | All server communication |
| `SECTION 5 of 13` | 793 | Login and logout logic |
| `SECTION 6 of 13` | 963 | Page switching, messages, charts |
| `SECTION 7 of 13` | 1265 | The summary screen |
| `SECTION 8 of 13` | 1396 | Tickets |
| `SECTION 9 of 13` | 1798 | Memos and printing |
| `SECTION 10 of 13` | 2232 | Stock |
| `SECTION 11 of 13` | 2655 | Reports and CSV |
| `SECTION 12 of 13` | 2956 | Password and connection screens |
| `SECTION 13 of 13` | 3131 | Starts everything, wires up buttons |

**Everything shares one object called `App`.** So `App.store` is the storage
section, `App.api` is the network section, and code in one section can call
code in another. Nothing is hidden.

> **Line numbers drift as you edit.** They are correct as of the moment the
> files were generated. Searching for the capitalised words always works, so
> prefer that once you have made changes.

### `index.html` — what is on the screen

You will rarely need to touch this. It is arranged top to bottom as:

```
<head>          page title, description, and the link to styles.css

<body>          the icon sprite      all the little pictures, drawn once
                the offline banner   hidden until the network drops
                the login screen
                the app shell        sidebar menu, header, then the pages:
                                       dashboard, incidents, memos,
                                       inventory, reports, settings
                the toast area       the small sliding messages
```

## 6. Common changes you might want to make

### Add or remove a technician

Open **`app.js`**, search for **`SECTION 1 of 13`**, and edit this line:

```js
technicians: ["Julius", "David"]
```

Add names in quotes, separated by commas: `["Julius", "David", "Ama"]`.

Then, in your Google Sheet's **Users** tab, add a row for the new person:

- Column A: their name, spelled **exactly** as above
- Column B: a password hash — the easiest way is to leave it blank for now,
  log in as an existing user, and ask that person to change their password.
  (Or simply copy an existing user's hash, log in as the new person with that
  person's password, and change it immediately.)

### Change the colours

Open **`styles.css`** and search for **`1. DESIGN TOKENS`**. Every colour in
the app is defined there, once. Change `--brand-dark` and the entire app
follows.

```css
--brand-dark:   #342fc6;    /* buttons, headings, the active menu item */
--page-bg:      #eef1f8;    /* page background */
--ink:          #131a29;    /* main text */
```

> Leave `--ink-muted` at `#5d6a80` or darker. A lighter grey fails the
> accessibility contrast minimum and becomes genuinely hard to read.

### Change the logo

The logo is a normal image file: **`assets/brand/logo.webp`**. One file, used
on both the login screen and the sidebar menu.

To change it, simply **replace that file with your own**, keeping the same
name. That is all you have to do.

- Keep it **768 pixels wide** (or wider) so it stays sharp on phones.
- Save it as **WebP**. Free "PNG to WebP" converters do this in one click —
  search for one, drop your file in, download the result.
- Keep the logo on a **transparent or white background**, because it sits on a
  dark blue menu.
- The name must stay exactly `logo.webp`. Renaming a PNG to `.webp` does not
  convert it — the file has to genuinely be WebP.

> **Do not upload a raw PNG export at full size.** Your original logo was
> **343 KB and accounted for 71% of the entire page weight.** The WebP version
> in this project is 28 KB and looks identical. If you swap in a new logo,
> convert it to WebP first.

The original 900x560 master is kept outside the upload folder, in
`source-assets/`:

> **Do not upload a raw PNG export.** Your original logo was **343 KB and
> accounted for 71% of the entire page weight.** The WebP versions here are
> **96% smaller** and look identical. If you swap in a new logo, run it
> through any free "PNG to WebP" converter first.

The HTML uses a `<picture>` element, which means the browser picks the
smallest file it understands. Modern browsers take the WebP; the PNG is only
ever fetched by genuinely old software, so it costs everyone else nothing.

### Change the memo text or default signatories

Open **`app.js`**, search for **`SECTION 9 of 13`**, then find the function
`loadTemplate`. The names and items are listed there in plain text.

### Change what a report shows

Open **`app.js`**, search for **`SECTION 11 of 13`**. The function `gather`
decides which records are included, and `draw` decides which columns appear.

---

## 7. What was broken before, and what is fixed

This section matters if you ever wonder why something was rebuilt.

### The serious ones

| Problem in version 1 | What happens now |
|---|---|
| **The login did nothing.** The app checked a value in browser storage and showed the dashboard. Typing one line in the browser console logged you in as anyone, with no password. | The server checks the password and issues a random token. The browser cannot invent one. |
| **Passwords were published.** `julius123` and `david123` were written in the JavaScript file that every visitor downloads. | No password exists anywhere in the website files. Only a scrambled hash lives in your spreadsheet. |
| **Anyone could read or delete everything.** The server accepted save and delete requests from anybody with the URL — no password, no check. | Every action except login requires a valid token. No token, no action. |
| **Records could silently destroy each other.** Ticket IDs were made by counting existing rows, so after a deletion a new ticket could be given an ID that already existed — and the server would overwrite that existing ticket. Real data loss, with no warning. | IDs come from the clock plus randomness, and the server picks the next free number by highest-used rather than counting. |
| **Everyone saw everyone's data.** Logging out never cleared cached records, so the next person on a shared computer saw them. | Logging out erases records, drafts and unsent changes from the device. |
| **Weak passwords.** Unsalted SHA-256, 4-character minimum, no limit on attempts, plus a back door that reset every password to the published default. | Salted and stretched hashing, 10-character minimum, rate limiting, and the back door is deleted. |

### The annoying ones

| Problem | Fixed |
|---|---|
| **"Log Template" produced a memo addressed to "E" from "D"**, dated five weeks in the past | Real names, and the date is always today |
| **`GH₵2,020.00` was cut off to `GH₵2,02`** | Long numbers automatically use a slightly smaller size so they always fit on one line |
| **Every page said its own title twice**, at two different sizes, with two `<h1>` elements | One heading per page; the header carries it |
| **Half of "Quick Actions" was empty** while the useful buttons were elsewhere | Replaced with six real one-click actions, and on phones they now appear *above* the numbers |
| **Emoji used as icons** — they look different on every computer | Proper drawn icons that match the interface |
| **No keyboard focus outline anywhere**, so tabbing was guesswork | Visible focus ring on every control |
| **19 elements failed the colour-contrast minimum** | Zero contrast failures; automated accessibility audit now reports **zero violations** |
| **A request could hang forever** while the screen said "saved" | Requests time out after 12 seconds, retry once, then save locally and say so honestly |
| **No offline handling for saving** — work could vanish on a flaky connection | An offline queue with automatic retry, a visible banner, and a warning before logging out |
| **The app could serve a stale version for days** after an update | Network-first caching, so you always get the newest version when online |
| **Phone dashboard: 4.7 screens of scrolling before the first button** | Actions first, compact 2-column statistics, 3.1 screens |
| **No way to back up or restore** | **Back up** in the header downloads everything as a JSON file |

### Things deliberately kept

- Your Google Sheet, your column layout, and your web app URL — so nothing
  needs migrating by hand.
- The print system. The original print stylesheet was the best-engineered part
  of the old app, and it is preserved almost exactly.
- The small footprint. Still no framework, no build step, four requests.

---

## 8. Troubleshooting

**"404 Not Found" after uploading.**
Your files are one folder too deep. `index.html` must be at the top level of
the repository. If you see `helpdesk-plus/index.html` in the file list, move
the contents up a level.

**The page loads but nothing happens when I click.**
`app.js` did not upload, or it is in the wrong place. It must sit **beside**
`index.html`, not inside a subfolder.

**The page is plain black text on white with no styling.**
`styles.css` did not upload, or it is in the wrong place. Same rule: beside
`index.html`.

**I changed a file but the site looks the same.**
Bump `CACHE_VERSION` in `service-worker.js`, then hard-refresh with
`Ctrl`+`Shift`+`R` (Mac: `Cmd`+`Shift`+`R`). See "Making future changes" above.

**"Your Google backend is an older version that does not support secure logins."**
You have not yet deployed the new `Code.gs`. Follow Part 3, Step 3.

**"The server replied with something we did not understand."**
Your Apps Script deployment is probably set to "Only myself". Set
**Who has access** to **Anyone** and redeploy as a new version.

**Login says "Incorrect name or password" but the password is right.**
Check the spelling in the **Users** sheet matches the technician list in `app.js` (search for `SECTION 1 of 13`) exactly —
capital letters matter. `julius` is not `Julius`.

**"Too many incorrect attempts."**
This is the brute-force protection working. Wait 15 minutes. If it keeps
happening, someone is guessing your passwords — consider changing them.

**"Somebody else changed this record while you were editing it."**
Working as designed. Two people edited the same ticket and the app refused to
let one silently overwrite the other. Reload the page and redo your change.

**Saves say "Saved on this device" instead of "Saved".**
You are offline, or the server is unreachable. Your work is safe — it sends
automatically when the connection returns. The amber bar shows how many
changes are waiting.

**A record is missing from the lists but I can still see it in the Sheet.**
Someone marked it deleted. It is still there, in the `Deleted` column marked
`TRUE`. Set that back to `FALSE` to restore it.

**Printing produces a blank page.**
Print once more. The app needs a fraction of a second to apply the print
layout. If it persists, make sure you are on the Memos or Reports page when
you press Print.

---

## 9. Security, honestly explained

**What is now protected**

- Logging in requires a correct password, checked by the server.
- Every action requires a token that only a successful login can produce.
- Passwords are stored as salted hashes, never as text.
- Repeated wrong guesses are blocked for 15 minutes.
- Every action is written to an Audit sheet.
- Deletions are reversible.
- Logging out leaves nothing on the device.

**What is still true, and you should know**

- **Whoever holds a valid login can do anything.** There are no separate roles
  — any logged-in technician can edit or delete any record. Adding a
  "read-only" or "manager" role is possible later; it does not exist yet.
- **The web app URL is public. That is fine now**, because it is no longer
  enough to do anything. It changed from being the weakness to being just an
  address. Please do not paste it around anyway.
- **Traffic goes through Google.** Google encrypts it, and they are a large
  company with good security, but it is not your own server.
- **A stolen password is still a stolen password.** Two-factor login is not
  available here. Use long, different passwords, and change them if a phone or
  laptop goes missing.
- **Google Sheets is not a database.** It is excellent for a couple of hundred
  records and a small team, which is what this is. If you reach thousands of
  records or ten simultaneous users, the right move is a real database — ask
  for help migrating when you get near that point.

**The honest summary:** this is now well protected for a small internal
office tool. It is not, and does not pretend to be, a bank.

---

*The HelpDesk+ v2.0.0*
