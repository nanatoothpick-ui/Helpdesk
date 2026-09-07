# IT Operations System

A responsive frontend application for managing office IT work. It started as an incident ticket system and has now been expanded into a broader **IT Operations System** for:

- Incident/ticket management
- Purchase request memo generation
- IT inventory and stock tracking
- Technician login and password changes
- Optional Google Sheets backend through Google Apps Script

The system is branded as **The HelpDesk+** with the slogan:

```txt
consider IT solved
```

The system is built with:

- HTML
- CSS
- Vanilla JavaScript
- Google Apps Script for the optional backend
- Google Sheets as the database

---

## Project Status

The project can run in two modes:

### 1. Local frontend mode

In this mode, all records are stored in the browser using `localStorage`.

Good for:

- Testing
- Demos
- Frontend development
- Working on one computer/browser

Limitation:

- Julius and David will not share the same live data across devices.

### 2. Google Sheets backend mode

In this mode, the frontend connects to a Google Apps Script Web App, which saves data into Google Sheets.

Good for:

- Shared data between Julius and David
- Saving incidents centrally
- Saving memos centrally
- Saving inventory centrally
- Changing passwords without editing code

---

## Default Login Details

Default users:

```txt
Julius / julius123
David / david123
```

The login page only asks for technician and password. Backend details are not shown on the login screen.

Passwords can be changed from inside the app:

```txt
Settings → Change Login Password
```

When Google Sheets backend is connected, password changes are saved in Google Sheets. In local mode, password changes are saved in the current browser only.

---

## Main Features

## Navigation Behavior

The app is organized like a real application. Only the selected module is shown at a time:

- Dashboard
- Incidents
- Memos
- Inventory
- Settings

Click a menu item in the sidebar to open that module. This keeps the screen cleaner and prevents all modules from appearing together.

---

## 1. Dashboard

The dashboard shows:

- Open incidents
- Resolved incidents
- Total memos
- Inventory items
- Low-stock items
- Estimated stock value
- Recent incidents
- Low-stock alerts
- Incident charts
- Technician workload

---

## 2. Incident Management

The incident module allows the IT team to:

- Create support tickets
- Edit saved tickets
- Assign a technician: Julius or David
- Set ticket status:
  - Pending
  - In Progress
  - Resolved
- Set priority:
  - Low
  - Medium
  - High
  - Critical
- Record issue description
- Record resolution/work done
- Record changed component or item used

Important rule:

- A ticket marked as **Resolved** must have resolution/work done entered.

---

## 3. Memo Generator

The memo module creates purchase request memos similar to the sample memo layout.

It supports:

- To
- From
- Date
- Subject
- Purpose
- Multiple requested items
- Quantity
- Unit cost
- Auto-calculated total cost
- Signature labels
- Live memo preview
- Editable memo form directly on the page
- Save memo
- Edit saved memo
- Print memo

Example items:

- 256GB SSD
- CMOS Battery
- DDR4 RAM
- Logitech Mouse
- Network Cable
- Delivery

---

## 4. Inventory and Stock

The inventory module allows IT to track stock items such as computer parts and accessories.

It supports:

- Item name
- Category
- SKU / asset code
- Quantity in stock
- Reorder level
- Unit cost
- Location
- Supplier
- Notes
- Low-stock alert
- Receive/add stock
- Issue/remove stock
- Generate memo request from a low-stock item

---

## 5. Backup

The **Backup Data** button downloads all current data as a `.json` file.

The backup includes:

- Incidents
- Memos
- Inventory

---

## File Structure

```txt
incident-ticket-system/
│
├── index.html
├── styles.css
├── app.js
├── README.md
├── GOOGLE_SHEETS_BACKEND_SETUP.md
│
├── assets/
│   └── helpdesk-logo.png
│
└── google-apps-script/
    └── Code.gs
```

### File explanations

