import { el } from './state.js';
import { formatDateRange, shortDisplayName, escapeHtml } from './utils.js';

function tooltipSections(ev) {
  const date        = ev.start ? formatDateRange(ev.start, ev.end, ev.isAllDay) : '';
  const assignees   = ev.attendees.map(a => shortDisplayName(a.displayName, a.email));
  const description = ev.description ? escapeHtml(ev.description.trim()) : '';
  return { date, assignees, description };
}

// Shared HTML content — used by both hover and pinned tooltips
function buildContent(ev) {
  const { date, assignees, description } = tooltipSections(ev);
  return `
    <div class="tt-header">
      <div class="tt-title">${escapeHtml(ev.title)}</div>
      ${date ? `<div class="tt-date">${date}</div>` : ''}
    </div>
    ${assignees.length ? `
      <div class="tt-section">
        <div class="tt-section-label">Assignees</div>
        ${assignees.map(n => `<div class="tt-assignee">${escapeHtml(n)}</div>`).join('')}
      </div>` : ''}
    ${description ? `
      <div class="tt-section">
        <div class="tt-section-label">Details</div>
        <div class="tt-details">${description}</div>
      </div>` : ''}
  `;
}

// Returns true if two rects overlap (with an optional gap buffer)
function rectsOverlap(a, b, gap = 12) {
  return !(a.right  + gap <= b.left  ||
           a.left   - gap >= b.right ||
           a.bottom + gap <= b.top   ||
           a.top    - gap >= b.bottom);
}

// Position a tooltip anchored to an entry element.
// Tries all four candidates (right/left × top-align/bottom-align) in preference
// order and picks the first one that doesn't overlap `avoidEl` (if provided).
function positionTooltip(tip, anchorEl, avoidEl = null) {
  const pad  = 10;
  const rect = anchorEl.getBoundingClientRect();
  const vw   = window.innerWidth;
  const vh   = window.innerHeight;

  // Render off-screen first so we can measure natural size
  tip.style.left = '-9999px';
  tip.style.top  = '0';

  requestAnimationFrame(() => {
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;

    // Avoid rect: only read if element is visible and already positioned
    const avoidRect = (avoidEl?.classList.contains('visible') &&
                       parseFloat(avoidEl.style.left) > -9000)
      ? avoidEl.getBoundingClientRect()
      : null;

    // Horizontal preference: right if it has enough room (or more than left)
    const spaceRight = vw - rect.right - pad;
    const spaceLeft  = rect.left - pad;
    const preferRight = spaceRight >= tw || spaceRight >= spaceLeft;

    // Build candidates in preference order:
    //   1st choice  — preferred side, top-aligned
    //   2nd choice  — preferred side, bottom-aligned
    //   3rd choice  — other side, top-aligned
    //   4th choice  — other side, bottom-aligned
    const candidates = [];
    for (const useRight of [preferRight, !preferRight]) {
      const rawLeft = useRight ? rect.right + pad : rect.left - tw - pad;
      for (const topAlign of [true, false]) {
        const rawTop = topAlign ? rect.top : rect.bottom - th;
        candidates.push({
          left: Math.max(pad, Math.min(rawLeft, vw - tw - pad)),
          top:  Math.max(pad, Math.min(rawTop,  vh - th - pad)),
        });
      }
    }

    // Pick the first candidate that clears the pinned tooltip
    let chosen = candidates[0];
    if (avoidRect) {
      for (const c of candidates) {
        const r = { left: c.left, top: c.top, right: c.left + tw, bottom: c.top + th };
        if (!rectsOverlap(r, avoidRect)) {
          chosen = c;
          break;
        }
      }
    }

    tip.style.left = `${chosen.left}px`;
    tip.style.top  = `${chosen.top}px`;
  });
}

// ── Hover tooltip ─────────────────────────────────────────────────────────────
export function showHoverTooltip(ev, anchorEl) {
  const tip = el.tooltipHover();
  tip.innerHTML = buildContent(ev);
  tip.classList.add('visible');
  // Pass pinned tooltip as the element to avoid
  positionTooltip(tip, anchorEl, el.tooltipPinned());
}

export function hideHoverTooltip() {
  el.tooltipHover().classList.remove('visible');
}

// ── Pinned tooltip ────────────────────────────────────────────────────────────
export function showPinnedTooltip(ev, anchorEl) {
  hideHoverTooltip();
  const tip = el.tooltipPinned();

  tip.innerHTML = `
    <button class="tt-close" aria-label="Close">×</button>
    ${buildContent(ev)}
  `;
  tip.classList.add('visible');
  positionTooltip(tip, anchorEl);

  tip.querySelector('.tt-close').addEventListener('click', e => {
    e.stopPropagation();
    hidePinnedTooltip();
  });
}

export function hidePinnedTooltip() {
  el.tooltipPinned().classList.remove('visible');
}
