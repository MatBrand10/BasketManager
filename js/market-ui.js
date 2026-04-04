(() => {
  const getDeps = () => window.AppMarketDeps || {};
  const getState = () => {
    const deps = getDeps();
    return typeof deps.getState === 'function' ? deps.getState() : null;
  };
  const getUI = () => {
    const deps = getDeps();
    return typeof deps.getUI === 'function' ? deps.getUI() : (window.AppUI || {});
  };

  const { t, formatMoney } = window.AppText || {};
  const { computeOvr } = window.GameCore || {};
  const { getScoutingLevel, formatScoutedPotential } = window.Scouting || {};
  const BASE_FREE_AGENT_LIMIT = 18;
  const BASE_DRAFT_LIMIT = 12;
  let freeAgentRenderLimit = null;
  let draftRenderLimit = null;

  const renderFreeAgents = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.freeAgents) return;
    const team = deps.getTeamById(gameState.userTeamId);
    const compactMode = deps.isCompactMode ? deps.isCompactMode() : false;
    const perfMode = deps.isPerformanceMode ? deps.isPerformanceMode() : false;
    const settings = gameState.settings || {};
    if (!gameState.settings) gameState.settings = settings;
    let limit = typeof settings.freeAgentLimit === 'number' ? settings.freeAgentLimit : freeAgentRenderLimit;
    if ((compactMode || perfMode) && gameState.market.freeAgents.length > BASE_FREE_AGENT_LIMIT) {
      if (!limit || limit < 1) {
        limit = BASE_FREE_AGENT_LIMIT;
        settings.freeAgentLimit = limit;
      }
    } else {
      limit = null;
      freeAgentRenderLimit = null;
      if (typeof settings.freeAgentLimit === 'number') settings.freeAgentLimit = null;
    }
    const visible = limit ? gameState.market.freeAgents.slice(0, Math.min(limit, gameState.market.freeAgents.length)) : gameState.market.freeAgents;
    const remaining = gameState.market.freeAgents.length - visible.length;
    const limitControls = remaining > 0 ? `
      <div class="roster-limit">
        <div class="muted">${t ? t('msg_roster_partial', { shown: visible.length, total: gameState.market.freeAgents.length }) : `Mostrando ${visible.length} de ${gameState.market.freeAgents.length}`}</div>
        <div class="row">
          <button class="btn" data-action="fa-show-more">${t ? t('btn_roster_show_more') : 'Mostrar mais'}</button>
          <button class="btn" data-action="fa-show-all">${t ? t('btn_roster_show_all') : 'Mostrar tudo'}</button>
        </div>
      </div>
    ` : '';
    ui.freeAgents.innerHTML = `
      <table class="table">
        <thead>
          <tr><th>${t ? t('th_player') : 'Jogador'}</th><th>${t ? t('th_pos') : 'Pos'}</th><th>${t ? t('th_nationality') : 'Nac'}</th><th>${t ? t('th_ovr') : 'OVR'}</th><th>${t ? t('th_age') : 'Idade'}</th><th>${t ? t('th_salary') : 'Salario'}</th><th></th></tr>
        </thead>
        <tbody>
          ${visible.map((player) => `
            <tr>
              <td>${player.name}</td>
              <td>${player.pos}</td>
              <td>${player.nationality || '-'}</td>
              <td>${computeOvr ? computeOvr(player) : player.ovr}</td>
              <td>${player.age}</td>
              <td>${formatMoney ? formatMoney(player.salary) : player.salary}${player.originLeague ? ` ? ${player.originLeague.toUpperCase()}` : ''}</td>
              <td><button class="btn" data-action="sign" data-id="${player.id}">${t ? t('btn_sign') : 'Assinar'}</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${limitControls}
      <div class="muted">Elenco atual: ${team.roster.length} jogadores.</div>
    `;
  };

  const renderExtensions = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.extensions) return;
    const team = deps.getTeamById(gameState.userTeamId);
    const expiring = team.roster.filter((player) => player.contractYears === 1);
    if (!expiring.length) {
      ui.extensions.innerHTML = `<div class="muted">${t ? t('msg_extension_none') : 'Sem contratos expirando.'}</div>`;
      return;
    }
    const options = expiring.map((player) => `
      <option value="${player.id}" data-salary="${player.salary}">${player.name}  ${player.ovr} OVR  ${formatMoney ? formatMoney(player.salary) : player.salary}</option>
    `).join('');
    const first = expiring[0];
    ui.extensions.innerHTML = `
      <div class="stack">
        <div class="badge">${t ? t('label_extension_offer') : 'Oferta de extensao'}</div>
        <label class="field">
          <span>${t ? t('th_player') : 'Jogador'}</span>
          <select id="ext-player" class="select">${options}</select>
        </label>
        <label class="field">
          <span>${t ? t('label_current_salary') : 'Salario'}</span>
          <input id="ext-salary" class="input" type="number" min="0.5" step="0.1" value="${(first.salary + 0.6).toFixed(1)}" />
        </label>
        <label class="field">
          <span>${t ? t('label_extension_years') : 'Anos'}</span>
          <select id="ext-years" class="select">
            <option value="1">1</option>
            <option value="2" selected>2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </label>
        <label class="field">
          <span>${t ? t('label_option') : 'Opcao'}</span>
          <select id="ext-option" class="select">
            <option value="none">${t ? t('option_none') : 'Sem'}</option>
            <option value="player">${t ? t('option_player') : 'Jogador'}</option>
            <option value="team">${t ? t('option_team') : 'Time'}</option>
          </select>
        </label>
        <button id="btn-extend" class="btn primary">${t ? t('btn_extend') : 'Estender'}</button>
      </div>
    `;
  };

  const renderNegotiation = () => {
    const gameState = getState();
    const ui = getUI();
    if (!gameState || !ui.negotiation) return;
    if (!gameState.market.freeAgents.length) {
      ui.negotiation.innerHTML = '<div class="muted">Sem agentes livres disponíveis.</div>';
      return;
    }
    const options = gameState.market.freeAgents
      .slice(0, 20)
      .map((player) => `<option value="${player.id}">${player.name}  OVR ${computeOvr ? computeOvr(player) : player.ovr}</option>`)
      .join('');
    ui.negotiation.innerHTML = `
      <div class="stack">
        <label class="field">Agente livre
          <select id="neg-player" class="select">${options}</select>
        </label>
        <div class="row">
          <label class="field">Salario (mi)
            <input id="neg-salary" class="input" type="number" min="0.5" step="0.1" value="8.0" />
          </label>
          <label class="field">Anos
            <input id="neg-years" class="input" type="number" min="1" max="4" value="2" />
          </label>
          <label class="field">Opcao
            <select id="neg-option" class="select">
              <option value="none">${t ? t('option_none') : 'Sem'}</option>
              <option value="player">${t ? t('option_player') : 'Jogador'}</option>
              <option value="team">${t ? t('option_team') : 'Time'}</option>
            </select>
          </label>
        </div>
        <button id="btn-offer" class="btn primary">${t ? t('btn_offer') : 'Enviar oferta'}</button>
      </div>
    `;
  };

  const renderTrades = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.trades) return;
    const team = deps.getTeamById(gameState.userTeamId);
    const teams = gameState.teams.filter((t) => t.id !== team.id);
    const teamOptions = teams.map((t) => `<option value="${t.id}">${t.name}</option>`).join('');
    const ownOptions = team.roster.map((p) => `<option value="${p.id}">${p.name}  ${p.pos}  ${p.ovr}</option>`).join('');
    const ownPicks = deps.getPickAssetsForTeam ? deps.getPickAssetsForTeam(team.id, gameState.season) : [];
    const ownPickOptions = ownPicks.map((p) => `<option value="${p.id}">${deps.formatPickLabel(p)}</option>`).join('');

    ui.trades.innerHTML = `
      <div class="grid two">
        <div class="card">
          <div class="badge">${t ? t('label_trade_build') : 'Montar troca'}</div>
          <label class="field">
            <span>${t ? t('label_trade_target_team') : 'Time alvo'}</span>
            <select id="trade-team" class="select">${teamOptions}</select>
          </label>
          <div class="row">
            <label class="field">
              <span>${t ? t('label_trade_send') : 'Enviar'}</span>
              <select id="trade-own" class="select">${ownOptions}</select>
            </label>
            <label class="field">
              <span>+</span>
              <select id="trade-own-2" class="select">${ownOptions}</select>
            </label>
            <label class="field">
              <span>+</span>
              <select id="trade-own-3" class="select">${ownOptions}</select>
            </label>
          </div>
          <div class="row">
            <label class="field">
              <span>${t ? t('label_trade_pick_send') : 'Pick enviar'}</span>
              <select id="trade-pick-own" class="select">
                <option value="">-</option>
                ${ownPickOptions}
              </select>
            </label>
            <label class="field">
              <span>${t ? t('label_trade_cash_hint') : 'Cash'}</span>
              <input id="trade-cash" class="input" type="number" step="0.1" value="0" />
            </label>
          </div>
          <div class="row">
            <label class="field">
              <span>${t ? t('label_trade_receive') : 'Receber'}</span>
              <select id="trade-target" class="select"></select>
            </label>
            <label class="field">
              <span>+</span>
              <select id="trade-target-2" class="select"></select>
            </label>
            <label class="field">
              <span>+</span>
              <select id="trade-target-3" class="select"></select>
            </label>
          </div>
          <label class="field">
            <span>${t ? t('label_trade_pick_receive') : 'Pick receber'}</span>
            <select id="trade-pick-target" class="select"></select>
          </label>
          <div id="trade-preview" class="muted"></div>
          <button id="btn-trade" class="btn primary">${t ? t('btn_trade_send') : 'Enviar troca'}</button>
        </div>
        <div class="card">
          <div class="badge">${t ? t('label_trade_suggestions') : 'Sugestoes'}</div>
          <div id="trade-suggestions"></div>
          <div class="badge">${t ? t('label_trade_inbox') : 'Inbox'}</div>
          <div id="trade-inbox"></div>
        </div>
      </div>
    `;

    const updateTargets = () => {
      const targetTeamId = document.getElementById('trade-team').value;
      const targetTeam = deps.getTeamById(targetTeamId);
      const targetOptions = targetTeam ? targetTeam.roster.map((p) => `<option value="${p.id}">${p.name}  ${p.pos}  ${p.ovr}</option>`).join('') : '';
      const targetPickOptions = targetTeam && deps.getPickAssetsForTeam
        ? deps.getPickAssetsForTeam(targetTeam.id, gameState.season).map((p) => `<option value="${p.id}">${deps.formatPickLabel(p)}</option>`).join('')
        : '';
      document.getElementById('trade-target').innerHTML = targetOptions;
      document.getElementById('trade-target-2').innerHTML = targetOptions;
      document.getElementById('trade-target-3').innerHTML = targetOptions;
      document.getElementById('trade-pick-target').innerHTML = `<option value="">-</option>${targetPickOptions}`;
    };

    const updatePreview = () => {
      const ownId = document.getElementById('trade-own').value;
      const ownId2 = document.getElementById('trade-own-2').value;
      const ownId3 = document.getElementById('trade-own-3').value;
      const ownPickId = document.getElementById('trade-pick-own').value;
      const teamId = document.getElementById('trade-team').value;
      const targetId = document.getElementById('trade-target').value;
      const targetId2 = document.getElementById('trade-target-2').value;
      const targetId3 = document.getElementById('trade-target-3').value;
      const targetPickId = document.getElementById('trade-pick-target').value;
      const cashInput = document.getElementById('trade-cash');
      const cash = cashInput ? parseFloat(cashInput.value || '0') : 0;

      const ownNames = [ownId, ownId2, ownId3]
        .filter(Boolean)
        .map((id) => deps.getPlayerById(team, id))
        .filter(Boolean)
        .map((p) => p.name)
        .join(', ');
      const targetTeam = deps.getTeamById(teamId);
      const targetNames = [targetId, targetId2, targetId3]
        .filter(Boolean)
        .map((id) => deps.getPlayerById(targetTeam, id))
        .filter(Boolean)
        .map((p) => p.name)
        .join(', ');
      const ownPick = ownPickId ? deps.getPickAssetById(ownPickId) : null;
      const targetPick = targetPickId ? deps.getPickAssetById(targetPickId) : null;
      const ownPickLabel = ownPick ? deps.formatPickLabel(ownPick) : '-';
      const targetPickLabel = targetPick ? deps.formatPickLabel(targetPick) : '-';
      const preview = document.getElementById('trade-preview');
      if (!preview) return;
      preview.innerHTML = `
        ${t ? t('label_trade_offer') : 'Envia'}: ${ownNames || '-'} (${ownPickLabel})
        <br />${t ? t('label_trade_receive') : 'Recebe'}: ${targetNames || '-'} (${targetPickLabel})
        <br />Cash: ${cash >= 0 ? `+${cash.toFixed(1)}` : cash.toFixed(1)}
      `;
    };

    const suggestions = deps.buildTradeSuggestions ? deps.buildTradeSuggestions() : [];
    const suggestionsEl = document.getElementById('trade-suggestions');
    if (suggestionsEl) {
      suggestionsEl.innerHTML = suggestions.length
        ? suggestions.map((item) => `
          <div class="row">
            <div class="stack">
              <div><strong>${item.ownName}</strong> ? ${item.teamName}</div>
              <div><strong>${item.targetName}</strong> ? ${t ? t('label_trade_receive') : 'Recebe'}</div>
              <div class="muted">${t ? t('label_trade_cash_hint') : 'Cash'}: ${item.cash >= 0 ? `+${item.cash.toFixed(1)}` : item.cash.toFixed(1)}</div>
            </div>
            <button class="btn" data-action="trade-suggest" data-team="${item.teamId}" data-own="${item.ownId}" data-target="${item.targetId}" data-cash="${item.cash}">
              ${t ? t('btn_trade_suggest') : 'Sugerir'}
            </button>
          </div>
        `).join('')
        : `<div class="muted">${t ? t('msg_trade_no_suggestions') : 'Sem sugestoes.'}</div>`;
    }

    const inboxEl = document.getElementById('trade-inbox');
    if (inboxEl) {
      inboxEl.innerHTML = gameState.tradeInbox.length
        ? gameState.tradeInbox.map((offer) => {
          const fromTeam = deps.getTeamById(offer.fromTeamId);
          const ownNames = offer.requestedIds.map((id) => deps.getPlayerById(team, id)).filter(Boolean).map((p) => p.name).join(', ');
          const targetNames = offer.offeredIds.map((id) => deps.getPlayerById(fromTeam, id)).filter(Boolean).map((p) => p.name).join(', ');
          const ownPicks = (offer.requestedPickIds || []).map((id) => deps.getPickAssetById(id)).filter(Boolean);
          const targetPicks = (offer.offeredPickIds || []).map((id) => deps.getPickAssetById(id)).filter(Boolean);
          const ownPickLabel = ownPicks.length ? ownPicks.map((p) => deps.formatPickLabel(p)).join(', ') : '-';
          const targetPickLabel = targetPicks.length ? targetPicks.map((p) => deps.formatPickLabel(p)).join(', ') : '-';
          return `
            <div class="row">
              <div class="stack">
                <div><strong>${fromTeam ? fromTeam.name : '-'}</strong> ${t ? t('label_trade_offer') : 'Oferta'}</div>
                <div>${t ? t('label_trade_receive') : 'Recebe'}: ${targetNames}</div>
                <div>${t ? t('label_trade_target') : 'Envia'}: ${ownNames}</div>
                <div>${t ? t('label_trade_pick_receive') : 'Picks recebe'}: ${targetPickLabel}</div>
                <div>${t ? t('label_trade_pick_send') : 'Picks envia'}: ${ownPickLabel}</div>
                <div class="muted">${t ? t('label_trade_cash_hint') : 'Cash'}: ${offer.cash >= 0 ? `+${offer.cash.toFixed(1)}` : offer.cash.toFixed(1)}</div>
              </div>
              <div class="stack">
                <button class="btn success" data-action="trade-accept" data-id="${offer.id}">${t ? t('btn_trade_accept') : 'Aceitar'}</button>
                <button class="btn danger" data-action="trade-decline" data-id="${offer.id}">${t ? t('btn_trade_decline') : 'Recusar'}</button>
              </div>
            </div>
          `;
        }).join('')
        : `<div class="muted">${t ? t('msg_trade_no_inbox') : 'Sem ofertas.'}</div>`;
    }

    updateTargets();
    updatePreview();
    document.getElementById('trade-team').addEventListener('change', updateTargets);
    document.getElementById('trade-team').addEventListener('change', updatePreview);
    document.getElementById('trade-own').addEventListener('change', updatePreview);
    document.getElementById('trade-own-2').addEventListener('change', updatePreview);
    document.getElementById('trade-own-3').addEventListener('change', updatePreview);
    document.getElementById('trade-target').addEventListener('change', updatePreview);
    document.getElementById('trade-target-2').addEventListener('change', updatePreview);
    document.getElementById('trade-target-3').addEventListener('change', updatePreview);
    document.getElementById('trade-pick-own').addEventListener('change', updatePreview);
    document.getElementById('trade-pick-target').addEventListener('change', updatePreview);
    document.getElementById('trade-cash').addEventListener('input', updatePreview);
  };

  const renderDraft = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.draft) return;
    if (gameState.phase !== 'offseason') {
      ui.draft.innerHTML = '<div class="muted">Draft disponivel apenas na offseason.</div>';
      return;
    }
    if (!gameState.market.draftPool.length) {
      ui.draft.innerHTML = '<div class="muted">Clique em Gerar Draft para iniciar.</div>';
      return;
    }
    if (!gameState.draftState && gameState.market.draftPool.length) {
      deps.startDraft();
    }
    const draftState = gameState.draftState;
    const draftPool = gameState.market.draftPool;
    const nextPickTeam = draftState ? deps.getTeamById(deps.getDraftTeamForPick(draftState)).name : '-';
    const scoutLevel = getScoutingLevel ? getScoutingLevel(deps.getTeamById(gameState.userTeamId)) : 0;
    const compactMode = deps.isCompactMode ? deps.isCompactMode() : false;
    const perfMode = deps.isPerformanceMode ? deps.isPerformanceMode() : false;
    const settings = gameState.settings || {};
    if (!gameState.settings) gameState.settings = settings;
    let limit = typeof settings.draftLimit === 'number' ? settings.draftLimit : draftRenderLimit;
    if ((compactMode || perfMode) && draftPool.length > BASE_DRAFT_LIMIT) {
      if (!limit || limit < 1) {
        limit = BASE_DRAFT_LIMIT;
        settings.draftLimit = limit;
      }
    } else {
      limit = null;
      draftRenderLimit = null;
      if (typeof settings.draftLimit === 'number') settings.draftLimit = null;
    }
    const visible = limit ? draftPool.slice(0, Math.min(limit, draftPool.length)) : draftPool;
    const remaining = draftPool.length - visible.length;
    const limitControls = remaining > 0 ? `
      <div class="roster-limit">
        <div class="muted">${t ? t('msg_roster_partial', { shown: visible.length, total: draftPool.length }) : `Mostrando ${visible.length} de ${draftPool.length}`}</div>
        <div class="row">
          <button class="btn" data-action="draft-show-more">${t ? t('btn_roster_show_more') : 'Mostrar mais'}</button>
          <button class="btn" data-action="draft-show-all">${t ? t('btn_roster_show_all') : 'Mostrar tudo'}</button>
        </div>
      </div>
    ` : '';
    ui.draft.innerHTML = `
      <div class="stack">
        <div class="badge primary">Rodada ${draftState ? draftState.round : 0} ? Pick ${draftState ? draftState.pick : 0}</div>
        <div>Proximo time: <strong>${nextPickTeam}</strong></div>
      </div>
      <table class="table">
        <thead><tr><th>Prospecto</th><th>Pos</th><th>OVR</th><th>POT</th><th>Perfil</th><th></th></tr></thead>
        <tbody>
          ${visible.map((player) => `
            <tr>
              <td>${player.name}</td>
              <td>${player.pos}</td>
              <td>${computeOvr ? computeOvr(player) : player.ovr}</td>
              <td>${formatScoutedPotential ? formatScoutedPotential(player, scoutLevel) : player.potential}</td>
              <td>${player.archetype}</td>
              <td><button class="btn" data-action="draft" data-id="${player.id}">${t ? t('btn_draft_pick') : 'Draftar'}</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${limitControls}
      <div class="muted">O draft segue duas rodadas com ordem inversa na 2a rodada.</div>
      <div class="stack">
        <div class="badge">Ultimos picks</div>
        ${draftState && draftState.picks.length ? draftState.picks.slice(-5).map((pick) => {
          const teamName = deps.getTeamById(pick.teamId).name;
          return `<div>R${pick.round} P${pick.pick}: ${teamName} escolheu ${pick.playerName}</div>`;
        }).join('') : '<div class="muted">Nenhum pick ainda.</div>'}
      </div>
    `;
  };

  const renderMarket = () => {
    renderFreeAgents();
    renderNegotiation();
    renderTrades();
    renderDraft();
  };

  window.AppMarket = Object.assign(window.AppMarket || {}, {
    renderFreeAgents,
    renderExtensions,
    renderNegotiation,
    renderTrades,
    renderDraft,
    renderMarket
  });
})();

