import { state } from './state.js';
import { shortDisplayName, initials, avatarColor } from './utils.js';

const presetsKey    = () => state.auth?.email ? `cdash-presets-${state.auth.email}` : null;
const filterChanged = () => document.dispatchEvent(new CustomEvent('cdash:filter-changed'));

// ── Presets ───────────────────────────────────────────────────────────────────
export function loadPresets() {
  const key = presetsKey();
  if (!key) { state.presets = []; return; }
  try { state.presets = JSON.parse(localStorage.getItem(key)) || []; }
  catch { state.presets = []; }
}

export function savePresetsToStorage() {
  const key = presetsKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(state.presets));
}

export function renderPresets() {
  const list = document.getElementById('preset-list');
  if (!list) return;

  const hasSelection = state.filter.calendars.size > 0;

  const presetChips = state.presets.length > 0
    ? state.presets.map((p, i) => {
        const isActive = [...state.filter.calendars].sort().join() === [...p.calIds].sort().join();
        return `<div class="preset-chip ${isActive ? 'preset-active' : ''}" data-idx="${i}">
          <span class="preset-name">${p.name}</span>
          <span class="preset-delete" data-idx="${i}" title="Delete">×</span>
        </div>`;
      }).join('')
    : '';

  const saveSection = hasSelection ? `
    <div id="preset-save-area" style="margin-top:8px;">
      <button id="preset-save-btn" style="font-size:12px;color:var(--accent);background:none;border:none;cursor:pointer;padding:0;">+ Save current as preset</button>
    </div>` : '';

  const hint = !hasSelection && state.presets.length === 0
    ? `<p style="font-size:12px;color:var(--text-sub);line-height:1.5;">Select calendars, then save them as a named preset to quickly switch between views.</p>`
    : '';

  list.innerHTML = (presetChips
    ? `<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:4px;">${presetChips}</div>`
    : '') + hint + saveSection;

  list.querySelectorAll('.preset-chip').forEach(chip => {
    chip.querySelector('.preset-name').addEventListener('click', () => {
      const p = state.presets[Number(chip.dataset.idx)];
      if (!p) return;
      state.filter.calendars = new Set(p.calIds.filter(id => state.calendars.some(c => c.id === id)));
      renderCalendarList();
      renderPresets();
      filterChanged();
    });
  });

  list.querySelectorAll('.preset-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.presets.splice(Number(btn.dataset.idx), 1);
      savePresetsToStorage();
      renderPresets();
    });
  });

  list.querySelector('#preset-save-btn')?.addEventListener('click', () => {
    const area = list.querySelector('#preset-save-area');
    area.innerHTML = `
      <div style="display:flex;gap:6px;align-items:center;">
        <input id="preset-name-input" type="text" placeholder="Preset name…"
          style="flex:1;padding:5px 8px;border:1px solid var(--accent);border-radius:5px;font-size:12px;outline:none;">
        <button id="preset-confirm" style="padding:5px 10px;background:var(--accent);color:#fff;border:none;border-radius:5px;font-size:12px;cursor:pointer;">Save</button>
      </div>`;

    const input = list.querySelector('#preset-name-input');
    input.focus();

    const doSave = () => {
      const name = input.value.trim();
      if (!name) return;
      state.presets.push({ name, calIds: [...state.filter.calendars] });
      savePresetsToStorage();
      renderPresets();
    };

    list.querySelector('#preset-confirm').addEventListener('click', doSave);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });
  });
}

