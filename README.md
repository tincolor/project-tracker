# Calendar Dashboard

A static web app that visualises Google Calendars in Month, Timeline/Gantt, and List views — with filtering by calendar and by attendee (assignee).

Hosted on GitHub Pages, shared as a URL. Each team member signs in with their own Google account.

---

## Setup

### 1 — Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (e.g. *Calendar Dashboard*).
2. Enable the **Google Calendar API**:
   - APIs & Services → Library → search "Google Calendar API" → Enable
3. Create an **API Key**:
   - APIs & Services → Credentials → Create Credentials → API Key
   - Copy it into `config.js` → `API_KEY`
   - Optionally restrict it to the Calendar API and your domain
4. Create an **OAuth 2.0 Client ID**:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Authorised JavaScript origins — add both:
     - `http://localhost:8080` (for local testing)
     - `https://YOUR-USERNAME.github.io` (your GitHub Pages domain)
   - Copy the Client ID into `config.js` → `CLIENT_ID`
5. Configure the **OAuth consent screen**:
   - APIs & Services → OAuth consent screen
   - User type: **External** (or Internal if your team is on Google Workspace)
   - Fill in app name, support email, developer email
   - Add scope: `https://www.googleapis.com/auth/calendar.readonly`
   - Add your team members as **Test users** (up to 100 — you never need to publish)

---

### 2 — config.js

Open `config.js` and fill in your credentials:

```js
CLIENT_ID: 'xxxxxxxxxxxx.apps.googleusercontent.com',
API_KEY:   'AIzaSy...',
```

To add your own team calendar, find its Calendar ID in Google Calendar:
Settings → select a calendar → scroll to **Calendar ID**

Then add it to `TEAM_CALENDARS`:

```js
TEAM_CALENDARS: [
  { id: 'abc123@group.calendar.google.com', name: 'Production Schedule', color: '#e91e63' },
],
```

---

### 3 — Deploy to GitHub Pages

```bash
# From the calendar-dashboard folder:
git init
git add .
git commit -m "Initial deploy"
gh repo create calendar-dashboard --public --source=. --push
# Then in the repo settings: Pages → Deploy from branch → main / (root)
```

Your team's URL will be: `https://YOUR-USERNAME.github.io/calendar-dashboard/`

---

## Test Calendars (pre-configured, no setup needed)

These three public Google calendars load automatically — no sign-in required:

| Calendar | What it has |
|---|---|
| US Holidays | ~15 US public holidays/year |
| Christian Holidays | Easter, Christmas, saints' days, etc. |
| Jewish Holidays | Rosh Hashanah, Passover, Hanukkah, etc. |

**Adding the FIFA World Cup 2026:**

1. Go to [worldcupcalendar.football](https://worldcupcalendar.football) and copy the ICS subscription URL
2. In Google Calendar: Other calendars (+) → From URL → paste
3. Sign in to the dashboard — it will appear automatically

---

## Attendee / Assignee Filtering

When you create events in your team Google Calendar and add **attendees**, the dashboard:

- Collects all unique attendees across all your events
- Shows them in the **People** sidebar panel
- Clicking a person filters all views to only show events where they're listed

This works for any calendar you own or have edit access to.

---

## Local Development

```bash
cd calendar-dashboard
python3 -m http.server 8080
# Open http://localhost:8080
```

Make sure `http://localhost:8080` is in your OAuth client's Authorised JavaScript origins.
