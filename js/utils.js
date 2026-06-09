export function initials(name, email) {
  if (name && name.trim()) {
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return (email || '?').slice(0, 2).toUpperCase();
}

export function shortDisplayName(name, email) {
  if (name && name.trim()) return name.trim().split(' ')[0];
  return email ? email.split('@')[0] : 'Unknown';
}

export function avatarColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 55%, 45%)`;
}

export function formatDateRange(start, end, isAllDay) {
  const opts = { month: 'short', day: 'numeric' };
  const s = new Date(start);
  if (isAllDay) {
    const e = end ? new Date(end) : null;
    if (!e || s.toDateString() === e.toDateString()) return s.toLocaleDateString(undefined, opts);
    const eDisp = new Date(e); eDisp.setDate(eDisp.getDate() - 1);
    return `${s.toLocaleDateString(undefined, opts)} – ${eDisp.toLocaleDateString(undefined, opts)}`;
  }
  const timeOpts = { ...opts, hour: 'numeric', minute: '2-digit' };
  if (!end) return s.toLocaleDateString(undefined, timeOpts);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay) {
    return `${s.toLocaleDateString(undefined, opts)}, ${s.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – ${e.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  return `${s.toLocaleDateString(undefined, timeOpts)} – ${e.toLocaleDateString(undefined, timeOpts)}`;
}

export function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
