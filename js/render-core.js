

(() => {
  let selectedTacticsPlayerId = null;

  const getDeps = () => window.AppRenderDeps || {};
  const getState = () => {
    const deps = getDeps();
    return typeof deps.getState === 'function' ? deps.getState() : null;
  };
  const getUI = () => {
    const deps = getDeps();
    return typeof deps.getUI === 'function' ? deps.getUI() : (window.AppUI || {});
  };

  const { t, formatMoney } = window.AppText || {};
  const { getTeamLogoText, buildTeamLogoHTML, applyThemeFromTeam } = window.Theme || {};
  const { estimatePossessions, formatPct } = window.StatsUtils || {};

  const {
    getScoutingLevel,
    getScoutedPotentialEstimate,
    formatScoutedPotential,
    getVisiblePotentialMax,
    getRiskLabel,
    getProjectionLabel,
    getRecommendationLabel
  } = window.Scouting || {};

  const { getPotentialMax, computeOvr } = window.GameCore || {};

  const formatAwardLabel = (award) => {
    if (!award) return '-';
    if (award.includes('MVP')) return t ? t('label_mvp') : award;
    if (award.includes('Finals')) return t ? t('label_finals_mvp') : award;
    if (award.includes('ROY')) return t ? t('label_roy') : award;
    if (award.includes('DPOY')) return t ? t('label_dpoy') : award;
    if (award.includes('Scorer')) return t ? t('label_scorer') : award;
    return award;
  };

  const getGrowthStage = (player) => {
    if (!player) return '-';
    if (player.age <= 22) return t ? t('label_growth_early') : 'Inicio';
    if (player.age <= 28) return t ? t('label_growth_prime') : 'Prime';
    if (player.age <= 32) return t ? t('label_growth_late') : 'Pico';
    return t ? t('label_growth_decline') : 'Queda';
  };

  const getPotentialProgress = (player, maxOverride = null) => {
    if (!player) return 0;
    const max = typeof maxOverride === 'number' ? maxOverride : (getPotentialMax ? getPotentialMax(player) : player.potential || player.ovr);
    const diff = max - player.ovr;
    if (diff <= 0) return 100;
    const progress = Math.round((player.ovr / Math.max(max, 1)) * 100);
    return Math.min(100, Math.max(0, progress));
  };


  const renderSummary = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.summary) return;
    const team = deps.getTeamById(gameState.userTeamId);
    if (applyThemeFromTeam) applyThemeFromTeam(team);
    const teamOvr = deps.computeTeamOvr(team);
    const logoText = getTeamLogoText ? getTeamLogoText(team.city, team.nickname) : '';
    const colors = team.colors ? [team.colors.primary, team.colors.secondary] : TEAM_COLOR_PALETTE[0];
    ui.summary.innerHTML = `
      <div class="stack">
        <div class="team-banner">${buildTeamLogoHTML ? buildTeamLogoHTML(logoText, colors, true) : ''} ${team.city}  ${team.nickname}</div>
        <div class="badge primary">Temporada ${gameState.season}/${MAX_SEASONS}  Dia ${gameState.day}</div>
        <div><strong>${team.name}</strong> (${team.conf})</div>
        <div>Campanha: ${team.wins}V - ${team.losses}D</div>
        <div>OVR do time: ${teamOvr}</div>
        <div>Orcamento: ${formatMoney ? formatMoney(team.budget) : team.budget}</div>
        <div class="muted">GM: ${gameState.managerName || 'GM'}</div>
        <div class="muted">${t ? t('label_coach') : 'Coach'}: ${team.coach}</div>
        <div class="muted">${t ? t('label_league') : 'Liga'}: ${gameState.league ? gameState.league.name : '-'}</div>
        <div class="muted">Fase: ${gameState.phase}</div>
      </div>
    `;
  };

  const renderNextGame = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.nextGame) return;
    if (ui.btnAdvanceSeason) ui.btnAdvanceSeason.disabled = gameState.phase !== 'offseason';
    if (ui.btnSimNext) ui.btnSimNext.disabled = gameState.phase === 'offseason' || gameState.phase === 'retired';
    if (ui.btnSimWeek) ui.btnSimWeek.disabled = gameState.phase === 'offseason' || gameState.phase === 'retired';
    if (gameState.phase === 'retired') {
      ui.nextGame.innerHTML = `<div class="muted">${t ? t('msg_retired_view') : 'Carreira encerrada.'}</div>`;
      return;
    }
    if (gameState.phase === 'offseason') {
      ui.nextGame.innerHTML = `<div class="muted">${t ? t('msg_offseason_view') : 'Offseason em andamento.'}</div>`;
      return;
    }
    const next = deps.getNextUserGame();
    if (!next) {
      ui.nextGame.innerHTML = `<div class="muted">${t ? t('msg_no_games') : 'Sem jogos futuros.'}</div>`;
      return;
    }
    const home = deps.getTeamById(next.home).name;
    const away = deps.getTeamById(next.away).name;
    ui.nextGame.innerHTML = `
      <div class="stack">
        <div class="badge">${t ? t('label_round') : 'Rodada'} ${next.day + 1}</div>
        <div><strong>${home}</strong> x <strong>${away}</strong></div>
      </div>
    `;
  };

  const renderStandings = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.standings) return;
    const standings = deps.getStandings();
    if (!standings) return;
    const build = (conf) => `
      <table class="table">
        <thead><tr><th>${conf}</th><th>V</th><th>D</th><th>OVR</th></tr></thead>
        <tbody>
          ${standings[conf].map((team) => `
            <tr>
              <td>${team.name}</td>
              <td>${team.wins}</td>
              <td>${team.losses}</td>
              <td>${team.ovr}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    if (standings.Unica) {
      ui.standings.innerHTML = build('Unica');
    } else {
      ui.standings.innerHTML = `${build('Leste')}${build('Oeste')}`;
    }
  };

  const renderObjectives = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.objectives) return;
    const obj = gameState.objectives;
    if (!obj) {
      ui.objectives.innerHTML = '<div class="muted">Sem objetivos definidos.</div>';
      return;
    }
    const team = deps.getTeamById(gameState.userTeamId);
    ui.objectives.innerHTML = `
      <div class="stack">
        <div class="badge accent">Vitórias: ${team.wins}/${obj.targetWins}</div>
        <div>${obj.reachPlayoffs ? 'Chegar aos playoffs' : 'Desenvolver o elenco'}</div>
        <div>Orcamento: ${formatMoney ? formatMoney(team.budget) : team.budget} / ${formatMoney ? formatMoney(obj.targetBudget) : obj.targetBudget}</div>
      </div>
    `;
  };

  const renderMessages = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.messages) return;
    const compactMode = deps.isCompactMode ? deps.isCompactMode() : false;
    const perfMode = deps.isPerformanceMode ? deps.isPerformanceMode() : false;
    const limit = (compactMode || perfMode) ? 20 : 40;
    const visible = gameState.messages.slice(0, limit);
    const remaining = gameState.messages.length - visible.length;
    ui.messages.innerHTML = `
      ${remaining > 0 ? `<div class="muted">${t ? t('msg_roster_partial', { shown: visible.length, total: gameState.messages.length }) : `Mostrando ${visible.length} de ${gameState.messages.length}`}</div>` : ''}
      ${visible.map((msg) => `<div>${msg}</div>`).join('')}
    `;
  };

  const renderHealth = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.health) return;
    const team = deps.getTeamById(gameState.userTeamId);
    const injured = team.roster.filter((p) => p.injuryDays > 0);
    const tired = team.roster.filter((p) => p.energy < 50 && p.injuryDays === 0).sort((a, b) => a.energy - b.energy);
    ui.health.innerHTML = `
      <div class="stack">
        <div><strong>Lesionados</strong></div>
        ${injured.length ? injured.map((p) => `<div>${p.name}  ${p.injuryDays} dias</div>`).join('') : '<div class="muted">Nenhuma lesao ativa.</div>'}
        <div><strong>Fadiga</strong></div>
        ${tired.length ? tired.slice(0, 5).map((p) => `<div>${p.name}  Energia ${p.energy}</div>`).join('') : '<div class="muted">Elenco descansado.</div>'}
      </div>
    `;
  };

  const renderSeasonLeaders = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.seasonLeaders) return;
    const players = [];
    gameState.teams.forEach((team) => {
      team.roster.forEach((player) => {
        if (player.seasonStats && player.seasonStats.gp > 0) {
          players.push({ ...player, teamId: team.id });
        }
      });
    });
    if (!players.length) {
      ui.seasonLeaders.innerHTML = `<div class="muted">${t ? t('msg_no_leaders') : 'Sem lideres.'}</div>`;
      return;
    }
    const build = (key, label) => {
      const list = players
        .map((player) => ({
          name: player.name,
          team: deps.getTeamById(player.teamId).name,
          value: (player.seasonStats[key] / Math.max(1, player.seasonStats.gp))
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      return `
        <div class="stack">
          <div class="badge">${label}</div>
          ${list.map((item) => `<div>${item.name}  ${item.team}  ${item.value.toFixed(1)}</div>`).join('')}
        </div>
      `;
    };
    ui.seasonLeaders.innerHTML = `
      <div class="row">
        ${build('pts', t ? t('label_points') : 'PTS')}
        ${build('reb', t ? t('label_rebounds') : 'REB')}
        ${build('ast', t ? t('label_assists') : 'AST')}
        ${build('fouls', t ? t('label_fouls') : 'F')}
      </div>
    `;
  };

  const renderMinutesPanel = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.minutesPanel) return;
    const team = deps.getTeamById(gameState.userTeamId);
    const list = team.roster
      .filter((player) => player.seasonStats && player.seasonStats.gp > 0)
      .map((player) => ({
        name: player.name,
        pos: player.pos,
        mpg: player.seasonStats.min / Math.max(1, player.seasonStats.gp)
      }))
      .sort((a, b) => b.mpg - a.mpg)
      .slice(0, 8);
    if (!list.length) {
      ui.minutesPanel.innerHTML = `<div class="muted">${t ? t('msg_no_minutes') : 'Sem minutos.'}</div>`;
      return;
    }
    ui.minutesPanel.innerHTML = `
      <div class="stack">
        ${list.map((item) => `<div>${item.name}  ${item.pos}  ${item.mpg.toFixed(1)} ${t ? t('label_mpg') : 'mpg'}</div>`).join('')}
      </div>
    `;
  };

  const renderSeasonRecap = () => {
    const gameState = getState();
    const ui = getUI();
    if (!gameState || !ui.seasonRecap) return;
    const recap = gameState.seasonRecaps && gameState.seasonRecaps[0];
    if (!recap) {
      ui.seasonRecap.innerHTML = `<div class="muted">${t ? t('msg_no_recap') : 'Sem recap.'}</div>`;
      return;
    }
    ui.seasonRecap.innerHTML = `
      <div class="stack">
        <div class="badge primary">${t ? t('label_season') : 'Temporada'} ${recap.season}  ${recap.league}</div>
        <div>${t ? t('label_champion') : 'Campeao'}: ${recap.champion || '-'}</div>
        <div>${t ? t('label_user_record') : 'Campanha'}: ${recap.user.wins}V-${recap.user.losses}D${recap.user.seed ? `  ${t('label_seed')} ${recap.user.seed}` : ''}</div>
        <div>${t ? t('label_finals_mvp') : 'MVP Finais'}: ${recap.finalsMvp || '-'}</div>
        <div class="badge">${t ? t('label_top_players') : 'Top jogadores'}</div>
        ${recap.topPlayers && recap.topPlayers.length
          ? recap.topPlayers.map((p) => `<div>${p.name}  ${p.team}  ${p.ovr} OVR  ${p.archetype}</div>`).join('')
          : '<div class="muted">-</div>'}
        <div class="badge">${t ? t('label_all_team') : 'All Team'}</div>
        ${recap.allTeam && recap.allTeam.length
          ? recap.allTeam.map((p) => `<div>${p.pos}  ${p.name}  ${p.team}  ${p.ovr} OVR</div>`).join('')
          : '<div class="muted">-</div>'}
        <div class="badge">${t ? t('h_awards') : 'Premios'}</div>
        <div>${t ? t('label_mvp') : 'MVP'}: ${recap.awards ? recap.awards.mvp : '-'}</div>
        <div>${t ? t('label_dpoy') : 'DPOY'}: ${recap.awards ? recap.awards.dpoy : '-'}</div>
        <div>${t ? t('label_roy') : 'ROY'}: ${recap.awards ? recap.awards.roy : '-'}</div>
        <div>${t ? t('label_scorer') : 'Cestinha'}: ${recap.awards ? recap.awards.scorer : '-'}</div>
      </div>
    `;
  };


  const renderRoster = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.rosterTable) return;
    const team = deps.getTeamById(gameState.userTeamId);
    const scoutLevel = getScoutingLevel ? getScoutingLevel(team) : 0;
    const sortMode = gameState.settings ? gameState.settings.rosterSort : 'ovr';
    const filterPos = gameState.settings ? gameState.settings.rosterFilter : 'all';
    if (ui.rosterSort) ui.rosterSort.value = sortMode;
    if (ui.rosterFilter) ui.rosterFilter.value = filterPos;
    const filtered = filterPos === 'all'
      ? [...team.roster]
      : team.roster.filter((player) => (
        player.pos === filterPos
        || (player.secondaryPos && player.secondaryPos.includes(filterPos))
      ));
    const sorters = {
      ovr: (a, b) => b.ovr - a.ovr,
      age: (a, b) => a.age - b.age,
      potential: (a, b) => (getPotentialMax ? getPotentialMax(b) : b.potential) - (getPotentialMax ? getPotentialMax(a) : a.potential),
      salary: (a, b) => b.salary - a.salary,
      morale: (a, b) => (b.morale || 70) - (a.morale || 70)
    };
    const rows = filtered
      .sort((a, b) => (sorters[sortMode] ? sorters[sortMode](a, b) : b.ovr - a.ovr));

    const compactMode = deps.isCompactMode ? deps.isCompactMode() : false;
    const perfMode = deps.isPerformanceMode ? deps.isPerformanceMode() : false;
    const pageSize = deps.getRosterPageSize ? deps.getRosterPageSize() : 24;
    let limit = deps.getRosterRenderLimit ? deps.getRosterRenderLimit() : null;
    if ((compactMode || perfMode) && rows.length > pageSize) {
      if (!limit || limit < 1) {
        limit = pageSize;
        if (deps.setRosterRenderLimit) deps.setRosterRenderLimit(limit);
      }
    } else {
      if (deps.setRosterRenderLimit) deps.setRosterRenderLimit(null);
      limit = null;
    }
    const visibleRows = limit ? rows.slice(0, Math.min(limit, rows.length)) : rows;
    const remaining = rows.length - visibleRows.length;

    const rowHtml = visibleRows
      .map((player) => {
        const isStarter = team.rotation.starters.includes(player.id);
        const traitLabel = player.traits && player.traits.length
          ? player.traits.join(', ')
          : '-';
        const secondaryLabel = player.secondaryPos && player.secondaryPos.length
          ? player.secondaryPos.join('/')
          : '-';
        const scouted = scoutLevel <= 1 || !getScoutedPotentialEstimate ? '??' : getScoutedPotentialEstimate(player, scoutLevel).estimate;
        const potMaxLabel = getVisiblePotentialMax ? getVisiblePotentialMax(player, scoutLevel) : '-';
        const awardsList = player.awards && player.awards.length
          ? player.awards.map((award) => formatAwardLabel(award))
          : [];
        const awardsLabel = awardsList.length
          ? `${awardsList.length}  ${awardsList[0]}`
          : '-';
        const awardsTitle = awardsList.length ? awardsList.join(' | ') : '';
        return `
          <tr>
            <td>${player.starLevel >= 3 ? '? ' : ''}${player.name}</td>
            <td>${player.pos}</td>
            <td>${secondaryLabel}</td>
            <td>${player.nationality || '-'}</td>
            <td>${player.age}</td>
            <td>${player.ovr}</td>
            <td>${player.attack}</td>
            <td>${player.defense}</td>
            <td>${player.physical}</td>
            <td>${player.shooting}</td>
            <td>${player.passing}</td>
            <td>${scouted} / ${potMaxLabel}</td>
            <td>${player.archetype}</td>
            <td>${player.role}</td>
            <td>${traitLabel}</td>
            <td title="${awardsTitle}">${awardsLabel}</td>
            <td>${player.energy}</td>
            <td>${player.injuryDays > 0 ? `${player.injuryDays}d` : '-'}</td>
            <td>${formatMoney ? formatMoney(player.salary) : player.salary}</td>
            <td>${player.contractYears} ${t ? t('label_years') : 'anos'}</td>
            <td>${player.morale || 70}</td>
            <td>
              <button class="btn ${isStarter ? 'success' : ''}" data-action="toggle-starter" data-id="${player.id}">
                ${isStarter ? 'Titular' : 'Reserva'}
              </button>
            </td>
            <td>
              <button class="btn danger" data-action="release" data-id="${player.id}">Dispensar</button>
            </td>
          </tr>
        `;
      })
      .join('');

    const limitControls = remaining > 0 ? `
      <div class="roster-limit">
        <div class="muted">${t ? t('msg_roster_partial', { shown: visibleRows.length, total: rows.length }) : `Mostrando ${visibleRows.length} de ${rows.length}`}</div>
        <div class="row">
          <button class="btn" data-action="roster-show-more">${t ? t('btn_roster_show_more') : 'Mostrar mais'}</button>
          <button class="btn" data-action="roster-show-all">${t ? t('btn_roster_show_all') : 'Mostrar tudo'}</button>
        </div>
      </div>
    ` : '';

    ui.rosterTable.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>${t ? t('th_player') : 'Jogador'}</th><th>${t ? t('th_pos') : 'Pos'}</th><th>${t ? t('th_secondary_pos') : 'Sec'}</th><th>${t ? t('th_nationality') : 'Nac'}</th><th>${t ? t('th_age') : 'Idade'}</th><th>${t ? t('th_ovr') : 'OVR'}</th>
            <th>${t ? t('th_attack') : 'ATK'}</th><th>${t ? t('th_defense') : 'DEF'}</th><th>${t ? t('th_physical') : 'FIS'}</th><th>${t ? t('th_shooting') : 'AR'}</th><th>${t ? t('th_passing') : 'PAS'}</th>
            <th>${t ? t('th_potential') : 'POT'}</th><th>${t ? t('th_profile') : 'Perfil'}</th><th>${t ? t('th_role') : 'Role'}</th><th>${t ? t('th_traits') : 'Traits'}</th><th>${t ? t('th_awards') : 'Premios'}</th><th>${t ? t('th_energy') : 'Energia'}</th><th>${t ? t('th_injury') : 'Lesao'}</th><th>${t ? t('th_salary') : 'Salario'}</th><th>${t ? t('th_contract') : 'Contrato'}</th><th>${t ? t('th_morale') : 'Moral'}</th><th>${t ? t('th_rotation') : 'Rotacao'}</th><th></th>
          </tr>
        </thead>
        <tbody>${rowHtml}</tbody>
      </table>
      ${limitControls}
    `;
  };

  const renderTactics = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.formationOptions || !ui.strategyOptions) return;
    const team = deps.getTeamById(gameState.userTeamId);
    ui.formationOptions.innerHTML = FORMATIONS.map((item) => `
      <label class="badge ${team.tactics.formation === item.id ? 'primary' : ''}">
        <input type="radio" name="formation" value="${item.id}" ${team.tactics.formation === item.id ? 'checked' : ''} />
        ${item.label}
      </label>
    `).join('');

    ui.strategyOptions.innerHTML = STRATEGIES.map((item) => `
      <label class="badge ${team.tactics.strategy === item.id ? 'accent' : ''}">
        <input type="radio" name="strategy" value="${item.id}" ${team.tactics.strategy === item.id ? 'checked' : ''} />
        ${item.label}
      </label>
    `).join('');
  };

  const renderRotation = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.rotation) return;
    const team = deps.getTeamById(gameState.userTeamId);
    deps.ensureRotationSlots(team);
    const slots = team.rotation.slots || {};
    const starters = POSITION_SLOTS
      .map((pos) => ({
        pos,
        player: team.roster.find((p) => p.id === slots[pos])
      }))
      .filter((item) => item.player);
    const bench = team.roster.filter((p) => !team.rotation.starters.includes(p.id));
    const list = (players) => players.map((item) => {
      if (item.player) {
        return `<div class="badge">${item.pos}: ${item.player.name}</div>`;
      }
      return `<div class="badge">${item.name} (${item.pos})</div>`;
    }).join('');

    ui.rotation.innerHTML = `
      <div class="stack">
        <div><strong>Titulares</strong></div>
        <div>${list(starters)}</div>
        <div><strong>Reservas</strong></div>
        <div>${list(bench)}</div>
      </div>
    `;
  };

  const renderPlayerChip = (player, slotPos = null, fitClass = '', fitLabel = '', fitScore = 1, isSelected = false) => {
    const secondary = player.secondaryPos && player.secondaryPos.length ? ` / ${player.secondaryPos.join('/')}` : '';
    const fitTag = slotPos ? `<small class="fit-tag">${fitLabel}</small>` : '';
    const modifier = slotPos ? `<small>${t ? t('label_fit_multiplier') : 'Fit'}: ${(fitScore * 100).toFixed(0)}%</small>` : '';
    return `
      <div class="player-chip ${fitClass} ${isSelected ? 'selected' : ''}" draggable="true" data-player-id="${player.id}">
        <strong>${player.name}</strong>
        <small>${player.pos}${secondary}  ${player.ovr} OVR</small>
        ${fitTag}
        ${modifier}
      </div>
    `;
  };

  const handleDropToSlot = (slot, playerId) => {
    const gameState = getState();
    const deps = getDeps();
    if (!gameState) return;
    const team = deps.getTeamById(gameState.userTeamId);
    deps.ensureRotationSlots(team);
    const slots = team.rotation.slots || {};
    if (slot === 'bench') {
      Object.keys(slots).forEach((pos) => {
        if (slots[pos] === playerId) delete slots[pos];
      });
    } else {
      Object.keys(slots).forEach((pos) => {
        if (slots[pos] === playerId) delete slots[pos];
      });
      if (slots[slot] && slots[slot] !== playerId) {
        delete slots[slot];
      }
      slots[slot] = playerId;
    }
    deps.ensureRotation(team);
    renderRotation();
    renderTacticsBoard();
  };

  const clearTacticsSelection = () => {
    selectedTacticsPlayerId = null;
  };

  const toggleTacticsSelection = (playerId) => {
    selectedTacticsPlayerId = selectedTacticsPlayerId === playerId ? null : playerId;
    renderTacticsBoard();
  };

  const attachTacticsDrag = () => {
    const ui = getUI();
    if (!ui.tacticsBoard || !ui.benchBoard) return;
    const chips = [
      ...ui.tacticsBoard.querySelectorAll('.player-chip'),
      ...ui.benchBoard.querySelectorAll('.player-chip')
    ];
    chips.forEach((chip) => {
      chip.ondragstart = (event) => {
        chip.classList.add('dragging');
        event.dataTransfer.setData('text/plain', chip.dataset.playerId);
      };
      chip.ondragend = () => {
        chip.classList.remove('dragging');
      };
      chip.onclick = (event) => {
        event.stopPropagation();
        toggleTacticsSelection(chip.dataset.playerId);
      };
    });
    const drops = ui.tacticsBoard.querySelectorAll('.slot-drop');
    drops.forEach((drop) => {
      drop.ondragover = (event) => {
        event.preventDefault();
        drop.classList.add('hover');
      };
      drop.ondragleave = () => {
        drop.classList.remove('hover');
      };
      drop.ondrop = (event) => {
        event.preventDefault();
        drop.classList.remove('hover');
        const playerId = event.dataTransfer.getData('text/plain');
        if (playerId) handleDropToSlot(drop.dataset.slot, playerId);
      };
      drop.onclick = () => {
        if (!selectedTacticsPlayerId) return;
        handleDropToSlot(drop.dataset.slot, selectedTacticsPlayerId);
        clearTacticsSelection();
        renderTacticsBoard();
      };
    });
    ui.benchBoard.ondragover = (event) => {
      event.preventDefault();
      ui.benchBoard.classList.add('hover');
    };
    ui.benchBoard.ondragleave = () => {
      ui.benchBoard.classList.remove('hover');
    };
    ui.benchBoard.ondrop = (event) => {
      event.preventDefault();
      ui.benchBoard.classList.remove('hover');
      const playerId = event.dataTransfer.getData('text/plain');
      if (playerId) handleDropToSlot('bench', playerId);
    };
    ui.benchBoard.onclick = (event) => {
      if (event.target && event.target.closest('.player-chip')) return;
      if (!selectedTacticsPlayerId) return;
      handleDropToSlot('bench', selectedTacticsPlayerId);
      clearTacticsSelection();
      renderTacticsBoard();
    };
  };

  const renderTacticsBoard = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.tacticsBoard || !ui.benchBoard) return;
    const team = deps.getTeamById(gameState.userTeamId);
    deps.ensureRotationSlots(team);
    const slots = team.rotation.slots || {};
    ui.tacticsBoard.innerHTML = POSITION_SLOTS.map((pos) => {
      const player = team.roster.find((p) => p.id === slots[pos]);
      const fit = player ? deps.getPositionFitMultiplier(player, pos) : 1;
      const fitClass = player
        ? (player.pos === pos ? 'fit-primary' : (player.secondaryPos && player.secondaryPos.includes(pos) ? 'fit-secondary' : 'fit-out'))
        : '';
      const fitLabel = player
        ? (player.pos === pos ? t('label_fit_primary') : (player.secondaryPos && player.secondaryPos.includes(pos) ? t('label_fit_secondary') : t('label_fit_out')))
        : '';
      return `
        <div class="slot">
          <div class="slot-label">${pos}</div>
          <div class="slot-drop" data-slot="${pos}">
            ${player ? renderPlayerChip(player, pos, fitClass, fitLabel, fit, player.id === selectedTacticsPlayerId) : `<div class="slot-empty">${t ? t('label_drop_here') : 'Solte aqui'}</div>`}
          </div>
        </div>
      `;
    }).join('');

    const bench = team.roster.filter((p) => !Object.values(slots).includes(p.id));
    ui.benchBoard.innerHTML = bench.length
      ? bench.map((player) => renderPlayerChip(player, null, '', '', 1, player.id === selectedTacticsPlayerId)).join('')
      : `<div class="muted">${t ? t('msg_empty_bench') : 'Sem reservas'}</div>`;
    attachTacticsDrag();
  };

  const handleAutoLineup = () => {
    const gameState = getState();
    const deps = getDeps();
    if (!gameState) return;
    const team = deps.getTeamById(gameState.userTeamId);
    const available = team.roster.filter((p) => p.injuryDays === 0);
    const slots = {};
    POSITION_SLOTS.forEach((pos) => {
      let best = null;
      let bestScore = -Infinity;
      available.forEach((player) => {
        if (Object.values(slots).includes(player.id)) return;
        const fit = deps.getPositionFitMultiplier(player, pos);
        const score = (computeOvr ? computeOvr(player) : player.ovr) * fit + (player.starLevel || 0) * 2;
        if (score > bestScore) {
          bestScore = score;
          best = player;
        }
      });
      if (best) slots[pos] = best.id;
    });
    team.rotation.slots = slots;
    deps.ensureRotation(team);
    renderRotation();
    renderTacticsBoard();
    if (deps.logMessage) deps.logMessage('msg_auto_lineup');
  };


  const renderSchedule = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.schedule) return;
    const team = deps.getTeamById(gameState.userTeamId);
    const games = gameState.schedule
      .filter((g) => g.home === team.id || g.away === team.id)
      .slice(0, 16);

    ui.schedule.innerHTML = `
      <table class="table">
        <thead><tr><th>${t ? t('th_round') : 'Rodada'}</th><th>${t ? t('th_game') : 'Jogo'}</th><th>${t ? t('th_score') : 'Placar'}</th></tr></thead>
        <tbody>
          ${games.map((g) => {
            const home = deps.getTeamById(g.home).name;
            const away = deps.getTeamById(g.away).name;
            const score = g.played ? `${g.scoreHome} - ${g.scoreAway}` : '-';
            return `<tr><td>${g.day + 1}</td><td>${home} x ${away}</td><td>${score}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
      <div class="muted">Mostrando proximos 16 jogos do seu time (temporada de ${gameState.league ? gameState.league.gamesPerTeam : 0} jogos).</div>
    `;
  };

  const renderPlayoffs = () => {
    const gameState = getState();
    const ui = getUI();
    if (!gameState || !ui.playoffs) return;
    const playoffs = gameState.playoffs;
    if (!playoffs || !playoffs.rounds || !playoffs.rounds.length) {
      ui.playoffs.innerHTML = `<div class="muted">${t ? t('msg_no_playoffs') : 'Sem playoffs.'}</div>`;
      return;
    }
    const playInLines = [];
    if (playoffs.playIn && playoffs.playIn.east) {
      playInLines.push(`Leste: 7º ${playoffs.playIn.east.seed7}  8º ${playoffs.playIn.east.seed8}`);
    }
    if (playoffs.playIn && playoffs.playIn.west) {
      playInLines.push(`Oeste: 7º ${playoffs.playIn.west.seed7}  8º ${playoffs.playIn.west.seed8}`);
    }
    ui.playoffs.innerHTML = `
      <div class="stack">
        <div class="badge primary">${t ? t('label_champion') : 'Campeao'}: ${playoffs.champion || '-'}</div>
        <div>${t ? t('label_finals_mvp') : 'MVP Finais'}: ${playoffs.finalsMvp || '-'}</div>
        ${playInLines.length ? `<div class="badge">${t ? t('label_playin') : 'Play-In'}</div>${playInLines.map((line) => `<div>${line}</div>`).join('')}` : ''}
        <div class="badge">${t ? t('label_playoff_rounds') : 'Rodadas'}</div>
        ${playoffs.rounds.map((round) => `<div>${round.match}  ${t ? t('label_winner') : 'Vencedor'}: ${round.winner}</div>`).join('')}
      </div>
    `;
  };

  const renderFinances = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.finance || !ui.contracts) return;
    const team = deps.getTeamById(gameState.userTeamId);
    const payroll = team.roster.reduce((acc, p) => acc + p.salary, 0);
    const monthlyIncome = deps.computeMonthlyIncome(team);
    const monthlyPayroll = parseFloat((payroll / 12).toFixed(2));
    const monthlyNet = parseFloat((monthlyIncome - monthlyPayroll).toFixed(2));
    ui.finance.innerHTML = `
      <div class="stack">
        <div>Orcamento atual: <strong>${formatMoney ? formatMoney(team.budget) : team.budget}</strong></div>
        <div>Folha salarial: ${formatMoney ? formatMoney(payroll) : payroll}</div>
        <div>${t ? t('label_monthly_income') : 'Receita mensal'}: ${formatMoney ? formatMoney(monthlyIncome) : monthlyIncome}</div>
        <div>${t ? t('label_monthly_payroll') : 'Folha mensal'}: ${formatMoney ? formatMoney(monthlyPayroll) : monthlyPayroll}</div>
        <div>${t ? t('label_monthly_net') : 'Saldo mensal'}: ${formatMoney ? formatMoney(monthlyNet) : monthlyNet}</div>
        <div>${t ? t('label_fans') : 'Torcida'}: ${team.fanMood}%  Base: ${team.fanBase}</div>
        <div>${t ? t('label_arena') : 'Arena'}: ${team.facilities ? team.facilities.arena : team.arenaLevel}</div>
        <div>${t ? t('sponsor_current') : 'Patrocinio'}: ${gameState.sponsor ? gameState.sponsor.name : (t ? t('sponsor_none') : 'Nenhum')}</div>
        <div class="muted">Receitas variam por desempenho e bilheteria.</div>
      </div>
    `;

    ui.contracts.innerHTML = `
      <table class="table">
        <thead><tr><th>${t ? t('th_player') : 'Jogador'}</th><th>${t ? t('th_salary') : 'Salario'}</th><th>${t ? t('label_years') : 'Anos'}</th></tr></thead>
        <tbody>
          ${team.roster.map((player) => `
            <tr>
              <td>${player.name}</td>
              <td>${formatMoney ? formatMoney(player.salary) : player.salary}</td>
              <td>${player.contractYears}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderTraining = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.trainingCenter || !ui.progression) return;
    const filterValue = gameState.trainingFilter || 'all';
    const sortValue = gameState.trainingSort || 'progress';
    const filterLabel = t ? t('label_training_filter') : 'Filtro';
    const sortLabel = t ? t('label_training_sort') : 'Ordenar';
    ui.trainingCenter.innerHTML = `
      <div class="stack">
        ${TRAINING_FOCUS.map((item) => `
          <label class="badge">
            <input type="radio" name="training" value="${item.id}" ${gameState.trainingFocus === item.id ? 'checked' : ''}/> ${item.label}
          </label>
        `).join('')}
        <div class="row">
          <label class="field">
            <span>${filterLabel}</span>
            <select id="training-filter" class="select">
              <option value="all">${t ? t('training_filter_all') : 'Todos'}</option>
              <option value="young">${t ? t('training_filter_young') : 'Jovens (<=23)'}</option>
              <option value="prime">${t ? t('training_filter_prime') : 'Prime (24-29)'}</option>
              <option value="vet">${t ? t('training_filter_vet') : 'Veteranos (30+)'}</option>
              <option value="star">${t ? t('training_filter_star') : 'Estrelas (82+ OVR)'}</option>
              <option value="bench">${t ? t('training_filter_bench') : 'Banco/Prospecto'}</option>
            </select>
          </label>
          <label class="field">
            <span>${sortLabel}</span>
            <select id="training-sort" class="select">
              <option value="progress">${t ? t('training_sort_progress') : 'Evolucao (temporada)'}</option>
              <option value="ovr">${t ? t('training_sort_ovr') : 'OVR'}</option>
              <option value="age">${t ? t('training_sort_age') : 'Idade'}</option>
              <option value="potential">${t ? t('training_sort_potential') : 'Potencial'}</option>
              <option value="lastgain">${t ? t('training_sort_lastgain') : 'Ultimo ganho'}</option>
            </select>
          </label>
        </div>
        <button class="btn primary" id="btn-apply-training">Aplicar Treino</button>
        <div class="muted">Treino semanal melhora atributos, mas consome energia.</div>
      </div>
    `;
    const filterEl = ui.trainingCenter.querySelector('#training-filter');
    if (filterEl) filterEl.value = filterValue;
    const sortEl = ui.trainingCenter.querySelector('#training-sort');
    if (sortEl) sortEl.value = sortValue;

    const team = deps.getTeamById(gameState.userTeamId);
    const scoutLevel = getScoutingLevel ? getScoutingLevel(team) : 0;
    const top = [...team.roster].sort((a, b) => b.ovr - a.ovr).slice(0, 8);
    const lastSession = gameState.trainingLog && gameState.trainingLog.length ? gameState.trainingLog[0] : null;
    const focusMap = TRAINING_FOCUS.reduce((acc, item) => {
      acc[item.id] = item.label;
      return acc;
    }, {});
    const seasonProgress = [...team.roster].map((player) => {
      const base = typeof player.seasonStartOvr === 'number' ? player.seasonStartOvr : player.ovr;
      const delta = player.ovr - base;
      return { player, delta };
    }).sort((a, b) => b.delta - a.delta);
    const attrLabel = (key) => ({
      attack: 'ATK',
      defense: 'DEF',
      physical: 'PHY',
      shooting: 'SHO',
      passing: 'PAS'
    }[key] || key.toUpperCase());

    const buildAttrLine = (player) => {
      const base = player.seasonStartAttrs || {
        attack: player.attack,
        defense: player.defense,
        physical: player.physical,
        shooting: player.shooting,
        passing: player.passing
      };
      const deltas = {
        attack: player.attack - (typeof base.attack === 'number' ? base.attack : player.attack),
        defense: player.defense - (typeof base.defense === 'number' ? base.defense : player.defense),
        physical: player.physical - (typeof base.physical === 'number' ? base.physical : player.physical),
        shooting: player.shooting - (typeof base.shooting === 'number' ? base.shooting : player.shooting),
        passing: player.passing - (typeof base.passing === 'number' ? base.passing : player.passing)
      };
      return `ATK ${deltas.attack >= 0 ? '+' : ''}${deltas.attack} / DEF ${deltas.defense >= 0 ? '+' : ''}${deltas.defense} / PHY ${deltas.physical >= 0 ? '+' : ''}${deltas.physical} / SHO ${deltas.shooting >= 0 ? '+' : ''}${deltas.shooting} / PAS ${deltas.passing >= 0 ? '+' : ''}${deltas.passing}`;
    };

    const buildLastGainLabel = (player) => {
      const label = t ? t('label_training_lastgain') : 'Ultimo ganho';
      if (!player.lastTrainingAttr) return `${label} ${player.lastTrainingGain || 0}`;
      return `${label} ${player.lastTrainingGain || 0} ${attrLabel(player.lastTrainingAttr)}`;
    };

    const renderSparkline = (history = []) => {
      if (!history.length) return '<div class="sparkline"></div>';
      const min = Math.min(...history);
      const max = Math.max(...history);
      return `
        <div class="sparkline">
          ${history.map((value) => {
            const pct = max === min ? 60 : Math.round(((value - min) / (max - min)) * 80 + 10);
            return `<span style="height:${pct}%"></span>`;
          }).join('')}
        </div>
      `;
    };
    const filtered = team.roster.filter((player) => {
      if (filterValue === 'young') return player.age <= 23;
      if (filterValue === 'prime') return player.age >= 24 && player.age <= 29;
      if (filterValue === 'vet') return player.age >= 30;
      if (filterValue === 'star') return player.ovr >= 82;
      if (filterValue === 'bench') return ['Rotacao', 'Prospecto'].includes(player.role);
      return true;
    });
    const sortMap = {
      progress: (a, b) => {
        const baseA = typeof a.seasonStartOvr === 'number' ? a.seasonStartOvr : a.ovr;
        const baseB = typeof b.seasonStartOvr === 'number' ? b.seasonStartOvr : b.ovr;
        return (b.ovr - baseB) - (a.ovr - baseA);
      },
      ovr: (a, b) => b.ovr - a.ovr,
      age: (a, b) => a.age - b.age,
      potential: (a, b) => (getPotentialMax ? getPotentialMax(b) : b.potential) - (getPotentialMax ? getPotentialMax(a) : a.potential),
      lastgain: (a, b) => (b.lastTrainingGain || 0) - (a.lastTrainingGain || 0)
    };
    const sorted = [...filtered].sort(sortMap[sortValue] || sortMap.progress);
    ui.progression.innerHTML = `
      <div class="stack">
        <div class="badge accent">${t ? t('label_top_progress') : 'Top progresso'}</div>
        ${top.map((player) => {
          const scouted = scoutLevel <= 1 || !getScoutedPotentialEstimate ? '??' : getScoutedPotentialEstimate(player, scoutLevel).estimate;
          const potMaxLabel = getVisiblePotentialMax ? getVisiblePotentialMax(player, scoutLevel) : '-';
          const maxProgress = scoutLevel >= 5
            ? (getPotentialMax ? getPotentialMax(player) : player.potential)
            : (scouted === '??' ? 75 : scouted);
          const progress = getPotentialProgress(player, maxProgress);
          return `
            <div class="stack">
              <div><strong>${player.name}</strong> - ${player.pos} - ${player.ovr} OVR</div>
              <div class="muted">${t ? t('label_potential_now') : 'Potencial'}: ${scouted} - ${t ? t('label_potential_max') : 'Max'}: ${potMaxLabel}</div>
              <div class="progress-bar"><span style="width:${progress}%"></span></div>
              <div class="muted">${t ? t('label_growth_stage') : 'Fase'}: ${getGrowthStage(player)}</div>
            </div>
          `;
        }).join('')}
        <div class="badge">${t ? t('label_training_last') : 'Ultimo treino'}</div>
        ${lastSession ? `
          <div class="muted">${focusMap[lastSession.focus] || lastSession.focus} - Dia ${lastSession.day} - T${lastSession.season}</div>
          ${lastSession.gains.slice(0, 8).map((entry) => `
            <div>${entry.name} (${entry.pos}) - +${entry.gain} ${entry.attr.toUpperCase()} ${entry.ovrDelta ? `- OVR ${entry.ovrDelta >= 0 ? '+' : ''}${entry.ovrDelta}` : ''}</div>
          `).join('')}
        ` : '<div class="muted">Nenhum treino aplicado ainda.</div>'}
        <div class="badge">${t ? t('label_season_progress') : 'Progresso da temporada'}</div>
        ${seasonProgress.slice(0, 10).map(({ player, delta }) => `
          <div class="row">
            <div><strong>${player.name}</strong> - ${player.pos}</div>
            <div class="muted">OVR ${player.ovr} - ${delta >= 0 ? '+' : ''}${delta} na temporada</div>
          </div>
        `).join('')}
        <div class="badge">${t ? t('label_training_panel') : 'Painel de evolucao'}</div>
        ${sorted.map((player) => {
          const base = typeof player.seasonStartOvr === 'number' ? player.seasonStartOvr : player.ovr;
          const delta = player.ovr - base;
          const pot = getPotentialMax ? getPotentialMax(player) : player.potential;
          return `
            <div class="row training-row">
              <div>
                <strong>${player.name}</strong> - ${player.pos} - ${player.ovr} OVR
                <div class="muted">Idade ${player.age} - Pot ${pot} - ${buildLastGainLabel(player)}</div>
                <div class="muted">${buildAttrLine(player)}</div>
              </div>
              <div class="muted">Temp ${delta >= 0 ? '+' : ''}${delta}</div>
              ${renderSparkline(player.ovrHistory || [])}
            </div>
          `;
        }).join('')}
        <div class="badge">Progressao recente</div>
        ${gameState.progressLog.length ? gameState.progressLog.map((line) => `<div>${line}</div>`).join('') : '<div class="muted">Sem ganhos recentes.</div>'}
      </div>
    `;
  };


  const facilityCost = (level) => 6 + level * 6;

  const renderFacilities = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.facilities) return;
    const team = deps.getTeamById(gameState.userTeamId);
    const buildRow = (label, key) => {
      const level = team.facilities[key];
      const cost = facilityCost(level);
      return `
        <div class="row">
          <div class="badge">${label}  Nivel ${level}</div>
          <button class="btn" data-action="upgrade" data-facility="${key}">Melhorar (${formatMoney ? formatMoney(cost) : cost})</button>
        </div>
      `;
    };
    ui.facilities.innerHTML = `
      <div class="stack">
        ${buildRow('Centro de Treino', 'training')}
        ${buildRow('Departamento Medico', 'medical')}
        ${buildRow('Scout e Analytics', 'scouting')}
        ${buildRow('Arena', 'arena')}
        <div class="muted">Melhorias aumentam evolucao, recuperacao, bilheteria e scouting.</div>
      </div>
    `;
  };

  const staffUpgradeCost = (level) => 4 + (level + 1) * 4;

  const renderStaff = () => {
    const gameState = getState();
    const ui = getUI();
    if (!gameState || !ui.staff) return;
    const staff = gameState.staff;
    const effects = {
      offense: t ? t('staff_effect_offense') : '',
      defense: t ? t('staff_effect_defense') : '',
      shooting: t ? t('staff_effect_shooting') : '',
      strength: t ? t('staff_effect_strength') : '',
      finance: t ? t('staff_effect_finance') : ''
    };
    const build = (label, key) => {
      const level = staff[key];
      const maxed = level >= MAX_STAFF_LEVEL;
      const cost = staffUpgradeCost(level);
      return `
        <div class="row">
          <div class="stack">
            <div class="badge">${label}  N${level}/${MAX_STAFF_LEVEL}</div>
            <div class="muted">${effects[key] || ''}</div>
          </div>
          <button class="btn" data-action="staff-upgrade" data-staff="${key}" ${maxed ? 'disabled' : ''}>+1 (${formatMoney ? formatMoney(cost) : cost})</button>
        </div>
      `;
    };
    ui.staff.innerHTML = `
      <div class="stack">
        ${build(t ? t('staff_offense') : 'Ataque', 'offense')}
        ${build(t ? t('staff_defense') : 'Defesa', 'defense')}
        ${build(t ? t('staff_shooting') : 'Arremesso', 'shooting')}
        ${build(t ? t('staff_strength') : 'Fisico', 'strength')}
        ${build(t ? t('staff_finance') : 'Financas', 'finance')}
        <div class="muted">${t ? t('staff_effect_summary') : ''}</div>
      </div>
    `;
  };

  const renderGMSkills = () => {
    const gameState = getState();
    const ui = getUI();
    if (!gameState || !ui.gmSkills) return;
    const skills = gameState.gmSkills;
    const effects = {
      scouting: t ? t('skill_effect_scouting') : '',
      negotiation: t ? t('skill_effect_negotiation') : '',
      development: t ? t('skill_effect_development') : '',
      finance: t ? t('skill_effect_finance') : ''
    };
    ui.gmSkills.innerHTML = `
      <div class="stack">
        <div class="badge primary">${t ? t('label_skill_points') : 'Pontos'}: ${gameState.skillPoints}</div>
        <div class="row">
          <div class="stack">
            <div class="badge">${t ? t('skill_scouting') : 'Scout'} N${skills.scouting}/${MAX_GM_SKILL}</div>
            <div class="muted">${effects.scouting}</div>
          </div>
          <button class="btn" data-action="gm-upgrade" data-skill="scouting" ${skills.scouting >= MAX_GM_SKILL ? 'disabled' : ''}>+1</button>
        </div>
        <div class="row">
          <div class="stack">
            <div class="badge">${t ? t('skill_negotiation') : 'Negociacao'} N${skills.negotiation}/${MAX_GM_SKILL}</div>
            <div class="muted">${effects.negotiation}</div>
          </div>
          <button class="btn" data-action="gm-upgrade" data-skill="negotiation" ${skills.negotiation >= MAX_GM_SKILL ? 'disabled' : ''}>+1</button>
        </div>
        <div class="row">
          <div class="stack">
            <div class="badge">${t ? t('skill_development') : 'Desenvolvimento'} N${skills.development}/${MAX_GM_SKILL}</div>
            <div class="muted">${effects.development}</div>
          </div>
          <button class="btn" data-action="gm-upgrade" data-skill="development" ${skills.development >= MAX_GM_SKILL ? 'disabled' : ''}>+1</button>
        </div>
        <div class="row">
          <div class="stack">
            <div class="badge">${t ? t('skill_finance') : 'Financas'} N${skills.finance}/${MAX_GM_SKILL}</div>
            <div class="muted">${effects.finance}</div>
          </div>
          <button class="btn" data-action="gm-upgrade" data-skill="finance" ${skills.finance >= MAX_GM_SKILL ? 'disabled' : ''}>+1</button>
        </div>
      </div>
    `;
  };

  const renderSponsors = () => {
    const gameState = getState();
    const ui = getUI();
    if (!gameState || !ui.sponsors) return;
    const current = gameState.sponsor;
    const duration = current ? `${current.yearsLeft} ${t ? t('label_years') : 'anos'}` : '-';
    const options = SPONSORS.map((s) => `<option value="${s.id}">${s.name}  +${s.bonus} mi</option>`).join('');
    ui.sponsors.innerHTML = `
      <div class="stack">
        <div class="badge">${t ? t('sponsor_current') : 'Patrocinio'}: ${current ? current.name : (t ? t('sponsor_none') : 'Nenhum')}</div>
        <div class="muted">${current ? t('label_sponsor_info', {
          bonus: current.bonus,
          fan: `${current.fanBoost >= 0 ? '+' : ''}${current.fanBoost}`,
          years: duration
        }) : (t ? t('sponsor_none') : '')}</div>
        <label class="field">
          <span>${t ? t('sponsor_select') : 'Selecione'}</span>
          <select id="sponsor-select" class="select">${options}</select>
        </label>
        <button id="btn-sponsor-sign" class="btn primary">${t ? t('sponsor_sign') : 'Assinar'}</button>
      </div>
    `;
  };


  const renderScouting = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.scouting) return;
    const team = deps.getTeamById(gameState.userTeamId);
    const scoutLevel = getScoutingLevel ? getScoutingLevel(team) : 0;
    const pool = gameState.market.draftPool.slice(0, 8);
    const rosterReport = [...team.roster]
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 6);
    const allPlayers = gameState.teams.flatMap((t) => t.roster);
    const market = window.AppMarket || {};
    const getPlayerComps = market.getPlayerComps || (() => '-');
    ui.scouting.innerHTML = `
      <div class="stack">
        <div class="badge primary">${t ? t('label_scouting_level') : 'Nivel'}: ${scoutLevel}</div>
        <div class="card">
          <div class="badge">${t ? t('label_scouting_draft_report') : 'Relatorio Draft'}</div>
          ${pool.length ? pool.map((p) => `
            <div class="row">
              <div class="stack">
                <div><strong>${p.name}</strong>  ${p.pos}  ${p.nationality || '-'}</div>
                <div class="muted">${t ? t('label_potential_now') : 'Potencial'}: ${formatScoutedPotential ? formatScoutedPotential(p, scoutLevel) : p.potential}  ${t ? t('label_projection') : 'Projecao'}: ${getProjectionLabel ? getProjectionLabel(p, scoutLevel) : '-'}  ${t ? t('label_risk') : 'Risco'}: ${getRiskLabel ? getRiskLabel(p, scoutLevel) : '-'}</div>
                <div class="muted">${t ? t('label_comps') : 'Comps'}: ${getPlayerComps(p, pool)}</div>
              </div>
              <div class="badge">${p.archetype}</div>
            </div>
          `).join('') : `<div class="muted">${t ? t('msg_scouting_empty') : 'Sem prospects.'}</div>`}
        </div>
        <div class="card">
          <div class="badge">${t ? t('label_scouting_team_report') : 'Relatorio do time'}</div>
          ${rosterReport.map((p) => `
            <div class="row">
              <div class="stack">
                <div><strong>${p.name}</strong>  ${p.pos}  ${p.ovr} OVR</div>
                <div class="muted">${t ? t('label_potential_now') : 'Potencial'}: ${formatScoutedPotential ? formatScoutedPotential(p, scoutLevel) : p.potential}  ${t ? t('label_potential_max') : 'Max'}: ${getVisiblePotentialMax ? getVisiblePotentialMax(p, scoutLevel) : '-'}  ${t ? t('label_growth_stage') : 'Fase'}: ${getGrowthStage(p)}</div>
                <div class="muted">${t ? t('label_comps') : 'Comps'}: ${getPlayerComps(p, allPlayers)}</div>
              </div>
              <div class="badge">${t ? t('label_recommendation') : 'Recomendacao'}: ${getRecommendationLabel ? getRecommendationLabel(p, scoutLevel) : '-'}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  };

  const renderLongterm = () => {
    const gameState = getState();
    const ui = getUI();
    if (!gameState || !ui.longterm) return;
    const remaining = Math.max(0, MAX_SEASONS - gameState.season + 1);
    const league = gameState.league || {};
    const worldHistory = gameState.worldLeaguesHistory || [];
    const latestWorld = worldHistory[0];
    const recentWorld = worldHistory.slice(0, 3);
    ui.longterm.innerHTML = `
      <div class="stack">
        <div class="badge primary">Temporada ${gameState.season} de ${MAX_SEASONS}</div>
        <div>Temporadas restantes: ${remaining}</div>
        <div>Liga: ${league.name || '-'}</div>
        <div>Jogos por time: ${league.gamesPerTeam || '-'}</div>
        <div>Times nos playoffs: ${league.playoffTeams || '-'}</div>
        <div>Lottery: ${league.draftLottery ? 'Sim' : 'Nao'}</div>
        <div class="muted">${gameState.phase === 'retired' ? 'Carreira encerrada.' : `Ao fim da temporada ${MAX_SEASONS}, a carreira sera encerrada.`}</div>
        <div class="card">
          <div class="badge">${t ? t('h_world_leagues') : 'Ligas mundiais'}</div>
          ${latestWorld ? `
            <div class="muted">${t ? t('label_season') : 'Temp'} ${latestWorld.season}</div>
            <div class="badge">${t ? t('label_world_champions') : 'Campeoes'}</div>
            ${latestWorld.leagues.map((item) => `
              <div>${item.name}: ${item.champion} ${item.ovr ? `(OVR ${item.ovr})` : ''}</div>
              <div class="muted">${t ? t('label_world_mvp') : 'MVP'}: ${item.mvp || '-'}</div>
              <div class="muted">${t ? t('label_world_scorer') : 'Cestinha'}: ${item.scorer || '-'}</div>
              ${item.playoffs && item.playoffs.length ? `
                <div class="badge">${t ? t('label_world_playoffs') : 'Playoffs'}</div>
                ${item.playoffs.slice(0, 4).map((round) => `
                  <div class="muted">${round.round}: ${round.match}  ${round.winner} (${round.score})</div>
                `).join('')}
              ` : ''}
            `).join('')}
            ${recentWorld.length > 1 ? `
              <div class="badge">${t ? t('h_season_history') : 'Historico'}</div>
              ${recentWorld.map((row) => `
                <div class="muted">${t ? t('label_season') : 'Temp'} ${row.season}  ${row.leagues.map((l) => `${l.name}: ${l.champion}`).join(' | ')}</div>
              `).join('')}
            ` : ''}
          ` : `<div class="muted">${t ? t('msg_world_leagues_empty') : 'Sem ligas.'}</div>`}
        </div>
      </div>
    `;
  };

  const renderAwards = () => {
    const gameState = getState();
    const ui = getUI();
    if (!gameState || !ui.awards) return;
    const awards = gameState.awardsHistory.slice(0, 3);
    ui.awards.innerHTML = `
      <div class="stack">
        ${awards.length ? awards.map((item) => `
          <div class="badge primary">${t ? t('label_season') : 'Temp'} ${item.season}</div>
          <div>${t ? t('label_mvp') : 'MVP'}: ${item.mvp}</div>
          <div>${t ? t('label_dpoy') : 'DPOY'}: ${item.dpoy}</div>
          <div>${t ? t('label_roy') : 'ROY'}: ${item.roy}</div>
          <div>${t ? t('label_scorer') : 'Cestinha'}: ${item.scorer}</div>
        `).join('') : `<div class="muted">${t ? t('msg_no_awards') : 'Sem premios.'}</div>`}
      </div>
    `;
  };

  const renderRivalries = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.rivalries) return;
    const pairs = gameState.rivalries || [];
    ui.rivalries.innerHTML = `
      <div class="stack">
        ${pairs.length ? pairs.map((pair) => {
          const a = deps.getTeamById(pair.a);
          const b = deps.getTeamById(pair.b);
          return `<div>${a.name} vs ${b.name}</div>`;
        }).join('') : `<div class="muted">${t ? t('msg_no_rivalries') : 'Sem rivalidades.'}</div>`}
      </div>
    `;
  };

  const renderHallFame = () => {
    const gameState = getState();
    const ui = getUI();
    if (!gameState || !ui.hallFame) return;
    const candidates = [];
    gameState.teams.forEach((team) => {
      team.roster.forEach((player) => candidates.push(player));
    });
    if (gameState.market && gameState.market.freeAgents) {
      gameState.market.freeAgents.forEach((player) => candidates.push(player));
    }
    const filtered = candidates.filter((player) => {
      const awards = player.awards || [];
      const hasMajor = awards.some((award) => award.includes('MVP') || award.includes('Finals'));
      return awards.length >= 3 || hasMajor;
    });
    if (!filtered.length) {
      ui.hallFame.innerHTML = `<div class="muted">${t ? t('msg_no_hof') : 'Sem HOF.'}</div>`;
      return;
    }
    const ranked = filtered
      .map((player) => ({
        player,
        count: player.awards ? player.awards.length : 0
      }))
      .sort((a, b) => b.count - a.count || (b.player.ovr || 0) - (a.player.ovr || 0))
      .slice(0, 8);
    ui.hallFame.innerHTML = `
      <div class="stack">
        ${ranked.map((item) => {
          const latest = item.player.awards && item.player.awards.length ? formatAwardLabel(item.player.awards[0]) : '-';
          return `<div>${item.player.name}  ${item.player.pos}  ${item.count} ${t ? t('th_awards') : 'premios'}  ${latest}</div>`;
        }).join('')}
      </div>
    `;
  };

  const renderSeasonHistory = () => {
    const gameState = getState();
    const ui = getUI();
    if (!gameState || !ui.seasonHistory) return;
    const history = gameState.seasonRecaps || [];
    if (!history.length) {
      ui.seasonHistory.innerHTML = `<div class="muted">${t ? t('msg_no_history') : 'Sem historico.'}</div>`;
      return;
    }
    ui.seasonHistory.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>${t ? t('label_season') : 'Temp'}</th>
            <th>${t ? t('label_champion') : 'Campeao'}</th>
            <th>${t ? t('label_user_record') : 'Campanha'}</th>
            <th>${t ? t('label_mvp') : 'MVP'}</th>
            <th>${t ? t('label_finals_mvp') : 'MVP Finais'}</th>
          </tr>
        </thead>
        <tbody>
          ${history.map((recap) => `
            <tr>
              <td>${recap.season}</td>
              <td>${recap.champion || '-'}</td>
              <td>${recap.user ? `${recap.user.wins}V-${recap.user.losses}D` : '-'}</td>
              <td>${recap.awards ? recap.awards.mvp : '-'}</td>
              <td>${recap.finalsMvp || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderMarketHistory = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.marketHistory) return;
    const team = deps.getTeamById(gameState.userTeamId);
    const compactMode = deps.isCompactMode ? deps.isCompactMode() : false;
    const perfMode = deps.isPerformanceMode ? deps.isPerformanceMode() : false;
    const tradeLimit = (compactMode || perfMode) ? 4 : 8;
    const trades = gameState.tradeHistory.slice(0, tradeLimit);
    const tradeRemaining = gameState.tradeHistory.length - trades.length;
    const market = window.AppMarket || {};
    const picks = market.getPickAssetsForTeam ? market.getPickAssetsForTeam(team.id, gameState.season) : [];
    const formatPickLabel = market.formatPickLabel || ((pick) => pick.label || '-');
    ui.marketHistory.innerHTML = `
      <div class="stack">
        <div class="badge">${t ? t('label_trade_history') : 'Historico de trocas'}</div>
        ${tradeRemaining > 0 ? `<div class="muted">${t ? t('msg_roster_partial', { shown: trades.length, total: gameState.tradeHistory.length }) : `Mostrando ${trades.length} de ${gameState.tradeHistory.length}`}</div>` : ''}
        ${trades.length ? trades.map((trade) => {
          const otherTeam = deps.getTeamById(trade.targetTeamId);
          return `
            <div class="row">
              <div class="stack">
                <div><strong>T${trade.season} D${trade.day}</strong>  ${otherTeam ? otherTeam.name : '-'}</div>
                <div>${t ? t('label_trade_offer') : 'Enviado'}: ${trade.sentPlayers.join(', ') || '-'}</div>
                <div>${t ? t('label_trade_receive') : 'Recebido'}: ${trade.receivedPlayers.join(', ') || '-'}</div>
                <div>${t ? t('label_trade_pick_send') : 'Picks enviados'}: ${trade.sentPicks.length ? trade.sentPicks.join(', ') : '-'}</div>
                <div>${t ? t('label_trade_pick_receive') : 'Picks recebidos'}: ${trade.receivedPicks.length ? trade.receivedPicks.join(', ') : '-'}</div>
                <div class="muted">${t ? t('label_trade_cash_hint') : 'Cash'}: ${trade.cash >= 0 ? `+${trade.cash.toFixed(1)}` : trade.cash.toFixed(1)}</div>
              </div>
            </div>
          `;
        }).join('') : `<div class="muted">${t ? t('msg_trade_history_empty') : 'Sem trocas.'}</div>`}
        <div class="badge">${t ? t('label_pick_assets') : 'Picks'}</div>
        ${picks.length ? picks.map((pick) => `<div>${formatPickLabel(pick)}</div>`).join('') : `<div class="muted">${t ? t('msg_pick_assets_empty') : 'Sem picks.'}</div>`}
      </div>
    `;
  };

  const renderWorldPlayoffs = () => {
    const gameState = getState();
    const ui = getUI();
    if (!gameState || !ui.worldPlayoffs) return;
    const history = gameState.worldLeaguesHistory || [];
    const latest = history[0];
    if (!latest) {
      ui.worldPlayoffs.innerHTML = `<div class="muted">${t ? t('msg_world_playoffs_empty') : 'Sem playoffs mundiais.'}</div>`;
      return;
    }
    ui.worldPlayoffs.innerHTML = `
      <div class="stack">
        ${latest.leagues.map((league) => `
          <div class="card">
            <div class="badge">${league.name}</div>
            <div class="muted">${t ? t('label_season') : 'Temp'} ${latest.season}  ${league.champion}</div>
            ${league.playoffs && league.playoffs.length ? league.playoffs.map((round) => `
              <div class="muted">${round.round}: ${round.match}  ${round.winner} (${round.score})</div>
            `).join('') : `<div class="muted">-</div>`}
          </div>
        `).join('')}
      </div>
    `;
  };

  const renderNational = () => {
    const gameState = getState();
    const ui = getUI();
    const deps = getDeps();
    if (!gameState || !ui.nationalCalendar || !ui.nationalHistory) return;
    const next = deps.getInternationalCycle ? deps.getInternationalCycle(gameState.season + 1) : null;
    ui.nationalCalendar.innerHTML = `
      <div class="stack">
        <div>Proximo evento: <strong>${next || 'Sem torneio'}</strong></div>
        <div class="muted">Olimpiadas a cada 4 anos (temporadas multiplas de 4). Copa do Mundo em anos pares intermediarios.</div>
      </div>
    `;
    const history = gameState.international.history.slice(0, 6);
    ui.nationalHistory.innerHTML = `
      <div class="stack">
        ${history.length ? history.map((item) => `<div>${item.name} T${item.season}: ${item.champion}</div>`).join('') : '<div class="muted">Sem historico ainda.</div>'}
      </div>
    `;
  };

  const computeScheduleTotals = () => {
    const gameState = getState();
    if (!gameState) return {};
    const totals = {};
    gameState.teams.forEach((team) => {
      totals[team.id] = { pointsFor: 0, pointsAgainst: 0, games: 0 };
    });
    gameState.schedule.filter((g) => g.played).forEach((game) => {
      const home = totals[game.home];
      const away = totals[game.away];
      if (home) {
        home.pointsFor += game.scoreHome;
        home.pointsAgainst += game.scoreAway;
        home.games += 1;
      }
      if (away) {
        away.pointsFor += game.scoreAway;
        away.pointsAgainst += game.scoreHome;
        away.games += 1;
      }
    });
    return totals;
  };

  const computeTeamSeasonTotals = (team) => team.roster.reduce((acc, player) => {
    const stats = player.seasonStats || {};
    acc.points += stats.pts || 0;
    acc.rebounds += stats.reb || 0;
    acc.assists += stats.ast || 0;
    acc.turnovers += stats.tov || 0;
    return acc;
  }, { points: 0, rebounds: 0, assists: 0, turnovers: 0 });

  const renderAdvancedLeague = () => {
    const gameState = getState();
    const ui = getUI();
    if (!gameState || !ui.advancedLeague || !estimatePossessions || !formatPct) return;
    const totalsByTeam = computeScheduleTotals();
    const leagueRebTotal = gameState.teams.reduce((acc, team) => {
      const totals = computeTeamSeasonTotals(team);
      return acc + totals.rebounds;
    }, 0);
    const leagueRebAvg = leagueRebTotal / Math.max(gameState.teams.length, 1);
    const rows = gameState.teams.map((team) => {
      const schedule = totalsByTeam[team.id] || { pointsFor: 0, pointsAgainst: 0, games: 0 };
      const totals = computeTeamSeasonTotals(team);
      const possessions = estimatePossessions(schedule.pointsFor, schedule.pointsAgainst, totals.turnovers);
      const ortg = possessions ? (schedule.pointsFor / possessions) * 100 : 0;
      const drtg = possessions ? (schedule.pointsAgainst / possessions) * 100 : 0;
      const net = ortg - drtg;
      const astPct = totals.assists / Math.max(1, schedule.pointsFor / 2.2);
      const rebPct = totals.rebounds / Math.max(1, totals.rebounds + leagueRebAvg);
      return {
        team,
        ortg,
        drtg,
        net,
        astPct,
        rebPct,
        possessions
      };
    })
      .sort((a, b) => b.net - a.net)
      .slice(0, 8);

    ui.advancedLeague.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>${t ? t('label_team') : 'Time'}</th>
            <th>${t ? t('label_ortg') : 'ORTG'}</th>
            <th>${t ? t('label_drtg') : 'DRTG'}</th>
            <th>Net</th>
            <th>${t ? t('label_ast_pct') : 'AST%'}</th>
            <th>${t ? t('label_reb_pct') : 'REB%'}</th>
            <th>${t ? t('label_possessions') : 'Poss'}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${row.team.name}</td>
              <td>${row.ortg.toFixed(1)}</td>
              <td>${row.drtg.toFixed(1)}</td>
              <td>${row.net.toFixed(1)}</td>
              <td>${formatPct(row.astPct)}</td>
              <td>${formatPct(row.rebPct)}</td>
              <td>${row.possessions}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderPerformancePanel = () => {
    const gameState = getState();
    const ui = getUI();
    if (!ui.performancePanel || !gameState) return;
    const perf = gameState.performanceStats || { simDayTimes: [], lastSimMs: 0 };
    const samples = perf.simDayTimes || [];
    const recent = samples.slice(-20);
    const avg = recent.length ? (recent.reduce((acc, v) => acc + v, 0) / recent.length) : 0;
    ui.performancePanel.innerHTML = `
      <div class="stack">
        <div>${t ? t('label_perf_last') : 'Ultima'}: <strong>${perf.lastSimMs ? `${perf.lastSimMs.toFixed(0)} ms` : '-'}</strong></div>
        <div>${t ? t('label_perf_avg') : 'Media'}: <strong>${avg ? `${avg.toFixed(0)} ms` : '-'}</strong></div>
        <div>${t ? t('label_perf_mode') : 'Modo'}: <strong>${gameState.settings && gameState.settings.performanceMode ? (t ? t('label_yes') : 'Sim') : (t ? t('label_no') : 'Nao')}</strong></div>
      </div>
    `;
  };

  window.AppRender = {
    renderSummary,
    renderNextGame,
    renderStandings,
    renderObjectives,
    renderMessages,
    renderHealth,
    renderSeasonLeaders,
    renderMinutesPanel,
    renderSeasonRecap,
    renderRoster,
    renderTactics,
    renderRotation,
    renderTacticsBoard,
    handleAutoLineup,
    renderSchedule,
    renderPlayoffs,
    renderFinances,
    renderTraining,
    renderFacilities,
    renderStaff,
    renderGMSkills,
    renderSponsors,
    renderScouting,
    renderLongterm,
    renderAwards,
    renderRivalries,
    renderHallFame,
    renderSeasonHistory,
    renderMarketHistory,
    renderWorldPlayoffs,
    renderNational,
    renderAdvancedLeague,
    renderPerformancePanel
  };
})();

