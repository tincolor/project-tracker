import { state, el } from '../state.js';
import { filteredEvents } from '../events.js';
import { showHoverTooltip, hideHoverTooltip, showPinnedTooltip } from '../tooltip.js';

export function renderMonth() {
  const events = filteredEvents().map(ev => ({
    id:              ev.id,
    title:           ev.title,
    start:           ev.start,
    end:             ev.end,
    allDay:          ev.isAllDay,
    backgroundColor: ev.calColor,
    borderColor:     ev.calColor,
    extendedProps:   ev,
  }));

  if (state.fcInstance) {
    state.fcInstance.removeAllEvents();
    state.fcInstance.addEventSource(events);
    return;
  }

  state.fcInstance = new FullCalendar.Calendar(el.fcContainer(), {
    initialView:  'dayGridMonth',
    headerToolbar: {
      left:   'prev,next today',
      center: 'title',
      right:  'dayGridMonth,timeGridWeek,listMonth',
    },
    height: '100%',
    events,
    // Hover: show/hide transient tooltip
    eventMouseEnter: ({ event, el }) => showHoverTooltip(event.extendedProps, el),
    eventMouseLeave: () => hideHoverTooltip(),
    // Click: pin tooltip — stop propagation so document click doesn't immediately dismiss it
    eventClick: ({ event, el, jsEvent }) => {
      jsEvent.stopPropagation();
      showPinnedTooltip(event.extendedProps, el);
    },
  });
  state.fcInstance.render();
}

export function navigateMonthToDate(date) {
  if (state.fcInstance) state.fcInstance.gotoDate(date);
}
