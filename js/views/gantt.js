import { state, el } from '../state.js';
import { shortDisplayName } from '../utils.js';
import { filteredEvents } from '../events.js';
import { buildTooltipHTML } from '../tooltip.js';

// ── Day boundary helpers ───────────────────────────────────────────────────────
function dayStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Returns local midnight of the next day (exclusive end for vis-timeline)
function dayEnd(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d;
}

// ── Item builder ──────────────────────────────────────────────────────────────
function buildTimelineItem(id, ev, groupId) {
  if (!ev.start) return null;

  // Snap all events to local day boundaries so bars fill full columns
  const start = dayStart(ev.start);
  let end;

  if (ev.end) {
    if (ev.isAllDay) {
      // Google Calendar all-day end is exclusive; snap to local midnight.
      // If timezone shift collapses it, advance one day so bar fills at least one column.
      end = dayStart(ev.end);
      if (end <= start) end = dayEnd(ev.start);
    } else {
      // Timed event: snap so the bar fills the full day column(s)
      const endDaySnapped = dayStart(ev.end);
      end = endDaySnapped > start ? endDaySnapped : dayEnd(ev.start);
    }
  } else {
    end = dayEnd(ev.start);
  }

  return {
    id,
    group:   groupId,
    content: `<span title="${ev.title}">${ev.title}</span>`,
    start,
    end,
    style:   `background:${ev.calColor}cc; border-color:${ev.calColor}; color:#fff;`,
    title:   buildTooltipHTML(ev),
    type:    'range',
    _ev:     ev,
  };
}

// ── Timeline construction ─────────────────────────────────────────────────────
function buildTimeline(groups, items) {
  const container = el.tlContainer();

  if (state.tlInstance) {
    state.tlInstance.destroy();
    state.tlInstance = null;
  }

  if (items.length === 0) {
    const msg = state.filter.calendars.size === 0
      ? 'Add calendars from the sidebar to get started.'
      : 'No events found in the selected calendars for this time range.';
    container.innerHTML = `<div class="empty-state"><p>${msg}</p></div>`;
    return;
  }

  const ds   = new vis.DataSet(groups);
  const di   = new vis.DataSet(items);
  const now  = new Date();
  const mid  = now.getTime();
  const half = state.timelineZoom / 2;

  // Defer init until after the container has real dimensions
  requestAnimationFrame(() => {
    state.tlInstance = new vis.Timeline(container, di, ds, {
      start:           new Date(mid - half),
      end:             new Date(mid + half),
      moveable:        true,
      zoomable:        false,
      verticalScroll:  true,
      maxHeight:       container.clientHeight || 600,
      orientation:     'top',
      stack:           true,
      showCurrentTime: true,
      groupOrder:      'content',
      tooltip:         { followMouse: true, overflowMethod: 'cap' },
    });

    setupTimelineScroll(container);
    setupZoomButtons();
  });
}

// ── Scroll & zoom ─────────────────────────────────────────────────────────────
function setupTimelineScroll(container) {
  container.addEventListener('wheel', e => {
    e.preventDefault();
    const tl = state.tlInstance;
    if (!tl) return;

    // ctrlKey = pinch gesture on Mac trackpad → zoom
    if (e.ctrlKey) {
      const factor = e.deltaY > 0 ? 0.15 : -0.15;
      if (factor > 0) tl.zoomOut(factor, { animation: false });
      else            tl.zoomIn(-factor,  { animation: false });
      const win = tl.getWindow();
      syncZoomButtons(win.end - win.start);
      return;
    }

    const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (isHorizontal) {
      const win   = tl.getWindow();
      const range = win.end - win.start;
      const delta = (e.deltaX / container.clientWidth) * range * 1.5;
      tl.setWindow(
        new Date(win.start.getTime() + delta),
        new Date(win.end.getTime()   + delta),
        { animation: false }
      );
    } else {
      const scrollEl = container.querySelector('.vis-vertical-scroll');
      if (scrollEl) scrollEl.scrollTop += e.deltaY;
    }
  }, { passive: false });
}

function setupZoomButtons() {
  document.querySelectorAll('#zoom-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      const ms  = Number(btn.dataset.ms);
      state.timelineZoom = ms;
      const tl  = state.tlInstance;
      if (!tl) return;
      const win = tl.getWindow();
      const mid = win.start.getTime() + (win.end - win.start) / 2;
      tl.setWindow(
        new Date(mid - ms / 2),
        new Date(mid + ms / 2),
        { animation: { duration: 300, easingFunction: 'easeInOutQuad' } }
      );
      syncZoomButtons(ms);
    });
  });
}

function syncZoomButtons(rangeMs) {
  const buttons  = document.querySelectorAll('#zoom-toggle button');
  let   closest  = null;
  let   minDelta = Infinity;
  buttons.forEach(btn => {
    const d = Math.abs(Number(btn.dataset.ms) - rangeMs);
    if (d < minDelta) { minDelta = d; closest = btn; }
  });
  buttons.forEach(b => b.classList.remove('active'));
  if (closest) closest.classList.add('active');
}

// ── Render helpers ────────────────────────────────────────────────────────────
function renderGanttByCalendar(events) {
  const calMap = new Map();
  for (const ev of events) {
    if (!calMap.has(ev.calendarId))
      calMap.set(ev.calendarId, { name: ev.calendarName, color: ev.calColor });
  }
  const groups = Array.from(calMap.entries()).map(([id, info]) => ({
    id,
    content: `<span style="color:${info.color};font-weight:500">${info.name}</span>`,
  }));
  const items = events.map((ev, i) => buildTimelineItem(i, ev, ev.calendarId)).filter(Boolean);
  buildTimeline(groups, items);
}

export function renderGantt() {
  const events = filteredEvents().filter(ev => ev.start);

  if (state.groupBy === 'person') {
    const peopleInView = new Map();
    for (const ev of events) {
      for (const a of ev.attendees) {
        if (!peopleInView.has(a.email)) peopleInView.set(a.email, a.displayName);
      }
    }
    if (peopleInView.size === 0) {
      renderGanttByCalendar(events);
      return;
    }
    const groups = Array.from(peopleInView.entries()).map(([email, name]) => ({
      id:      email,
      content: `<span title="${email}">${shortDisplayName(name, email)}</span>`,
    }));
    const items = [];
    let itemId = 0;
    for (const ev of events) {
      for (const a of ev.attendees) {
        if (!peopleInView.has(a.email)) continue;
        const item = buildTimelineItem(itemId++, ev, a.email);
        if (item) items.push(item);
      }
    }
    buildTimeline(groups, items);
  } else {
    renderGanttByCalendar(events);
  }
}
