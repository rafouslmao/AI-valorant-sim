import { applyPagination, applySort, createTableState, renderPagination, renderSortableHeader } from './tableUtils.js';

export function createSortState(defaultKey, defaultDir = 'desc') {
  return { key: defaultKey, dir: defaultDir };
}

export function paginate(rows, pageState) {
  return applyPagination(rows, pageState);
}

export { applySort, renderSortableHeader, renderPagination, createTableState };
