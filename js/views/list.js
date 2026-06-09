import { el } from '../state.js';
import { formatDateRange, shortDisplayName } from '../utils.js';
import { filteredEvents } from '../events.js';

export function scrollListToEvent(ev) {
  const card = document.querySelector(`#list-container [data-event-id="${CSS.escape(ev.id)}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('highlight');
  setTimeout(() => card.classList.remove('highlight'), 1500);
}

export function renderList() {
  const events = filteredEvents()
    .filter(ev => ev.start)
    .sort((a, b) => a.start - b.start);

  const container = el.listContainer();

  if (events.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No events match the current filters.</p></div>';
    return;
  }

  container.innerHTML = `<div class="event-list">${events.map(ev => {
    const d     = ev.start;
    const month = d.toLocaleDateString(undefined, { month: 'short' });
    const day   = d.getDate();
    const range = formatDateRange(ev.start, ev.end, ev.isAllDay);
    const pills = ev.attendees
      .map(a => `<span class="attendee-pill">${shortDisplayName(a.displayName, a.email)}</span>`)
      .join('');
    return `
      <div class="event-card" data-event-id="${ev.id}" style="border-left-color:${ev.calColor}">
        <div class="event-date">
          <div class="month">${month}</div>
          <div class="day">${day}</div>
        </div>
        <div class="event-body">
          <div class="event-title">${ev.title}</div>
          <div class="event-meta">
            <span>${range}</span>
            <span style="color:${ev.calColor}">${ev.calendarName}</span>
            ${ev.location ? `<span>📍 ${ev.location}</span>` : ''}
          </div>
          ${pills ? `<div class="attendee-pills">${pills}</div>` : ''}
        </div>
      </div>`;
  }).join('')}</div>`;
}
