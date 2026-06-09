import { state, el } from '../state.js';
import { escapeHtml, shortDisplayName } from '../utils.js';
import { filteredEvents } from '../events.js';
import { showHoverTooltip, hideHoverTooltip, showPinnedTooltip } from '../tooltip.js';

let timelineItemsData  = null;
let timelineGroupsData = null;

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

function eventEndForTimeline(ev) {
  if (!ev.end) return dayEnd(ev.start);
  if (ev.isAllDay) {
    const end = dayStart(ev.end);
    return end > dayStart(ev.start) ? end : dayEnd(ev.start);
  }
  const endDaySnapped = dayStart(ev.end);
  return endDaySnapped > dayStart(ev.start) ? endDaySnapped : dayEnd(ev.start);
}

function subtaskKey(ev) {
  if (!ev.dashboard?.groupId) return '';
  return [
    ev.dashboard.project || 'project',
    ev.dashboard.groupId,
  ].join('::');
}

function subtaskLabel(ev) {
  return ev.dashboard?.group || ev.dashboard?.groupId || ev.title;
}

function compactEventKey(ev) {
  return `${ev.calendarId}::${ev.id}`;
}

// ── Item builder ──────────────────────────────────────────────────────────────
function buildTimelineItem(id, ev, groupId, options = {}) {
  if (!ev.start) return null;

  // Snap all events to local day boundaries so bars fill full columns
  const isMilestone = ev.dashboard?.isMilestone;
  const start = isMilestone ? eventEndForTimeline(ev) : dayStart(ev.start);
  const end = isMilestone ? null : eventEndForTimeline(ev);

  return {
    id,
    group:   groupId,
    ...(options.subgroup ? { subgroup: options.subgroup } : {}),
    content: isMilestone ? '' : `<span>${escapeHtml(ev.title)}</span>`,
    start,
    ...(end ? { end } : {}),
    className: isMilestone ? 'tl-milestone' : '',
    style:   isMilestone
      ? `background:${ev.calColor}; border-color:${ev.calColor}; color:#fff;`
      : `background:${ev.calColor}cc; border-color:${ev.calColor}; color:#fff;`,
    type:    isMilestone ? 'point' : 'range',
    _stackOrder: options.stackOrder ?? 0,
    _ev:     ev,
  };
}

function buildSummaryItem(id, groupId, events, label, color, options = {}) {
  const starts = events.map(ev => dayStart(ev.start).getTime());
  const ends = events.map(ev => eventEndForTimeline(ev).getTime());
  const start = new Date(Math.min(...starts));
  const end = new Date(Math.max(...ends));
  return {
    id,
    group: groupId,
    ...(options.subgroup ? { subgroup: options.subgroup } : {}),
    content: `<span>${escapeHtml(label)}</span>`,
    start,
    end: end > start ? end : dayEnd(start),
    type: 'range',
    className: 'tl-subtask-summary',
    style: `background:${color}; border-color:${color}; color:#fff;`,
    _stackOrder: options.stackOrder ?? 0,
  };
}

