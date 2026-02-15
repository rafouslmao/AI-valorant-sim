import { getWorld, hydrateWorldFromStorage, setWorld } from './core/state.js';
import { ensureRouteGuards, parseHash } from './ui/router.js';
import { renderStartPage } from './ui/pages/start.js';
import { renderCareerLayout } from './ui/components/layout.js';
import { renderMessages } from './ui/pages/messages.js';
import {
  getLayoutBadges,
  renderCoachDetail,
  renderFacilities,
  renderFinances,
  renderFreeAgents,
  renderHome,
  renderMatches,
  renderSchedule,
  renderMatchView,
  renderPlayerDetail,
  renderPlayers,
  renderStats,
  renderTeamDetail,
  renderTeams,
  renderPractice,
  renderRoster,
  renderSponsors,
  renderStaff,
  renderStrategy,
  renderGodMode,
  simulateNextAction,
  simulateWeekAction,
  simulateTournamentAction
} from './ui/pages/career.js';

const app = document.getElementById('app');

const bootState = {
  initStarted: false,
  initDone: false,
  initError: null
};

function showErrorPanel(errorLike) {
  const err = errorLike instanceof Error ? errorLike : new Error(String(errorLike || 'Unknown error'));
  console.error(err);
  if (!app) return;
  const stack = err.stack || '(no stack)';
  app.innerHTML = `<div class="start-screen"><section class="card"><h1>Application Error</h1><p class="error">${err.message}</p><pre>${stack}</pre></section></div>`;
}

window.addEventListener('error', (event) => {
  showErrorPanel(event.error || event.message || 'Unhandled window error');
});
window.addEventListener('unhandledrejection', (event) => {
  showErrorPanel(event.reason || 'Unhandled promise rejection');
});

function renderCareerLoading(path) {
  const route = path.replace(/^\//, '') || 'home';
  const tab = ['player', 'coach'].includes(route) ? 'players' : ['team'].includes(route) ? 'teams' : route;
  renderCareerLayout(app, tab, (main) => {
    main.innerHTML = '<h1>Loading…</h1><p>Initializing save storage and loading your career.</p>';
  }, { onSimNext: simulateNextAction, onSimWeek: simulateWeekAction, onSimTournament: simulateTournamentAction }, {});
}

async function renderCareer(path, params) {
  const state = getWorld();
  if (!state) {
    renderCareerLoading(path);
    return;
  }

  const route = path.replace(/^\//, '');
  const tab = ['player', 'coach'].includes(route) ? 'players' : ['team'].includes(route) ? 'teams' : route;

  renderCareerLayout(app, tab, (main) => {
    if (route === 'home') return renderHome(main, state);
    if (route === 'roster') return renderRoster(main, state);
    if (route === 'schedule') return renderSchedule(main, state);
    if (route === 'matches') return renderMatches(main, state);
    if (route === 'match') return renderMatchView(main, state, params.get('id'));
    if (route === 'strategy') return renderStrategy(main, state);
    if (route === 'sponsors') return renderSponsors(main, state);
    if (route === 'messages') return renderMessages(main, state);
    if (route === 'teams') return renderTeams(main, state);
    if (route === 'team') return renderTeamDetail(main, state, params.get('id'));
    if (route === 'players') return renderPlayers(main, state);
    if (route === 'stats') return renderStats(main, state);
    if (route === 'free-agents') return renderFreeAgents(main, state);
    if (route === 'staff') return renderStaff(main, state);
    if (route === 'finances') return renderFinances(main, state);
    if (route === 'practice') return renderPractice(main, state);
    if (route === 'facilities') return renderFacilities(main, state);
    if (route === 'player') return renderPlayerDetail(main, state, params.get('id'));
    if (route === 'coach') return renderCoachDetail(main, state, params.get('id'));
    if (route === 'god-mode') return renderGodMode(main, state);
    main.innerHTML = '<h1>Not Found</h1>';
  }, { onSimNext: simulateNextAction, onSimWeek: simulateWeekAction, onSimTournament: simulateTournamentAction }, getLayoutBadges(state));
}

async function initAsync() {
  if (bootState.initStarted) return;
  bootState.initStarted = true;
  try {
    const state = await hydrateWorldFromStorage();
    if (state) setWorld(state);
    bootState.initDone = true;
    bootState.initError = null;
  } catch (error) {
    bootState.initError = error;
    showErrorPanel(error);
  }
  route();
}

async function route() {
  try {
    if (!ensureRouteGuards()) return;
    const { path, params } = parseHash();

    if (path === '/start') {
      await renderStartPage(app);
      return;
    }

    if (!bootState.initDone) {
      renderCareerLoading(path);
      initAsync();
      return;
    }

    if (bootState.initError) {
      showErrorPanel(bootState.initError);
      return;
    }

    await renderCareer(path, params);
  } catch (error) {
    showErrorPanel(error);
  }
}

window.addEventListener('hashchange', () => { route(); });
route();
