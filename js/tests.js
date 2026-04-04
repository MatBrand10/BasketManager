(() => {
  const runTests = () => {
    const results = [];
    const push = (name, ok, detail = '') => {
      results.push({ name, ok, detail });
    };

    const manifest = document.querySelector('link[rel="manifest"]');
    push('manifest-presente', !!manifest, manifest ? 'ok' : 'link ausente');

    const tabs = document.querySelectorAll('.tabs .tab');
    push('tabs', tabs.length >= 5, `tabs=${tabs.length}`);

    const views = document.querySelectorAll('.view');
    push('views', views.length >= 5, `views=${views.length}`);

    const tabsWithRole = [...document.querySelectorAll('.tabs .tab')].every((tab) => tab.getAttribute('role') === 'tab');
    push('tabs-role', tabsWithRole, tabsWithRole ? 'ok' : 'falta role');

    const perfPanel = document.getElementById('performance-panel');
    push('performance-panel', !!perfPanel, perfPanel ? 'ok' : 'ausente');

    const swSupported = 'serviceWorker' in navigator;
    push('service-worker-suporte', swSupported, swSupported ? 'ok' : 'nao suportado');

    const perfToggle = document.getElementById('performance-mode');
    push('performance-toggle', !!perfToggle, perfToggle ? 'ok' : 'ausente');

    const btnRunTests = document.getElementById('btn-run-tests');
    push('btn-run-tests', !!btnRunTests, btnRunTests ? 'ok' : 'ausente');

    const musicPlaylist = document.getElementById('music-playlist');
    push('music-playlist', !!musicPlaylist, musicPlaylist ? 'ok' : 'ausente');

    const ambientToggle = document.getElementById('ambient-toggle');
    push('ambient-toggle', !!ambientToggle, ambientToggle ? 'ok' : 'ausente');

    const worldPlayoffs = document.getElementById('world-playoffs');
    push('world-playoffs', !!worldPlayoffs, worldPlayoffs ? 'ok' : 'ausente');

    const i18nMissing = [];
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const text = typeof window.t === 'function' ? window.t(key) : key;
      if (!text || text === key) i18nMissing.push(key);
    });
    push('i18n-keys', i18nMissing.length === 0, i18nMissing.length ? `faltando=${i18nMissing.length}` : 'ok');

    push('debug-log', typeof window.getDebugLog === 'function', typeof window.getDebugLog === 'function' ? 'ok' : 'ausente');

    const state = typeof window.getGameState === 'function' ? window.getGameState() : null;
    if (state) {
      push('state-league', !!(state.league && state.league.id), state.league ? state.league.id : 'ausente');
      push('state-teams', Array.isArray(state.teams) && state.teams.length > 0, `times=${state.teams ? state.teams.length : 0}`);
      push('state-schedule', Array.isArray(state.schedule) && state.schedule.length > 0, `jogos=${state.schedule ? state.schedule.length : 0}`);
      const badGames = (state.schedule || []).filter((g) => !g.home || !g.away || g.home === g.away);
      push('schedule-valid', badGames.length === 0, badGames.length ? `invalidos=${badGames.length}` : 'ok');
      const rosterIssues = (state.teams || []).filter((team) => !team.roster || team.roster.length < 8 || team.roster.length > 15);
      push('rosters-limite', rosterIssues.length === 0, rosterIssues.length ? `fora=${rosterIssues.length}` : 'ok');
      push('market-free-agents', Array.isArray(state.market && state.market.freeAgents), state.market ? `FA=${state.market.freeAgents.length}` : 'ausente');
      push('draft-pool', Array.isArray(state.market && state.market.draftPool), state.market ? `draft=${state.market.draftPool.length}` : 'ausente');
      push('trade-inbox', Array.isArray(state.tradeInbox), `inbox=${state.tradeInbox ? state.tradeInbox.length : 0}`);
      push('trade-history', Array.isArray(state.tradeHistory), `hist=${state.tradeHistory ? state.tradeHistory.length : 0}`);
    } else {
      push('state-carregado', false, 'sem jogo carregado');
    }

    if (typeof window.runDiagnostics === 'function') {
      const diag = window.runDiagnostics();
      if (diag && diag.ok) {
        push('diagnostico', true, 'ok');
      } else if (diag && diag.issues) {
        push('diagnostico', false, diag.issues.join(' | '));
      } else {
        push('diagnostico', false, 'nao executado');
      }
    } else {
      push('diagnostico', false, 'funcao ausente');
    }

    if (typeof window.runSimulationSmokeTest === 'function') {
      const sim = window.runSimulationSmokeTest();
      push('simulacao-smoke', !!(sim && sim.ok), sim && sim.error ? sim.error : 'ok');
    } else {
      push('simulacao-smoke', false, 'funcao ausente');
    }

    const okCount = results.filter((r) => r.ok).length;
    const summary = `${okCount}/${results.length} ok`;
    console.table(results);
    console.log(`Tests: ${summary}`);
    return { summary, results };
  };

  window.runTests = runTests;
})();
