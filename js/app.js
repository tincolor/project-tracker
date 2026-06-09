import { CONFIG } from '../config.js';
import { state, el, show, hide, setLoading, nextColor } from './state.js';
import { loadAllEvents, fetchCalendarEvents, extractAttendees } from './events.js';
import { hideHoverTooltip, hidePinnedTooltip } from './tooltip.js';
import { toggleDeconflictPanel, closeDeconflictPanel, refreshDeconflictPanel, updateDeconflictBadge } from './deconflict.js';
import { renderMonth } from './views/month.js';
import { renderGantt } from './views/gantt.js';
import { renderList } from './views/list.js';
import { renderTable } from './views/table.js';
import {
  renderCalendarList, renderPersonList,
  renderPresets, loadPresets,
} from './sidebar.js';

let refreshInFlight = false;

// ── Script loader (for gapi / gsi) ────────────────────────────────────────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── View switching ────────────────────────────────────────────────────────────
function switchView(view, force = false) {
  if (view === state.view && !force) return;
  state.view = view;

  hide('view-month'); hide('view-gantt'); hide('view-list'); hide('view-table');
  hide('gantt-groupby-section');
  el.viewBtns().forEach(b => b.classList.toggle('active', b.dataset.view === view));

  if (view === 'month') { show('view-month'); renderMonth(); }
  if (view === 'gantt') { show('view-gantt'); show('gantt-groupby-section'); renderGantt(); }
  if (view === 'list')  { show('view-list');  renderList(); }
  if (view === 'table') { show('view-table'); renderTable(); }
}

function renderAll() {
  renderCalendarList();
  renderPersonList();
  renderPresets();
  switchView(state.view, true);
  refreshDeconflictPanel();
}

// ── Calendar refresh ──────────────────────────────────────────────────────────
async function refreshCalendarData({ showSpinner = false } = {}) {
  if (refreshInFlight) return;
  refreshInFlight = true;
  updateRefreshBtn();
  if (showSpinner) setLoading(true);

  try {
    if (state.auth.signedIn) await loadUserCalendars({ fetchNewEvents: false });
    await loadAllEvents();
    renderAll();
    updateDeconflictBadge();
  } catch (err) {
    console.error('Calendar refresh failed:', err);
  } finally {
    if (showSpinner) setLoading(false);
    refreshInFlight = false;
    updateRefreshBtn();
  }
}

function updateRefreshBtn() {
  const btn = el.refreshBtn();
  if (!btn) return;
  btn.disabled = refreshInFlight;
  btn.classList.toggle('refreshing', refreshInFlight);
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 11-2.64-6.36"/>
      <path d="M21 3v6h-6"/>
    </svg>
    ${refreshInFlight ? 'Refreshing' : 'Refresh'}
  `;
}

// ── Calendar setup ────────────────────────────────────────────────────────────
function initCalendars() {
  state.calendars = CONFIG.PUBLIC_CALENDARS.map(c => ({
    ...c,
    color:    c.color || nextColor(),
    enabled:  true,
    isPublic: true,
  }));
  
  state.calendars.push({
    id: 'mock-project-calendar-b',
    name: 'Sample Calendar B',
    color: '#8b5cf6',
    enabled: true,
    isPublic: true,
  });

  state.calendars.push({
    id: 'mock-project-calendar-a',
    name: 'Sample Calendar A',
    color: '#10b981',
    enabled: true,
    isPublic: true,
  });

  state.filter.calendars = new Set();
  renderCalendarList();
}

async function loadUserCalendars({ fetchNewEvents = true } = {}) {
  try {
    const resp     = await gapi.client.calendar.calendarList.list({ minAccessRole: 'reader' });
    const existing = new Set(state.calendars.map(c => c.id));

    for (const item of resp.result.items || []) {
      if (existing.has(item.id)) continue;
      const teamEntry = (CONFIG.TEAM_CALENDARS || []).find(t => t.id === item.id);
      state.calendars.push({
        id:       item.id,
        name:     teamEntry?.name || item.summary || item.id,
        color:    teamEntry?.color || item.backgroundColor || nextColor(),
        enabled:  true,
        isPublic: false,
      });
    }

    const newCals = state.calendars.filter(c => !existing.has(c.id));
    if (fetchNewEvents) {
      for (const cal of newCals) {
        const evs = await fetchCalendarEvents(cal);
        state.events.push(...evs);
      }
    }

    extractAttendees();
    renderCalendarList();
    renderPersonList();
  } catch (err) {
    console.error('Could not load user calendars:', err);
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function updateAuthBtn() {
  const btn = el.authBtn();
  if (!btn) return;
  const icon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 100 10A5 5 0 0012 2zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z"/></svg>`;
  if (state.auth.signedIn) {
    btn.className = 'signed-in';
    btn.innerHTML = `${icon} Signed in`;
  } else {
    btn.className = '';
    btn.innerHTML = `${icon} Sign in with Google`;
  }
}

