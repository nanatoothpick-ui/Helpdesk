# Google Sheets Backend Setup Guide

This guide connects the IT Operations System frontend to Google Sheets using Google Apps Script.

## Architecture

```txt
Frontend on GitHub Pages or local browser
        ↓ fetch requests
Google Apps Script Web App
        ↓ reads/writes
Google Sheet tabs
```

The Google Sheet will store:

- Users
- Incidents
- Memos
- Inventory

---

## Step 1: Create the Google Sheet

1. Go to Google Drive.
2. Create a new Google Sheet.
3. Name it something like:

```txt
IT Operations System Database
```

You do not need to manually create the tabs. The Apps Script `setup()` function will create them for you.

---

## Step 2: Add the Apps Script Code

1. Open the Google Sheet.
2. Go to:

```txt
Extensions → Apps Script
```

3. Delete any sample code in `Code.gs`.
4. Copy the full code from:

```txt
google-apps-script/Code.gs
```

5. Paste it into Apps Script.
6. Click **Save**.

---

## Step 3: Run Setup

1. In Apps Script, select the function:

```txt
setup
```

2. Click **Run**.
3. Google will ask for permission.
4. Approve the permission.
5. Return to your Google Sheet.

You should now see these tabs:

```txt
Users
Incidents
Memos
Inventory
```

The default users will also be created:

```txt
Julius / julius123
David / david123
```

Passwords are stored as hashes, not plain text.

---

## Step 4: Deploy as a Web App

1. In Apps Script, click:

```txt
Deploy → New deployment
```

2. Click the gear icon and choose:

```txt
Web app
```

3. Set the deployment options:

```txt
Description: IT Operations Backend
Execute as: Me
Who has access: Anyone
```

4. Click **Deploy**.
5. Copy the Web App URL.

It should look like this:

```txt
https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxx/exec
```

Use the `/exec` URL, not the `/dev` URL.

---

## Current Connected Backend URL

The frontend has been configured with this Web App URL:

```txt
https://script.google.com/macros/s/AKfycbxmnsg4tF8l4Ios7fBxc5r_69cXVfhWtMmF72C5nH2CKLLjfejJg0NRlwaK9EJYpJQo/exec
```

It has been tested successfully with the health check endpoint.

---

## Step 5: Test the Backend URL

Open this in your browser:

```txt
YOUR_WEB_APP_URL?action=health
```

Example:

```txt
https://script.google.com/macros/s/AKfycbxxxx/exec?action=health
```

You should see something like:

```json
{
  "ok": true,
  "message": "IT Operations backend is running."
}
```

---

## Step 6: Connect the Frontend

The frontend needs to send requests to your Apps Script Web App URL.

The basic JavaScript request helper should look like this:

```js
const GOOGLE_SCRIPT_URL = "PASTE_YOUR_WEB_APP_URL_HERE";

async function apiRequest(action, payload = {}) {
  const response = await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ action, payload })
  });

  return response.json();
}
```

Important: do not add this header for now:

```js
Content-Type: application/json
```

Leaving it out helps avoid browser CORS preflight issues with Apps Script.

---

## Step 7: Example API Calls

### Login

```js
const result = await apiRequest("login", {
  technician: "Julius",
  password: "julius123"
});
```

### Load All Records

```js
const result = await apiRequest("getAll");
```

### Save Incident

```js
await apiRequest("saveIncident", {
  requester: "Ama Mensah",
  department: "Call Center",
  location: "Desk CC-12",
  category: "Call Center Phone",
  technician: "Julius",
  status: "Pending",
  priority: "High",
  timeSpent: "",
  description: "Phone disconnects during calls.",
  resolution: "",
  componentChanged: "",
  updatedBy: "Julius"
});
```

### Save Memo

```js
await apiRequest("saveMemo", {
  to: "E",
  from: "D",
  date: "2026-08-20",
  subject: "PC COMPONENTS PURCHASE",
  purpose: "Purchase of PC components to support office maintenance.",
  items: [
    { name: "256GB SSD", quantity: 1, unitCost: 550 },
    { name: "CMOS Battery", quantity: 10, unitCost: 25 }
  ],
  sign1: "Prepared By",
  sign2: "Checked By",
  sign3: "Approved By",
  updatedBy: "Julius"
});
```

### Save Inventory Item

```js
await apiRequest("saveInventory", {
  name: "256GB SSD",
  category: "Storage",
  sku: "SSD-256",
  quantity: 1,
  reorderLevel: 2,
  unitCost: 550,
  location: "IT Store",
  supplier: "Local Vendor",
  notes: "Laptop and desktop SSD replacement",
  updatedBy: "David"
});
```

### Receive or Issue Stock

```js
await apiRequest("stockMovement", {
  itemId: "INV-20260907-001",
  action: "issue",
  quantity: 1,
  reason: "Used for incident INC-20260907-001",
  updatedBy: "Julius"
});
```

### Change Password

```js
await apiRequest("changePassword", {
  technician: "Julius",
  currentPassword: "julius123",
  newPassword: "newPassword123"
});
```

---

## Important Notes

### For prototype/internal use

This Google Sheets backend is good for:

- Small IT teams
- Internal use
- Julius and David sharing the same data
- Avoiding a full server for now

### Security note

Using Apps Script as a web app with `Anyone` access means the endpoint can be called if someone knows the URL. The app still has its own login check, but this is not as secure as a full backend with server-side sessions.

For a stronger production version later, use:

- Google account sign-in
- Node.js/Express + PostgreSQL
- Firebase Authentication + Firestore
- Supabase authentication + PostgreSQL

---

## When the Apps Script URL is ready

Paste the Web App URL into the frontend login screen under:

```txt
Google Backend URL
```

Or after login, go to:

```txt
Settings → Google Sheets Connection
```

Then click:

```txt
Save Backend URL
```

Once connected:

- Login checks Google Sheets
- Incidents save to Google Sheets
- Memos save to Google Sheets
- Inventory saves to Google Sheets
- Password changes save to Google Sheets
