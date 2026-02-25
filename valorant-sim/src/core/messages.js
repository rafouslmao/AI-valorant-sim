import { uid } from './utils.js';

function ensureMessages(state) {
  if (!state.messages) state.messages = [];
}

function normalizeDetails(details = {}) {
  return {
    bullets: Array.isArray(details.bullets) ? details.bullets : [],
    stats: Array.isArray(details.stats) ? details.stats : [],
    links: Array.isArray(details.links) ? details.links : [],
    tags: Array.isArray(details.tags) ? details.tags : []
  };
}

export function addMessage(state, input) {
  ensureMessages(state);
  const msg = {
    id: uid('msg'),
    ts: Date.now(),
    from: input.from || { type: 'system', name: 'System' },
    to: input.to || { type: 'user' },
    subject: input.subject || 'Notification',
    body: input.body || '',
    category: input.category || 'system',
    related: input.related || {},
    actions: input.actions || [],
    details: normalizeDetails(input.details),
    read: false,
    archived: false
  };
  state.messages.push(msg);
  return msg.id;
}

export function markRead(state, messageId, read = true) {
  ensureMessages(state);
  const m = state.messages.find((x) => x.id === messageId);
  if (m) m.read = read;
}

export function markAllRead(state) {
  ensureMessages(state);
  for (const m of state.messages) m.read = true;
}

export function archiveMessage(state, messageId) {
  ensureMessages(state);
  const m = state.messages.find((x) => x.id === messageId);
  if (m) m.archived = true;
}

export function deleteMessage(state, messageId) {
  ensureMessages(state);
  state.messages = state.messages.filter((m) => m.id !== messageId);
}

export function getInbox(state, filters = {}) {
  ensureMessages(state);
  return state.messages
    .filter((m) => (filters.archived ? true : !m.archived))
    .filter((m) => (filters.category && filters.category !== 'all' ? m.category === filters.category : true))
    .sort((a, b) => b.ts - a.ts);
}

export function getUnreadCount(state) {
  ensureMessages(state);
  return state.messages.filter((m) => !m.read && !m.archived).length;
}