// ── Calendar list ─────────────────────────────────────────────────────────────
export function renderCalendarList() {
  const list = document.getElementById('cal-list');
  if (!list) return;

  const selected = state.filter.calendars;
  const search   = state.calSearch.toLowerCase().trim();

  const chipsHTML = selected.size > 0 ? `
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
      ${Array.from(selected).map(id => {
        const cal = state.calendars.find(c => c.id === id);
        if (!cal) return '';
        return `<div class="cal-chip" data-id="${id}" style="display:flex;align-items:center;gap:5px;padding:3px 8px 3px 5px;background:var(--accent-light);border-radius:12px;cursor:pointer;font-size:12px;color:var(--accent);">
          <div style="width:10px;height:10px;border-radius:50%;background:${cal.color};flex-shrink:0;"></div>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;">${cal.name}</span>
          <span style="font-size:15px;line-height:1;opacity:.6;margin-left:1px;">×</span>
        </div>`;
      }).join('')}
    </div>` : '';

  const btnStyle = 'font-size:11px;color:var(--accent);background:none;border:none;cursor:pointer;padding:0;';
  const searchHTML = `
    <input type="text" class="cal-search" placeholder="Search calendars…" value="${state.calSearch}"
      style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;outline:none;color:var(--text);background:var(--bg);box-sizing:border-box;">
    ${state.calendars.length > 0 ? `
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:4px;margin-bottom:2px;">
        <button class="cal-add-all"    style="${btnStyle}">Add all</button>
        <button class="cal-remove-all" style="${btnStyle}color:var(--text-sub);">Remove all</button>
      </div>` : ''}`;

  const matches = state.calendars.filter(c =>
    !selected.has(c.id) && (!search || c.name.toLowerCase().includes(search))
  );

  let resultsHTML = '';
  if (search && matches.length === 0) {
    resultsHTML = `<p style="font-size:12px;color:var(--text-sub);padding:6px 2px;">No results</p>`;
  } else if (matches.length > 0) {
    resultsHTML = `<div style="margin-top:4px;">${matches.map(cal => `
      <div class="cal-result" data-id="${cal.id}" style="display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:6px;cursor:pointer;">
        <div style="width:12px;height:12px;border-radius:50%;background:${cal.color};flex-shrink:0;"></div>
        <span style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${cal.name}</span>
      </div>`).join('')}</div>`;
  }

  list.innerHTML = chipsHTML + searchHTML + resultsHTML;

  const input = list.querySelector('.cal-search');
  if (input && state.calSearch) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  input?.addEventListener('input', e => {
    state.calSearch = e.target.value;
    renderCalendarList();
  });

  list.querySelectorAll('.cal-result').forEach(item => {
    item.addEventListener('mouseover', () => item.style.background = 'var(--bg)');
    item.addEventListener('mouseout',  () => item.style.background = '');
    item.addEventListener('click', () => {
      selected.add(item.dataset.id);
      state.calSearch = '';
      renderCalendarList();
      filterChanged();
    });
  });

  list.querySelectorAll('.cal-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      selected.delete(chip.dataset.id);
      renderCalendarList();
      filterChanged();
    });
  });

  list.querySelector('.cal-add-all')?.addEventListener('click', () => {
    state.calendars.forEach(c => selected.add(c.id));
    state.calSearch = '';
    renderCalendarList();
    filterChanged();
  });

  list.querySelector('.cal-remove-all')?.addEventListener('click', () => {
    selected.clear();
    state.calSearch = '';
    renderCalendarList();
    filterChanged();
  });
}

// ── Person filter ─────────────────────────────────────────────────────────────
export function renderPersonList() {
  const list = document.getElementById('person-list');
  if (!list) return;

  const selected = state.filter.attendees;
  const search   = state.peopleSearch.toLowerCase().trim();

  const chipsHTML = selected.size > 0 ? `
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
      ${Array.from(selected).map(email => {
        const person = state.attendees.find(a => a.email === email);
        const name   = person ? shortDisplayName(person.displayName, email) : email.split('@')[0];
        const ini    = person ? initials(person.displayName, email) : email.slice(0, 2).toUpperCase();
        const color  = avatarColor(email);
        return `<div class="person-chip" data-email="${email}" style="display:flex;align-items:center;gap:5px;padding:3px 8px 3px 5px;background:var(--accent-light);border-radius:12px;cursor:pointer;font-size:12px;color:var(--accent);">
          <div style="width:18px;height:18px;border-radius:50%;background:${color};color:#fff;font-size:9px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${ini}</div>
          <span>${name}</span>
          <span style="font-size:15px;line-height:1;opacity:.6;margin-left:1px;">×</span>
        </div>`;
      }).join('')}
    </div>` : '';

  const searchHTML = `<input type="text" class="people-search" placeholder="Search people…" value="${state.peopleSearch}"
    style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;outline:none;color:var(--text);background:var(--bg);box-sizing:border-box;">`;

  let resultsHTML = '';
  if (search) {
    const matches = state.attendees.filter(a =>
      !selected.has(a.email) &&
      (a.displayName.toLowerCase().includes(search) || a.email.toLowerCase().includes(search))
    );
    if (matches.length === 0) {
      resultsHTML = `<p style="font-size:12px;color:var(--text-sub);padding:6px 2px;">No results</p>`;
    } else {
      resultsHTML = `<div style="margin-top:4px;">${matches.map(a => {
        const ini   = initials(a.displayName, a.email);
        const color = avatarColor(a.email);
        return `<div class="person-result" data-email="${a.email}" style="display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:6px;cursor:pointer;">
          <div class="avatar" style="background:${color}">${ini}</div>
          <div style="flex:1;overflow:hidden;">
            <div style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${shortDisplayName(a.displayName, a.email)}</div>
            <div style="font-size:11px;color:var(--text-sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.email}</div>
          </div>
        </div>`;
      }).join('')}</div>`;
    }
  } else if (state.attendees.length === 0) {
    resultsHTML = `<p style="font-size:12px;color:var(--text-sub);line-height:1.5;margin-top:6px;">Attendee filters appear here once you sign in and load calendars with assigned events.</p>`;
  }

  list.innerHTML = chipsHTML + searchHTML + resultsHTML;

  const input = list.querySelector('.people-search');
  if (input && state.peopleSearch) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  input?.addEventListener('input', e => {
    state.peopleSearch = e.target.value;
    renderPersonList();
  });

  list.querySelectorAll('.person-result').forEach(item => {
    item.addEventListener('mouseover', () => item.style.background = 'var(--bg)');
    item.addEventListener('mouseout',  () => item.style.background = '');
    item.addEventListener('click', () => {
      selected.add(item.dataset.email);
      state.peopleSearch = '';
      renderPersonList();
      filterChanged();
    });
  });

  list.querySelectorAll('.person-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      selected.delete(chip.dataset.email);
      renderPersonList();
      filterChanged();
    });
  });
}
