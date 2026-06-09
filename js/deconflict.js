import { state } from './state.js';
import { filteredEvents } from './events.js';
import { escapeHtml, formatDateRange } from './utils.js';
import { navigateMonthToDate } from './views/month.js';
import { navigateGanttToDate } from './views/gantt.js';
import { scrollListToEvent } from './views/list.js';

const ACK_KEY = 'cdash-acknowledged-conflicts';
let activeFilter = 'needs-review';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateKey(date) {
  const d = startOfDay(date);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function eventKey(ev) {
  return `${ev.calendarId}::${ev.id}`;
}

function eventSignature(ev) {
  return [
    eventKey(ev),
    ev.start?.toISOString() || '',
    ev.end?.toISOString() || '',
    ev.updated || '',
  ].join('|');
}

function acknowledgementSignature(dayKey, events) {
  return [
    dayKey,
    ...events.map(eventSignature).sort(),
  ].join('||');
}

function loadAcknowledgements() {
  try {
    const records = JSON.parse(localStorage.getItem(ACK_KEY)) || [];
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function saveAcknowledgements(records) {
  localStorage.setItem(ACK_KEY, JSON.stringify(records));
}

function matchingAcknowledgements(group) {
  const groupKeys = new Set(group.events.map(eventKey));
  return loadAcknowledgements().filter(record => {
    if (record.dayKey !== group.dayKey) return false;
    if (!record.eventKeys.every(key => groupKeys.has(key))) return false;
    const events = record.eventKeys
      .map(key => group.events.find(ev => eventKey(ev) === key))
      .filter(Boolean);
    return events.length === record.eventKeys.length &&
      acknowledgementSignature(group.dayKey, events) === record.signature;
  });
}

function isGroupAcknowledged(group) {
  const groupKeys = group.events.map(eventKey).sort().join();
  return matchingAcknowledgements(group)
    .some(record => [...record.eventKeys].sort().join() === groupKeys);
}

function acknowledgeEvents(group, events) {
  if (events.length < 2) return;
  const eventKeys = events.map(eventKey).sort();
  const signature = acknowledgementSignature(group.dayKey, events);
  const records = loadAcknowledgements()
    .filter(record => !(record.dayKey === group.dayKey && record.signature === signature));

  records.push({
    dayKey: group.dayKey,
    dateLabel: group.date.toISOString(),
    eventKeys,
    signature,
    acknowledgedAt: new Date().toISOString(),
  });
  saveAcknowledgements(records);
}

function removeAcknowledgement(signature) {
  saveAcknowledgements(loadAcknowledgements().filter(record => record.signature !== signature));
}

function eventActiveEndDay(ev) {
  if (!ev.end) return addDays(startOfDay(ev.start), 1);
  if (ev.isAllDay) return startOfDay(ev.end);

  const endDay = startOfDay(ev.end);
  return ev.end > endDay ? addDays(endDay, 1) : endDay;
}

function findDayConflicts() {
  const today = startOfDay(new Date());
  const dayMap = new Map();

  filteredEvents()
    .filter(ev => ev.start && eventActiveEndDay(ev) > today)
    .forEach(ev => {
      let day = startOfDay(new Date(Math.max(today.getTime(), ev.start.getTime())));
      const end = eventActiveEndDay(ev);
      while (day < end) {
        const key = dateKey(day);
        if (!dayMap.has(key)) dayMap.set(key, { dayKey: key, date: new Date(day), events: [] });
        dayMap.get(key).events.push(ev);
        day = addDays(day, 1);
      }
    });

  return [...dayMap.values()]
    .filter(group => group.events.length > 1)
    .sort((a, b) => a.date - b.date)
    .map(group => ({
      ...group,
      events: group.events.sort((a, b) => a.title.localeCompare(b.title)),
    }));
}

function filteredGroups() {
  const groups = findDayConflicts();
  if (activeFilter === 'all') return groups;
  if (activeFilter === 'acknowledged') {
    return groups.filter(group => matchingAcknowledgements(group).length > 0);
  }
  return groups.filter(group => !isGroupAcknowledged(group));
}

function eventLookup() {
  const map = new Map();
  for (const group of findDayConflicts()) {
    for (const ev of group.events) map.set(eventKey(ev), ev);
  }
  return map;
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function updateDeconflictBadge() {
  const btn = document.getElementById('deconflict-btn');
  if (!btn) return;
  const needsReview = findDayConflicts().filter(group => !isGroupAcknowledged(group));
  const total = needsReview.length;
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

  const groups = filteredGroups();
  const allGroups = findDayConflicts();
  const needsReviewCount = allGroups.filter(group => !isGroupAcknowledged(group)).length;
  const acknowledgedCount = allGroups.filter(group => matchingAcknowledgements(group).length > 0).length;

  body.innerHTML = `
    <div class="dc-filter-bar">
      ${[
        ['all', 'All', allGroups.length],
        ['needs-review', 'Needs review', needsReviewCount],
        ['acknowledged', 'Acknowledged', acknowledgedCount],
      ].map(([key, label, count]) => `
        <button class="dc-filter ${activeFilter === key ? 'active' : ''}" data-filter="${key}">
          ${label}<span>${count}</span>
        </button>
      `).join('')}
    </div>
    ${groups.length === 0 ? emptyStateHTML() : groupsHTML(groups)}
  `;

  wirePanelActions(body);
}

function emptyStateHTML() {
  const message = activeFilter === 'acknowledged'
    ? 'No acknowledged overlaps match<br>the current calendars.'
    : activeFilter === 'needs-review'
      ? 'No overlaps need review<br>in the current calendars.'
      : 'No overlaps found in the<br>currently selected calendars.';
  return `
    <div class="dc-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <p>${message}</p>
    </div>`;
}

function groupsHTML(groups) {
  return `
    <div class="dc-summary">
      ${groups.length} day${groups.length !== 1 ? 's' : ''} shown
    </div>
    ${groups.map(groupHTML).join('')}`;
}

function groupHTML(group) {
  const dayLabel = group.date.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  const acknowledgements = matchingAcknowledgements(group);
  const fullyAcknowledged = isGroupAcknowledged(group);

  return `
    <div class="dc-group" data-day-key="${escapeHtml(group.dayKey)}">
      <div class="dc-day-header">
        <span>${dayLabel}</span>
        ${fullyAcknowledged ? '<span class="dc-status">Acknowledged</span>' : '<span class="dc-status needs">Needs review</span>'}
      </div>
      <div class="dc-actions">
        <button class="dc-action dc-ack-selected" disabled>Acknowledge selected</button>
        <button class="dc-action dc-ack-day">Acknowledge day</button>
      </div>
      ${acknowledgements.length ? acknowledgementHTML(acknowledgements, group) : ''}
      ${group.events.map(ev => eventHTML(ev, acknowledgements, group)).join('')}
    </div>`;
}

function acknowledgementHTML(records, group) {
  const lookup = new Map(group.events.map(ev => [eventKey(ev), ev]));
  return `
    <div class="dc-ack-list">
      ${records.map(record => {
        const names = record.eventKeys
          .map(key => lookup.get(key)?.title)
          .filter(Boolean)
          .join(', ');
        return `
          <div class="dc-ack-row">
            <span>${record.eventKeys.length === group.events.length ? 'Day acknowledged' : escapeHtml(names)}</span>
            <button class="dc-unack" data-signature="${escapeHtml(record.signature)}">Remove</button>
          </div>`;
      }).join('')}
    </div>`;
}

function eventHTML(ev, acknowledgements, group) {
  const key = eventKey(ev);
  const acknowledged = acknowledgements.some(record => record.eventKeys.includes(key));
  return `
    <div class="dc-event ${acknowledged ? 'acknowledged' : ''}" data-event-key="${escapeHtml(key)}">
      <label class="dc-select">
        <input type="checkbox" data-event-key="${escapeHtml(key)}">
        <span></span>
      </label>
      <button class="dc-event-main" data-event-key="${escapeHtml(key)}" data-day-key="${escapeHtml(group.dayKey)}">
        <span class="dc-dot" style="background:${ev.calColor}"></span>
        <span class="dc-event-info">
          <span class="dc-event-title">${escapeHtml(ev.title)}</span>
          <span class="dc-event-meta">${escapeHtml(formatDateRange(ev.start, ev.end, ev.isAllDay))} · ${escapeHtml(ev.calendarName)}</span>
        </span>
      </button>
    </div>`;
}

function wirePanelActions(body) {
  body.querySelectorAll('.dc-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      renderDeconflictContent();
    });
  });

  body.querySelectorAll('.dc-group').forEach(groupEl => {
    const group = findDayConflicts().find(g => g.dayKey === groupEl.dataset.dayKey);
    if (!group) return;

    const selectedEvents = () => [...groupEl.querySelectorAll('input[type=checkbox]:checked')]
      .map(input => group.events.find(ev => eventKey(ev) === input.dataset.eventKey))
      .filter(Boolean);

    const selectedBtn = groupEl.querySelector('.dc-ack-selected');
    groupEl.querySelectorAll('input[type=checkbox]').forEach(input => {
      input.addEventListener('change', () => {
        selectedBtn.disabled = selectedEvents().length < 2;
      });
    });

    selectedBtn?.addEventListener('click', () => {
      acknowledgeEvents(group, selectedEvents());
      renderDeconflictContent();
      updateDeconflictBadge();
    });

    groupEl.querySelector('.dc-ack-day')?.addEventListener('click', () => {
      acknowledgeEvents(group, group.events);
      renderDeconflictContent();
      updateDeconflictBadge();
    });
  });

  body.querySelectorAll('.dc-unack').forEach(btn => {
    btn.addEventListener('click', () => {
      removeAcknowledgement(btn.dataset.signature);
      renderDeconflictContent();
      updateDeconflictBadge();
    });
  });

  const lookup = eventLookup();
  body.querySelectorAll('.dc-event-main').forEach(btn => {
    btn.addEventListener('click', () => {
      const ev = lookup.get(btn.dataset.eventKey);
      const group = findDayConflicts().find(g => g.dayKey === btn.dataset.dayKey);
      if (ev) navigateToEvent(ev, group?.date || ev.start);
    });
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────
function navigateToEvent(ev, focusDate = ev.start) {
  if (state.view === 'month') {
    navigateMonthToDate(focusDate);
  } else if (state.view === 'gantt') {
    navigateGanttToDate(focusDate);
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

export function toggleDeconflictPanel() {
  const panel = document.getElementById('deconflict-panel');
  if (panel?.classList.contains('open')) closeDeconflictPanel();
  else openDeconflictPanel();
}

export function refreshDeconflictPanel() {
  const panel = document.getElementById('deconflict-panel');
  if (panel?.classList.contains('open')) renderDeconflictContent();
  updateDeconflictBadge();
}
