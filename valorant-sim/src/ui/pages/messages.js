import { archiveMessage, getInbox, getUnreadCount, markAllRead, markRead } from '../../core/messages.js';
import { mutateWorld } from '../../core/state.js';

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

    main.innerHTML = `<h1>Messages (${getUnreadCount(state)} unread)</h1>
      <div class="messages-grid">
        <div>
          <div class="top-actions"><button id="mark-all">Mark All Read</button>
          <select id="filter"><option value="all">All</option><option value="contract">Contracts</option><option value="recommendation">Recommendations</option><option value="system">System</option></select></div>
          <div id="msg-list">${inbox.map((m) => `<div class="msg-item ${m.read ? '' : 'unread'}" data-id="${m.id}"><strong>${m.subject}</strong><br/><small>${m.from.name} • ${formatTs(m.ts)}</small></div>`).join('') || '<p>No messages.</p>'}</div>
        </div>
        <div id="msg-view">${selected ? `<h3>${selected.subject}</h3><p><small>${selected.from.name} • ${formatTs(selected.ts)}</small></p><pre>${selected.body}</pre><div class="top-actions"><button id="toggle-read">${selected.read ? 'Mark Unread' : 'Mark Read'}</button><button id="archive">Archive</button></div><div>${(selected.actions || []).map((a, i) => `<button data-action="${i}">${a.label}</button>`).join('')}</div>` : '<p>Select a message.</p>'}</div>
      </div>`;

    main.querySelector('#filter').value = category;
    main.querySelector('#filter').onchange = (e) => { category = e.target.value; draw(); };
    main.querySelector('#mark-all').onclick = () => {
      mutateWorld((w) => markAllRead(w));
      draw();
    };

    main.querySelectorAll('.msg-item').forEach((el) => el.onclick = () => {
      selectedId = el.dataset.id;
      mutateWorld((w) => markRead(w, selectedId, true));
      draw();
    });

    if (selected) {
      main.querySelector('#toggle-read').onclick = () => {
        mutateWorld((w) => markRead(w, selected.id, !selected.read));
        draw();
      };
      main.querySelector('#archive').onclick = () => {
        mutateWorld((w) => archiveMessage(w, selected.id));
        selectedId = null;
        draw();
      };
      main.querySelectorAll('[data-action]').forEach((btn) => btn.onclick = () => {
        const action = selected.actions?.[Number(btn.dataset.action)];
        if (!action) return;
        if (action.route) window.location.hash = action.route.replace(/^#/, '#');
      });
    }
  }

  draw();
}
