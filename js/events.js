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
  if (cal.id === 'mock-project-calendar-b') {
    const mockEvents = [
      {
        id: 'mock-b-1',
        summary: 'Draft social and email copy',
        start: { date: '2026-06-12' },
        end: { date: '2026-06-17' },
        description: `#cdash\ntype: task\nproject: Project B\ngroup: Content Strategy\ngroup_id: content-strategy`,
        attendees: [],
      },
      {
        id: 'mock-b-2',
        summary: 'Review',
        start: { date: '2026-06-17' },
        end: { date: '2026-06-20' },
        description: `#cdash\ntype: task\nproject: Project B\ngroup: Content Strategy\ngroup_id: content-strategy`,
        attendees: [],
      },
      {
        id: 'mock-b-3',
        summary: 'Create static ad',
        start: { date: '2026-06-15' },
        end: { date: '2026-06-19' },
        description: `#cdash\ntype: task\nproject: Project B\ngroup: Asset Production\ngroup_id: asset-production`,
        attendees: [],
      },
      {
        id: 'mock-b-4',
        summary: 'Edit campaign video trailers',
        start: { date: '2026-06-19' },
        end: { date: '2026-06-24' },
        description: `#cdash\ntype: task\nproject: Project B\ngroup: Asset Production\ngroup_id: asset-production`,
        attendees: [],
      },
      {
        id: 'mock-b-5',
        summary: 'Design',
        start: { date: '2026-06-24' },
        end: { date: '2026-06-26' },
        description: `#cdash\ntype: task\nproject: Project B\ngroup: Asset Production\ngroup_id: asset-production`,
        attendees: [],
      },
      {
        id: 'mock-b-6',
        summary: 'Asset Production Ready',
        start: { date: '2026-06-27' },
        end: { date: '2026-06-28' },
        description: `#cdash\ntype: milestone\nproject: Project B\ngroup: Asset Production\ngroup_id: asset-production\nmilestone_for: asset-production`,
        attendees: [],
      },
      {
        id: 'mock-b-7',
        summary: 'Loose Calendar B Task',
        start: { date: '2026-06-14' },
        end: { date: '2026-06-16' },
        description: `This is a loose calendar event.`,
        attendees: [],
      }
    ];
    return mockEvents.map(ev => normaliseEvent(ev, cal));
  }

  if (cal.id === 'mock-project-calendar-a') {
    const mockEvents = [
      {
        id: 'mock-a-1',
        summary: 'Integrate UI components',
        start: { date: '2026-06-15' },
        end: { date: '2026-06-21' },
        description: `#cdash\ntype: task\nproject: Project A\ngroup: Core Development\ngroup_id: core-development`,
        attendees: [],
      },
      {
        id: 'mock-a-2',
        summary: 'Core Dev Complete',
        start: { date: '2026-06-27' },
        end: { date: '2026-06-28' },
        description: `#cdash\ntype: milestone\nproject: Project A\ngroup: Core Development\ngroup_id: core-development\nmilestone_for: core-development`,
        attendees: [],
      },
      {
        id: 'mock-a-3',
        summary: 'Draft QA',
        start: { date: '2026-06-16' },
        end: { date: '2026-06-20' },
        description: `#cdash\ntype: task\nproject: Project A\ngroup: Testing and QA\ngroup_id: testing-and-qa`,
        attendees: [],
      },
      {
        id: 'mock-a-4',
        summary: 'Remediate critical issues',
        start: { date: '2026-06-23' },
        end: { date: '2026-06-28' },
        description: `#cdash\ntype: task\nproject: Project A\ngroup: Testing and QA\ngroup_id: testing-and-qa`,
        attendees: [],
      },
      {
        id: 'mock-a-5',
        summary: 'Team-wide Sync',
        start: { date: '2026-06-22' },
        end: { date: '2026-06-25' },
        description: `This is a loose calendar event.`,
        attendees: [],
      }
    ];
    return mockEvents.map(ev => normaliseEvent(ev, cal));
  }

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
