import { state } from './state.js';
import { filteredEvents } from './events.js';
import { escapeHtml } from './utils.js';
import { navigateMonthToDate } from './views/month.js';
import { navigateGanttToDate } from './views/gantt.js';
import { scrollListToEvent } from './views/list.js';

// Returns an array of day groups, each with { date, events[] }, sorted by date.
// A group exists when two or more timed events on that calendar day overlap.
function findConflicts() {
  const events = filteredEvents()
    .filter(ev => !ev.isAllDay && ev.start && ev.end)
    .sort((a, b) => a.start - b.start);

  // dateKey → { date, events: Set }
  const dayMap = new Map();

  for (let i = 0; i < events.length; i++) {
    const a = events[i];
    for (let j = i + 1; j < events.length; j++) {
      const b = events[j];
      // Events are sorted by start; once b starts at or after a ends, done for a
      if (b.start >= a.end) break;

      // Overlap: key by a's local calendar date
      const d = a.start;
      const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!dayMap.has(dateKey)) dayMap.set(dateKey, { date: d, events: new Set() });
      const group = dayMap.get(dateKey);
      group.events.add(a);
      group.events.add(b);
    }
  }

  return [...dayMap.values()]
    .sort((a, b) => a.date - b.date)
    .map(g => ({
      date:   g.date,
      events: [...g.events].sort((a, b) => a.start - b.start),
    }));
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function updateDeconflictBadge() {
  const btn = document.getElementById('deconflict-btn');
  if (!btn) return;
  const groups = findConflicts();
  const total  = new Set(groups.flatMap(g => g.events.map(e => e.id))).size;
  let badge = btn.querySelector('.dc-badge');
  if (total > 0) {
    if (!badge) { badge = document.createElement('span'); badge.className = 'dc-badge'; btn.appendChild(badge); }
    badge.textContent = total;
  } else {
    badge?.remove();
  }
}

// ── Panel content ─────────────────────────────────────────────────────────────
function renderDeconflictContent() {
  const body = document.getElementById('deconflict-body');
  if (!body) return;

  const groups = findConflicts();

  if (groups.length === 0) {
    body.innerHTML = `
      <div class="dc-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p>No conflicts found in the<br>currently selected calendars.</p>
      </div>`;
    return;
  }

  const totalEvents = new Set(groups.flatMap(g => g.events.map(e => e.id))).size;
  body.innerHTML = `
    <div class="dc-summary">
      ${totalEvents} event${totalEvents !== 1 ? 's' : ''} with conflicts
      across ${groups.length} day${groups.length !== 1 ? 's' : ''}
    </div>
    ${groups.map(g => {
      const dayLabel = g.date.toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
      });
      return `
        <div class="dc-group">
          <div class="dc-day-header">${dayLabel}</div>
          ${g.events.map(ev => {
            const time = ev.start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
            return `
              <button class="dc-event" data-event-id="${escapeHtml(ev.id)}">
                <span class="dc-dot" style="background:${ev.calColor}"></span>
                <span class="dc-event-info">
                  <span class="dc-event-title">${escapeHtml(ev.title)}</span>
                  <span class="dc-event-meta">${time} · ${escapeHtml(ev.calendarName)}</span>
                </span>
              </button>`;
          }).join('')}
        </div>`;
    }).join('')}`;

  // Wire up click navigation
  body.querySelectorAll('.dc-event').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.eventId;
      const ev = filteredEvents().find(e => e.id === id);
      if (ev) navigateToEvent(ev);
    });
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────
function navigateToEvent(ev) {
  if (state.view === 'month') {
    navigateMonthToDate(ev.start);
  } else if (state.view === 'gantt') {
    navigateGanttToDate(ev.start); // switches to 3-day zoom with the date at the left edge
  } else if (state.view === 'list') {
    scrollListToEvent(ev);
  }
}

// ── Panel open / close ────────────────────────────────────────────────────────
export function openDeconflictPanel() {
  renderDeconflictContent();
  document.getElementById('deconflict-panel')?.classList.add('open');
}

export function closeDeconflictPanel() {
  document.getElementById('deconflict-panel')?.classList.remove('open');
}

export function refreshDeconflictPanel() {
  const panel = document.getElementById('deconflict-panel');
  if (panel?.classList.contains('open')) renderDeconflictContent();
  updateDeconflictBadge();
}
