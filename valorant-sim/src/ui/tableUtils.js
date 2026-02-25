function compareValues(a, b, dir = 'desc') {
  const left = a ?? '';
  const right = b ?? '';
  let base = 0;
  if (typeof left === 'number' && typeof right === 'number') {
    base = left - right;
  } else {
    base = String(left).localeCompare(String(right), undefined, { sensitivity: 'base', numeric: true });
  }
  return dir === 'asc' ? base : -base;
}

export function createTableState({ defaultSortKey, defaultSortDir = 'desc', pageSize = 25 } = {}) {
  return {
    sortState: { key: defaultSortKey, dir: defaultSortDir },
    pageState: { page: 1, pageSize }
  };
}

export function applySort(rows, sortState, accessors = {}) {
  const { key, dir } = sortState;
  const getter = accessors[key] || ((row) => row?.[key]);
  return [...rows].sort((a, b) => compareValues(getter(a), getter(b), dir));
}

export function applyPagination(rows, pageState) {
  const total = rows.length;
  const pageSize = Number(pageState.pageSize) || 25;
  const numPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number(pageState.page) || 1), numPages);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  return { pageRows, meta: { total, page, pageSize, numPages, start, end } };
}

export function renderSortableHeader(thEl, key, sortState, onChange) {
  if (!thEl) return;
  const active = sortState.key === key;
  const indicator = active ? (sortState.dir === 'asc' ? '▲' : '▼') : '';
  thEl.innerHTML = '';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'table-sort-btn';
  btn.innerHTML = `${thEl.dataset.label || thEl.textContent}<span class="table-sort-indicator">${indicator}</span>`;
  btn.onclick = () => onChange?.(key);
  thEl.appendChild(btn);
}

export function renderPagination(container, total, page, pageSize, onChange) {
  if (!container) return;
  const numPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), numPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);

  container.innerHTML = `
    <div class="table-pager-left">
      <label>Rows
        <select data-page-size>
          ${[25, 50, 100].map((s) => `<option value="${s}" ${s === pageSize ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </label>
      <span>${start}\u2013${end} of ${total.toLocaleString()}</span>
    </div>
    <div class="table-pager-right">
      <button type="button" data-first>&laquo;</button>
      <button type="button" data-prev>&lsaquo;</button>
      <input type="number" min="1" max="${numPages}" value="${safePage}" data-jump />
      <span>/ ${numPages}</span>
      <button type="button" data-next>&rsaquo;</button>
      <button type="button" data-last>&raquo;</button>
    </div>
  `;

  const clampPage = (next) => Math.min(Math.max(1, next), numPages);
  container.querySelector('[data-page-size]').onchange = (e) => onChange?.({ pageSize: Number(e.target.value), page: 1 });
  container.querySelector('[data-first]').onclick = () => onChange?.({ page: 1 });
  container.querySelector('[data-prev]').onclick = () => onChange?.({ page: clampPage(safePage - 1) });
  container.querySelector('[data-next]').onclick = () => onChange?.({ page: clampPage(safePage + 1) });
  container.querySelector('[data-last]').onclick = () => onChange?.({ page: numPages });
  container.querySelector('[data-jump]').onchange = (e) => onChange?.({ page: clampPage(Number(e.target.value) || 1) });
}
