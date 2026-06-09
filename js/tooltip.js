import { el } from './state.js';
import { formatDateRange, shortDisplayName, escapeHtml } from './utils.js';

export function tooltipSections(ev) {
  const date        = ev.start ? formatDateRange(ev.start, ev.end, ev.isAllDay) : '';
  const assignees   = ev.attendees.map(a => shortDisplayName(a.displayName, a.email));
  const description = ev.description ? escapeHtml(ev.description.trim()) : '';
  return { date, assignees, description };
}

export function buildTooltipHTML(ev) {
  const { date, assignees, description } = tooltipSections(ev);
  const s = (label, body) =>
    `<div style="margin-top:8px;">
       <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#999;margin-bottom:3px;">${label}</div>
       ${body}
     </div>`;

  return `<div style="font-size:13px;line-height:1.5;max-width:300px;padding:2px 0;">
    <div style="font-weight:600;font-size:14px;">${escapeHtml(ev.title)}</div>
    ${date ? `<div style="color:#777;font-size:12px;margin-top:2px;">${date}</div>` : ''}
    ${assignees.length ? s('Assignees', assignees.map(n => `<div>${escapeHtml(n)}</div>`).join('')) : ''}
    ${description ? s('Details', `<div style="font-size:12px;white-space:pre-wrap;max-height:120px;overflow:hidden;">${description}</div>`) : ''}
  </div>`;
}

export function showTooltip(ev, jsEvent) {
  const tip = el.tooltip();
  const { date, assignees, description } = tooltipSections(ev);

  tip.innerHTML = `
    <div class="tt-title">${escapeHtml(ev.title)}</div>
    ${date ? `<div class="tt-date">${date}</div>` : ''}
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

  const pad = 12;
  tip.style.left = `${jsEvent.pageX + pad}px`;
  tip.style.top  = `${jsEvent.pageY + pad}px`;
  tip.classList.add('visible');

  requestAnimationFrame(() => {
    const r = tip.getBoundingClientRect();
    if (r.right  > window.innerWidth  - pad) tip.style.left = `${jsEvent.pageX - r.width  - pad}px`;
    if (r.bottom > window.innerHeight - pad) tip.style.top  = `${jsEvent.pageY - r.height - pad}px`;
  });
}

export function hideTooltip() {
  el.tooltip().classList.remove('visible');
}
