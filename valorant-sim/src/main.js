import { getWorld, setWorld } from './core/state.js';
import { ensureRouteGuards, parseHash } from './ui/router.js';
import { loadFromSlot } from './core/storage.js';
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
  simulateNextAction,
  simulateWeekAction,
  simulateTournamentAction
} from './ui/pages/career.js';

const app = document.getElementById('app');

function renderCareer(path, params) {
  const state = getWorld() || loadFromSlot();
  if (!state) return;
  setWorld(state);

  const route = path.replace(/^\//, '');
  const tab = ['player', 'coach'].includes(route) ? 'players' : ['team'].includes(route) ? 'teams' : route;

  renderCareerLayout(app, tab, (main) => {
    if (route === 'home') return renderHome(main, state);
    if (route === 'roster') return renderRoster(main, state);
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
    main.innerHTML = '<h1>Not Found</h1>';
  }, { onSimNext: simulateNextAction, onSimWeek: simulateWeekAction, onSimTournament: simulateTournamentAction }, getLayoutBadges(state));
}

function renderApp() {
  if (!ensureRouteGuards()) return;
  const { path, params } = parseHash();
  if (path === '/start') return renderStartPage(app);
  renderCareer(path, params);
}

window.addEventListener('hashchange', renderApp);
renderApp();