function setupTokenClient() {
  if (!CONFIG.CLIENT_ID || CONFIG.CLIENT_ID === 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com') return;
  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope:     'https://www.googleapis.com/auth/calendar.readonly',
    callback:  async resp => {
      if (resp.error) return;
      state.auth.signedIn = true;
      updateAuthBtn();
      await refreshCalendarData({ showSpinner: true });
    },
  });
}

// ── Event listeners ───────────────────────────────────────────────────────────
function setupEventListeners() {
  // Auth button
  el.authBtn()?.addEventListener('click', () => {
    if (!state.tokenClient) {
      alert('CLIENT_ID is not set in config.js. See README.md for setup instructions.');
      return;
    }
    if (state.auth.signedIn) {
      google.accounts.oauth2.revoke(gapi.client.getToken()?.access_token, () => {
        gapi.client.setToken(null);
        state.auth.signedIn = false;
        state.calendars     = state.calendars.filter(c => c.isPublic);
        state.filter.calendars = new Set();
        state.events        = state.events.filter(ev => state.calendars.some(c => c.id === ev.calendarId));
        state.attendees     = [];
        state.filter.attendees.clear();
        updateAuthBtn();
        renderAll();
      });
    } else {
      state.tokenClient.requestAccessToken();
    }
  });

  // View toggle
  el.viewBtns().forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

  // Group-by toggle (Gantt)
  el.groupBtns().forEach(btn => {
    btn.addEventListener('click', () => {
      state.groupBy = btn.dataset.group;
      el.groupBtns().forEach(b => b.classList.toggle('active', b.dataset.group === state.groupBy));
      if (state.view === 'gantt') renderGantt();
    });
  });

  // Deconflict panel
  document.getElementById('deconflict-btn')?.addEventListener('click', toggleDeconflictPanel);
  document.getElementById('deconflict-close')?.addEventListener('click', closeDeconflictPanel);

  // Manual calendar refresh
  el.refreshBtn()?.addEventListener('click', () => refreshCalendarData({ showSpinner: true }));

  // Clicking outside an event element or the pinned tooltip dismisses the pin
  document.addEventListener('click', e => {
    const onEvent = e.target.closest('.fc-event, .vis-item');
    const onPin   = el.tooltipPinned().contains(e.target);
    if (!onEvent && !onPin) hidePinnedTooltip();
    // Hover tooltip is always hidden on mouse-leave; no click logic needed
  });

  // Sidebar filter changes → refresh view + presets + deconflict
  document.addEventListener('cdash:filter-changed', () => {
    renderPresets();
    switchView(state.view, true);
    refreshDeconflictPanel();
  });
}

// ── Config warning ────────────────────────────────────────────────────────────
function showConfigWarning() {
  document.getElementById('main').innerHTML = `
    <div class="empty-state" style="padding:40px;text-align:center;max-width:480px;margin:0 auto;">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.35">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <h2 style="font-size:17px;margin-top:12px;font-weight:500;">Setup required</h2>
      <p style="line-height:1.7;color:var(--text-sub);margin-top:8px;">
        Open <strong>config.js</strong> and add your
        <code style="background:var(--bg);padding:1px 5px;border-radius:3px;">CLIENT_ID</code> and
        <code style="background:var(--bg);padding:1px 5px;border-radius:3px;">API_KEY</code>
        from the Google Cloud Console.<br>See <strong>README.md</strong> for setup instructions.
      </p>
    </div>`;
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  // Load Google API client library
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise(resolve => {
    gapi.load('client', async () => {
      await gapi.client.init({
        apiKey:        CONFIG.API_KEY,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
      });
      resolve();
    });
  });

  // Load Google Identity Services
  await loadScript('https://accounts.google.com/gsi/client');

  setupTokenClient();
  setupEventListeners();
  loadPresets();
  initCalendars();
  setLoading(true);
  await loadAllEvents();
  setLoading(false);
  renderAll();
  updateDeconflictBadge();
  updateRefreshBtn();
}

// ── Entry point ───────────────────────────────────────────────────────────────
if (!CONFIG.API_KEY || CONFIG.API_KEY === 'YOUR_API_KEY_HERE') {
  showConfigWarning();
} else {
  init().catch(err => console.error('Init failed:', err));
}
