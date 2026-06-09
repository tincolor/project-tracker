import { escapeHtml } from '../utils.js';
import { filteredEvents } from '../events.js';

function fmtDate(date, isAllDayEnd = false) {
  if (!date) return '';
  const d = isAllDayEnd ? new Date(date) : new Date(date);
  if (isAllDayEnd) d.setDate(d.getDate() - 1);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function renderTable() {
  const container = document.getElementById('table-container');
  if (!container) return;

  const events = filteredEvents()
    .filter(ev => ev.start)
    .sort((a, b) => a.start - b.start);

  if (events.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No events match the current filters.</p></div>';
    return;
  }

  // Group by calendar, preserving sorted order within each calendar
  const calMap = new Map();
  for (const ev of events) {
    if (!calMap.has(ev.calendarId))
      calMap.set(ev.calendarId, { name: ev.calendarName, color: ev.calColor, events: [] });
    calMap.get(ev.calendarId).events.push(ev);
  }

  container.innerHTML = Array.from(calMap.values()).map(cal => {
    const rows = cal.events.map(ev => {
      const assignees = ev.attendees.length
        ? ev.attendees.map(a => escapeHtml(a.displayName || a.email)).join('\n')
        : '—';
      const start = fmtDate(ev.start);
      const end   = ev.end ? fmtDate(ev.end, ev.isAllDay) : '—';
      return `
        <tr>
          <td class="col-name">${escapeHtml(ev.title)}</td>
          <td class="col-assignees">${assignees}</td>
          <td class="col-date">${start}</td>
          <td class="col-date">${end}</td>
        </tr>`;
    }).join('');

    return `
      <div class="table-cal-section">
        <div class="table-cal-header">
          <span class="table-cal-dot" style="background:${cal.color};"></span>
          <span class="table-cal-name">${escapeHtml(cal.name)}</span>
        </div>
        <div class="table-wrap">
          <table class="ev-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Assignee</th>
                <th>Start</th>
                <th>End</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');
}
