import { state } from './state.js';
import { CONFIG } from '../config.js';

export async function loadAllEvents() {
  state.events = [];
  await Promise.all(
    state.calendars.map(async cal => {
      const evs = await fetchCalendarEvents(cal);
      state.events.push(...evs);
    })
  );
  extractAttendees();
}

export async function fetchCalendarEvents(cal) {
  const now     = new Date();
  const timeMin = new Date(now.getFullYear(), now.getMonth() - CONFIG.MONTHS_PAST,       1).toISOString();
  const timeMax = new Date(now.getFullYear(), now.getMonth() + CONFIG.MONTHS_FUTURE + 1, 0).toISOString();

  try {
    const resp = await gapi.client.calendar.events.list({
      calendarId:   cal.id,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy:      'startTime',
      maxResults:   500,
    });
    return (resp.result.items || []).map(ev => normaliseEvent(ev, cal));
  } catch (err) {
    console.warn(`Skipping calendar ${cal.name}:`, err?.result?.error?.message || err);
    return [];
  }
}

export function normaliseEvent(ev, cal) {
  const isAllDay = Boolean(ev.start?.date);
  const startRaw = ev.start?.dateTime || ev.start?.date;
  const endRaw   = ev.end?.dateTime   || ev.end?.date;
  const start    = startRaw ? new Date(startRaw) : null;
  const end      = endRaw   ? new Date(endRaw)   : null;

  return {
    id:           ev.id,
    calendarId:   cal.id,
    calendarName: cal.name,
    calColor:     cal.color,
    title:        ev.summary || '(no title)',
    description:  ev.description || '',
    location:     ev.location || '',
    start,
    end,
    isAllDay,
    attendees: (ev.attendees || []).map(a => ({
      email:       a.email,
      displayName: a.displayName || a.email,
      self:        a.self || false,
    })),
    htmlLink: ev.htmlLink,
  };
}

export function extractAttendees() {
  const map = new Map();
  for (const ev of state.events) {
    for (const a of ev.attendees) {
      if (!map.has(a.email)) map.set(a.email, a.displayName);
    }
  }
  state.attendees = Array.from(map.entries())
    .map(([email, displayName]) => ({ email, displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function filteredEvents() {
  return state.events.filter(ev => {
    if (!state.filter.calendars.has(ev.calendarId)) return false;
    if (state.filter.attendees.size > 0) {
      const evEmails = new Set(ev.attendees.map(a => a.email));
      for (const sel of state.filter.attendees) {
        if (evEmails.has(sel)) return true;
      }
      return false;
    }
    return true;
  });
}
