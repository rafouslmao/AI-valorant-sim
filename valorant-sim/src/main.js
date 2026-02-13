import { getWorld, setWorld } from './core/state.js';
import { ensureRouteGuards, parseHash } from './ui/router.js';
import { loadFromSlot } from './core/storage.js';
import { renderStartPage } from './ui/pages/start.js';
import { renderCareerLayout } from './ui/components/layout.js';
import {
  renderCoachDetail,
  renderFacilities,
  renderFinances,
  renderFreeAgents,
  renderHome,
  renderMatches,
  renderPlayerDetail,
  renderPlayers,
  renderPractice,
  renderRoster,
  renderStaff,
  simulateNextAction,
  simulateWeekAction
} from './ui/pages/career.js';

const app = document.getElementById('app');

function renderCareer(path, params) {
  const state = getWorld() || loadFromSlot();
  if (!state) return;
  setWorld(state);

  const route = path.replace(/^\//, '');
  const tab = ['player', 'coach'].includes(route) ? 'players' : route;

  renderCareerLayout(app, tab, (main) => {
    if (route === 'home') return renderHome(main, state);
    if (route === 'roster') return renderRoster(main, state);
    if (route === 'matches') return renderMatches(main, state);
    if (route === 'players') return renderPlayers(main, state);
    if (route === 'free-agents') return renderFreeAgents(main, state);
    if (route === 'staff') return renderStaff(main, state);
    if (route === 'finances') return renderFinances(main, state);
    if (route === 'practice') return renderPractice(main, state);
    if (route === 'facilities') return renderFacilities(main, state);
    if (route === 'player') return renderPlayerDetail(main, state, params.get('id'));
    if (route === 'coach') return renderCoachDetail(main, state, params.get('id'));
    main.innerHTML = '<h1>Not Found</h1>';
  }, { onSimNext: simulateNextAction, onSimWeek: simulateWeekAction });
}

function renderApp() {
  if (!ensureRouteGuards()) return;
  const { path, params } = parseHash();
  if (path === '/start') return renderStartPage(app);
  renderCareer(path, params);
}

window.addEventListener('hashchange', renderApp);
renderApp();
