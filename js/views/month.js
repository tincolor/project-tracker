import { state, el } from '../state.js';
import { filteredEvents } from '../events.js';
import { showTooltip, hideTooltip } from '../tooltip.js';

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
    height:          '100%',
    events,
    eventClick:      ({ event, jsEvent }) => showTooltip(event.extendedProps, jsEvent),
    eventMouseLeave: () => hideTooltip(),
  });
  state.fcInstance.render();
}