| File | Purpose |
|---|---|
| `index.html` | Main frontend layout and app screens |
| `styles.css` | All styling and responsive design |
| `app.js` | Frontend logic, local storage, Google backend calls |
| `README.md` | Project overview and usage guide |
| `GOOGLE_SHEETS_BACKEND_SETUP.md` | Detailed Google Sheets/App Script setup guide |
| `assets/helpdesk-logo.png` | The HelpDesk+ logo used across the app |
| `google-apps-script/Code.gs` | Backend code to paste into Google Apps Script |

---

## How to Run Locally

Open this file in a browser:

```txt
index.html
```

Or serve it with a simple local server.

Example using Python:

```bash
python -m http.server 8000
```

Then open:

```txt
http://localhost:8000
```

---

## How to Deploy to GitHub Pages

1. Create a GitHub repository.
2. Upload these files:

```txt
index.html
styles.css
app.js
README.md
GOOGLE_SHEETS_BACKEND_SETUP.md
google-apps-script/Code.gs
```

3. Go to repository settings:

```txt
Settings → Pages
```

4. Choose:

```txt
Deploy from branch
Branch: main
Folder: /root
```

5. Save.

GitHub will give you a link like:

```txt
https://yourusername.github.io/your-repository-name/
```

---

## Google Sheets Backend Setup Summary

A full guide is included in:

```txt
GOOGLE_SHEETS_BACKEND_SETUP.md
```

Short version:

1. Create a new Google Sheet.
2. Open:

```txt
Extensions → Apps Script
```

3. Paste the code from:

```txt
google-apps-script/Code.gs
```

4. Save.
5. Run:

```txt
setup
```

6. Authorize the script.
7. Deploy as a Web App:

```txt
Execute as: Me
Who has access: Anyone
```

8. Copy the Web App URL ending in `/exec`.
9. Paste that URL into the frontend login page or Settings page.

---

## Connecting the Frontend to Google Sheets

The frontend is currently configured with this Apps Script Web App URL:

```txt
https://script.google.com/macros/s/AKfycbxmnsg4tF8l4Ios7fBxc5r_69cXVfhWtMmF72C5nH2CKLLjfejJg0NRlwaK9EJYpJQo/exec
```

So, by default, login and data saving will use Google Sheets.

You can also change or replace the URL from the app:

1. Go to:

```txt
Settings → Advanced → Google Sheets Backend
```

2. Expand the hidden backend panel and paste another Apps Script Web App URL.
3. Click:

```txt
Save Backend URL
```

4. Click:

```txt
Sync Now
```

When connected, the app will show:

```txt
Google Connected
```

To temporarily work without Google Sheets, click:

```txt
Use Local Mode
```

---

## Google Sheet Tabs Created

The Apps Script setup creates these tabs:

```txt
Users
Incidents
Memos
Inventory
```

### Users tab

Stores technician login details as password hashes.

### Incidents tab

Stores all support tickets.

### Memos tab

Stores saved purchase request memos and memo items.

### Inventory tab

Stores stock items and stock movements.

---

## Important Security Note

This is suitable for a small internal prototype or office tool.

For now:

- The frontend can be deployed on GitHub Pages.
- The Google Apps Script backend writes to Google Sheets.
- Passwords in Google Sheets are hashed.

However, for a stricter production system, consider later using:

- Google account authentication
- Firebase Authentication
- Supabase authentication
- Node.js/Express with PostgreSQL

---

## Recommended Next Improvements

Possible future improvements:

- Add user roles, for example Admin and Technician
- Add audit history for every ticket update
- Add report filters by month and technician
- Add PDF export for memos
- Add import from backup JSON
- Add stock movement history display
- Add email notifications when a memo is created
- Add Google account login

---

## Notes for Julius and David

Use the app as follows:

1. Login.
2. Use **Incidents** to log and resolve office issues.
3. Use **Memos** to request parts or equipment.
4. Use **Inventory** to track available IT items.
5. Use **Settings** to change passwords or connect Google Sheets.