function buildCompactSubtaskPlan(events, firstItemId = 0) {
  const subtaskMap = new Map();

  for (const ev of events) {
    const key = subtaskKey(ev);
    if (!key) continue;
    const calendarScopedKey = `${ev.calendarId}::${key}`;
    if (!subtaskMap.has(calendarScopedKey)) subtaskMap.set(calendarScopedKey, []);
    subtaskMap.get(calendarScopedKey).push(ev);
  }

  let itemId = firstItemId;
  const items = [];
  const eventMeta = new Map();

  // Group the subtask groups by calendarId
  const calSubtaskGroups = new Map();
  for (const [calendarScopedKey, groupEvents] of subtaskMap.entries()) {
    if (groupEvents.length < 2) continue;
    const calendarId = groupEvents[0].calendarId;
    if (!calSubtaskGroups.has(calendarId)) calSubtaskGroups.set(calendarId, []);
    calSubtaskGroups.get(calendarId).push(groupEvents);
  }

  let globalGroupIndex = 0;

  // Process subtasks calendar by calendar
  for (const [calendarId, groupsList] of calSubtaskGroups.entries()) {
    // Sort groups of this calendar by start time
    const sortedGroups = groupsList.sort((a, b) => 
      Math.min(...a.map(ev => ev.start)) - Math.min(...b.map(ev => ev.start))
    );

    // Compute range for each group
    const groupRanges = sortedGroups.map(groupEvents => {
      const starts = groupEvents.map(ev => dayStart(ev.start).getTime());
      const ends = groupEvents.map(ev => eventEndForTimeline(ev).getTime());
      return {
        events: groupEvents,
        start: Math.min(...starts),
        end: Math.max(...ends),
      };
    });

    // Partition into tracks
    const tracks = [];
    for (const range of groupRanges) {
      let placed = false;
      for (const track of tracks) {
        const last = track[track.length - 1];
        if (range.start >= last.end) {
          track.push(range);
          placed = true;
          break;
        }
      }
      if (!placed) {
        tracks.push([range]);
      }
    }

    // Assign subgroup and stackOrder
    tracks.forEach((track, trackIndex) => {
      const subgroup = `track-${trackIndex}`;
      
      track.forEach(range => {
        const groupEvents = range.events;
        const first = groupEvents[0];
        const baseOrder = globalGroupIndex * 100;
        globalGroupIndex++;

        items.push(buildSummaryItem(
          `subtask-summary:${itemId++}`,
          calendarId,
          groupEvents,
          subtaskLabel(first),
          '#455a64',
          { subgroup, stackOrder: baseOrder }
        ));

        groupEvents
          .slice()
          .sort((a, b) => a.start - b.start || a.title.localeCompare(b.title))
          .forEach((ev, eventIndex) => {
            eventMeta.set(compactEventKey(ev), {
              subgroup,
              stackOrder: baseOrder + 10 + eventIndex,
            });
          });
      });
    });
  }

  return { items, eventMeta, nextItemId: itemId };
}

function buildDayBackgroundItems() {
  const items = [];
  const today = dayStart(new Date());
  items.push({
    id: 'bg-today',
    start: today,
    end: dayEnd(today),
    type: 'background',
    className: 'tl-bg-today',
  });

  if (state.ganttHighlightedDate) {
    const selected = dayStart(state.ganttHighlightedDate);
    items.push({
      id: 'bg-selected',
      start: selected,
      end: dayEnd(selected),
      type: 'background',
      className: 'tl-bg-selected',
    });
  }

  return items;
}

