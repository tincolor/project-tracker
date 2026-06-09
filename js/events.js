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

function parseAllDayDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function decodeHtmlEntities(value) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function normaliseDescription(description) {
  return decodeHtmlEntities(description)
    .replace(/\\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\r/g, '');
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normaliseFieldKey(key) {
  const normalized = key.toLowerCase().replace(/-/g, '_');
  const knownKeys = new Set([
    'type', 'project', 'group', 'group_id', 'groupid',
    'subgroup', 'subgroup_id', 'subgroupid',
    'subtask', 'subtask_id', 'subtaskid',
    'workstream', 'milestone', 'milestone_for',
    'status', 'owner', 'notes',
  ]);

  for (const prefix of ['n_', 'in_']) {
    if (normalized.startsWith(prefix)) {
      const withoutPrefix = normalized.slice(prefix.length);
      if (knownKeys.has(withoutPrefix)) return withoutPrefix;
    }
  }

  return normalized;
}

function parseDashboardMeta(description) {
  const text = normaliseDescription(description);
  const hasDashboardTag = text.toLowerCase().includes('#cdash');

  const fields = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    const match = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.+)$/);
    if (!match) continue;
    fields[normaliseFieldKey(match[1])] = match[2].trim();
  }

  const hasGroupingField = Boolean(
    fields.group ||
    fields.group_id ||
    fields.groupid ||
    fields.subgroup ||
    fields.subgroup_id ||
    fields.subgroupid ||
    fields.subtask ||
    fields.subtask_id ||
    fields.subtaskid ||
    fields.workstream
  );
  if (!hasDashboardTag && !hasGroupingField) return null;

  const type = (fields.type || 'task').toLowerCase();
  const group = fields.group || fields.subgroup || fields.subtask || fields.workstream || '';
  const groupId =
    fields.group_id ||
    fields.groupid ||
    fields.subgroup_id ||
    fields.subgroupid ||
    fields.subtask_id ||
    fields.subtaskid ||
    (group ? slugify(group) : '');

  return {
    type,
    isTask:      type === 'task',
    isMilestone: type === 'milestone' || fields.milestone === 'true',
    project:     fields.project || '',
    group,
    groupId,
    milestoneFor: fields.milestone_for || fields.group_id || '',
    status:      fields.status || '',
    owner:       fields.owner || '',
    fields,
  };
}

export function normaliseEvent(ev, cal) {
  const isAllDay = Boolean(ev.start?.date);
  const startRaw = ev.start?.dateTime || ev.start?.date;
  const endRaw   = ev.end?.dateTime   || ev.end?.date;
  const start    = startRaw ? (isAllDay ? parseAllDayDate(startRaw) : new Date(startRaw)) : null;
  const end      = endRaw   ? (isAllDay ? parseAllDayDate(endRaw)   : new Date(endRaw))   : null;

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
    updated:      ev.updated || '',
    dashboard:    parseDashboardMeta(ev.description || ''),
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
    if (state.filter.calendars.size > 0 && !state.filter.calendars.has(ev.calendarId)) return false;
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
