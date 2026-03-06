import { archiveMessage, getInbox, getUnreadCount, markAllRead, markRead } from '../../core/messages.js';
import { mutateWorld } from '../../core/state.js';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'contract', label: 'Contracts' },
  { key: 'team', label: 'Team' },
  { key: 'finance', label: 'Facilities' },
  { key: 'sponsors', label: 'Sponsors' },
  { key: 'matches', label: 'Matches' }
];

const ICONS = { contract: '📝', team: '👥', finance: '🏢', sponsors: '🤝', matches: '🎯', recommendation: '🧠', roster: '📋', system: '⚙️' };

function formatTs(ts) {
  return new Date(ts).toLocaleString();
}

export function renderMessages(main, state) {
  let category = 'all';
  let selectedId = null;

  function draw() {
    const inbox = getInbox(state, { category });
    if (!selectedId && inbox[0]) selectedId = inbox[0].id;
    const selected = inbox.find((m) => m.id === selectedId) || null;
    const details = selected?.details || {};

    main.innerHTML = `<h1>Messages (${getUnreadCount(state)} unread)</h1>
      <div class="messages-grid">
        <div>
          <div class="top-actions"><button id="mark-all">Mark All Read</button>
          <select id="filter">${FILTERS.map((f) => `<option value="${f.key}">${f.label}</option>`).join('')}</select></div>
          <div id="msg-list">${inbox.map((m) => `<div class="msg-item ${m.read ? '' : 'unread'}" data-id="${m.id}"><span>${m.read ? '' : '● '}${ICONS[m.category] || '✉️'}</span> <strong>${m.subject}</strong><br/><small>${m.from.name} • ${formatTs(m.ts)} • ${m.category}</small></div>`).join('') || '<p>No messages.</p>'}</div>
        </div>
        <div id="msg-view">${selected ? `<h3>${selected.subject}</h3><p><small>${selected.from.name} • ${formatTs(selected.ts)}</small></p><div>${selected.body.split('\n').map((line) => `<p>${line}</p>`).join('')}</div>
          ${details.bullets?.length ? `<h4>Details</h4><ul>${details.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` : ''}
          ${details.stats?.length ? `<table><tr><th>Stat</th><th>Value</th></tr>${details.stats.map((s) => `<tr><td>${s.label}</td><td>${s.value}</td></tr>`).join('')}</table>` : ''}
          <div class="top-actions"><button id="toggle-read">${selected.read ? 'Mark Unread' : 'Mark Read'}</button><button id="archive">Archive</button></div>
          <div>${[...(selected.actions || []), ...(details.links || []).map((l) => ({ label: l.label, route: l.route }))].map((a, i) => `<button data-action="${i}">${a.label}</button>`).join('')}</div>` : '<p>Select a message.</p>'}</div>
      </div>`;

    main.querySelector('#filter').value = category;
    main.querySelector('#filter').onchange = (e) => { category = e.target.value; selectedId = null; draw(); };
    main.querySelector('#mark-all').onclick = () => { mutateWorld((w) => markAllRead(w)); draw(); };

    main.querySelectorAll('.msg-item').forEach((el) => el.onclick = () => {
      selectedId = el.dataset.id;
      mutateWorld((w) => markRead(w, selectedId, true));
      draw();
    });

    if (selected) {
      main.querySelector('#toggle-read').onclick = () => { mutateWorld((w) => markRead(w, selected.id, !selected.read)); draw(); };
      main.querySelector('#archive').onclick = () => { mutateWorld((w) => archiveMessage(w, selected.id)); selectedId = null; draw(); };
      const allActions = [...(selected.actions || []), ...(details.links || []).map((l) => ({ label: l.label, route: l.route }))];
      main.querySelectorAll('[data-action]').forEach((btn) => btn.onclick = () => {
        const action = allActions[Number(btn.dataset.action)];
        if (!action?.route) return;
        window.location.hash = action.route.replace(/^#/, '#');
      });
    }
  }

  draw();
}
