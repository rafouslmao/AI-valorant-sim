import { getActiveSaveId } from '../core/storage.js';

export function parseHash() {
  const raw = window.location.hash || '#/start';
  const [path, query = ''] = raw.slice(1).split('?');
  const params = new URLSearchParams(query);
  return { path: path || '/start', params };
}

export function ensureRouteGuards() {
  const { path } = parseHash();
  const hasActiveSave = Boolean(getActiveSaveId());
  if (!hasActiveSave && path !== '/start') {
    window.location.hash = '#/start';
    return false;
  }
  if (hasActiveSave && path === '/start') {
    window.location.hash = '#/home';
    return false;
  }
  return true;
}

export function go(path) {
  window.location.hash = `#${path}`;
}