function selectedPeopleLabel() {
  const names = [...state.filter.attendees].map(email => {
    const person = state.attendees.find(a => a.email === email);
    return person ? shortDisplayName(person.displayName, email) : email.split('@')[0];
  });
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function emptyTimelineMessage() {
  const people = selectedPeopleLabel();
  const calendarScope = state.filter.calendars.size > 0 ? 'the selected calendars' : 'any loaded calendars';
  if (people) return `No events found for ${escapeHtml(people)} in ${calendarScope} for this time range.`;

  return `No events found in ${calendarScope} for this time range.`;
}

// ── Timeline construction ─────────────────────────────────────────────────────
function buildTimeline(groups, items) {
  const container = el.tlContainer();

  if (items.length === 0) {
    if (state.tlInstance) {
      state.tlInstance.destroy();
      state.tlInstance  = null;
      timelineItemsData  = null;
      timelineGroupsData = null;
    }
    const msg = emptyTimelineMessage();
    container.innerHTML = `<div class="empty-state"><p>${msg}</p></div>`;
    return;
  }

  const allItems = [...buildDayBackgroundItems(), ...items];

  // Fast path — surgical DataSet updates (never clear(), which causes a blank intermediate state)
  if (state.tlInstance && timelineGroupsData && timelineItemsData) {
    const keepGroupIds = new Set(groups.map(g => String(g.id)));
    const removeGroupIds = timelineGroupsData.getIds().filter(id => !keepGroupIds.has(String(id)));
    if (removeGroupIds.length > 0) timelineGroupsData.remove(removeGroupIds);
    timelineGroupsData.update(groups);

    const keepItemIds = new Set(allItems.map(it => String(it.id)));
    const removeItemIds = timelineItemsData.getIds().filter(id => !keepItemIds.has(String(id)));
    if (removeItemIds.length > 0) timelineItemsData.remove(removeItemIds);
    timelineItemsData.update(allItems);
    return;
  }

  // Initial creation (or after being destroyed due to empty state)
  container.innerHTML = '';
  const now  = new Date();
  const mid  = now.getTime();
  const half = state.timelineZoom / 2;
  const win  = state.tlWindow;

  timelineGroupsData = new vis.DataSet(groups);
  timelineItemsData  = new vis.DataSet(allItems);

  state.tlInstance = new vis.Timeline(container, timelineItemsData, timelineGroupsData, {
    start:           win ? win.start : new Date(mid - half),
    end:             win ? win.end   : new Date(mid + half),
    moveable:        true,
    zoomable:        false,
    verticalScroll:  true,
    maxHeight:       container.clientHeight || 600,
    orientation:     'top',
    stack:           true,
    stackSubgroups:  true,
    showCurrentTime: false,
    groupOrder:      'content',
    order:           (a, b) => (a._stackOrder ?? 0) - (b._stackOrder ?? 0),
    timeAxis:        { scale: 'day', step: 1 },
    tooltip:         { followMouse: false, overflowMethod: 'cap' },
  });

  state.tlInstance.on('rangechanged', () => {
    state.tlWindow = state.tlInstance.getWindow();
  });

  state.tlInstance.on('itemover', props => {
    const itemData = timelineItemsData?.get(props.item);
    if (!itemData?._ev) return;
    const itemEl = props.event.target.closest('.vis-item') || props.event.target;
    showHoverTooltip(itemData._ev, itemEl);
  });
  state.tlInstance.on('itemout', () => hideHoverTooltip());

  state.tlInstance.on('click', props => {
    if (!props.item) {
      if (props.time) highlightGanttDate(props.time);
      return;
    }
    const itemData = timelineItemsData?.get(props.item);
    if (!itemData?._ev) {
      if (itemData?.type === 'background' && props.time) highlightGanttDate(props.time);
      return;
    }
    const itemEl = props.event.target.closest('.vis-item') || props.event.target;
    props.event.stopPropagation();
    showPinnedTooltip(itemData._ev, itemEl);
  });

  setupTimelineScroll(container);
  setupZoomButtons();
}

function highlightGanttDate(date) {
  state.ganttHighlightedDate = dayStart(date);
  if (!timelineItemsData) return;
  timelineItemsData.remove('bg-selected');
  timelineItemsData.add({
    id: 'bg-selected',
    start: state.ganttHighlightedDate,
    end: dayEnd(state.ganttHighlightedDate),
    type: 'background',
    className: 'tl-bg-selected',
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

  document.getElementById('gantt-today-btn')?.addEventListener('click', navigateGanttToToday);
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
  const container = el.tlContainer();
  if (container) container.classList.remove('gantt-mode-expanded'); // keep class removal as safety

  const calMap = new Map();
  for (const ev of events) {
    if (!calMap.has(ev.calendarId))
      calMap.set(ev.calendarId, { name: ev.calendarName, color: ev.calColor });
  }
  const groups = Array.from(calMap.entries()).map(([id, info]) => ({
    id,
    content: `<span style="color:${info.color};font-weight:500">${info.name}</span>`,
    subgroupStack: true,
    subgroupOrder: function(a, b) {
      const getVal = (subg) => {
        if (!subg) return 1000000;
        let val = typeof subg === 'string' ? subg : (subg.id || subg.subgroup || '');
        if (!val) return 1000000;
        if (val.startsWith('track-')) {
          return parseInt(val.split('-')[1], 10);
        }
        return 999999;
      };
      return getVal(a) - getVal(b);
    }
  }));
  const summaries = buildCompactSubtaskPlan(events);
  const eventItems = events
    .map((ev, i) => {
      const meta = summaries.eventMeta.get(compactEventKey(ev));
      return buildTimelineItem(summaries.nextItemId + i, ev, ev.calendarId, meta || {
        stackOrder: 100000 + i,
      });
    })
    .filter(Boolean);
  const items = [...summaries.items, ...eventItems];
  buildTimeline(groups, items);
}

export function navigateGanttToDate(date) {
  if (!state.tlInstance) return;
  const zoomMs = 259200000; // 3 days
  state.timelineZoom = zoomMs;
  const start = dayStart(date).getTime();
  highlightGanttDate(date);
  state.tlInstance.setWindow(
    new Date(start),
    new Date(start + zoomMs),
    { animation: { duration: 300, easingFunction: 'easeInOutQuad' } }
  );
  document.querySelectorAll('#zoom-toggle button').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.ms) === zoomMs);
  });
}

function navigateGanttToToday() {
  if (!state.tlInstance) return;
  const zoomMs = state.timelineZoom;
  const start = dayStart(new Date()).getTime();
  highlightGanttDate(new Date());
  state.tlInstance.setWindow(
    new Date(start),
    new Date(start + zoomMs),
    { animation: { duration: 300, easingFunction: 'easeInOutQuad' } }
  );
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
