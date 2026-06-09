// ─────────────────────────────────────────────────────────────────────────────
//  CALENDAR DASHBOARD — Configuration
//  Fill in CLIENT_ID and API_KEY from your Google Cloud Console project.
//  See README.md for setup steps.
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIG = {

  // From Google Cloud Console → APIs & Services → Credentials
  CLIENT_ID: '45259990601-rhlges6s8uoj12pqv6tnn95dob22u0d4.apps.googleusercontent.com',
  API_KEY:   'AIzaSyAfQNETTtGclfPpbTYDM_tvyFYHI7PFeKI',

  // How far back/forward to load events (in months)
  MONTHS_PAST:   1,
  MONTHS_FUTURE: 6,

  // ── Public calendars ───────────────────────────────────────────────────────
  // These are Google's built-in public calendars — no sign-in required.
  // Users can also add the World Cup ICS feed to their own Google account
  // (from worldcupcalendar.football) and it will appear after they sign in.
  PUBLIC_CALENDARS: [],

  // ── Your team calendars ────────────────────────────────────────────────────
  // Add the IDs of any shared Google Calendars your team uses.
  // Calendar IDs look like: abc123xyz@group.calendar.google.com
  // Find them in Google Calendar → Settings → select a calendar → Calendar ID
  TEAM_CALENDARS: [
    // { id: 'YOUR_TEAM_CALENDAR_ID@group.calendar.google.com', name: 'Production Schedule', color: '#e91e63' },
  ],
};
