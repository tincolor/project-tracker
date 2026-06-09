export const state = {
  events:       [],
  calendars:    [],
  attendees:    [],
  view:         'month',
  groupBy:      'calendar',
  presets:      [],
  filter: {
    calendars:  new Set(),
    attendees:  new Set(),
  },
  peopleSearch: '',
  calSearch:    '',
  timelineZoom: 2592000000,
  auth:         { signedIn: false },
  tokenClient:  null,
  fcInstance:   null,
  tlInstance:   null,
};

export const el = {
  authBtn:       () => document.getElementById('auth-btn'),
  calList:       () => document.getElementById('cal-list'),
  personList:    () => document.getElementById('person-list'),
  presetList:    () => document.getElementById('preset-list'),
  fcContainer:   () => document.getElementById('fc-container'),
  tlContainer:   () => document.getElementById('timeline-container'),
  listContainer: () => document.getElementById('list-container'),
  loading:       () => document.getElementById('loading-overlay'),
  tooltipHover:      () => document.getElementById('tooltip-hover'),
  tooltipPinned:     () => document.getElementById('tooltip-pinned'),
  deconflictPanel:   () => document.getElementById('deconflict-panel'),
  deconflictBtn:     () => document.getElementById('deconflict-btn'),
  viewBtns:      () => document.querySelectorAll('#view-toggle button'),
  groupBtns:     () => document.querySelectorAll('.group-toggle button'),
};

export const show = id => { const e = document.getElementById(id); if (e) e.style.display = ''; };
export const hide = id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; };
export const setLoading = on => {
  const ov = el.loading();
  if (ov) ov.style.display = on ? 'flex' : 'none';
};

const PALETTE = ['#1a73e8','#34a853','#f5a623','#e91e63','#9c27b0','#00bcd4','#ff5722','#607d8b'];
let _paletteIdx = 0;
export const nextColor = () => PALETTE[_paletteIdx++ % PALETTE.length];
