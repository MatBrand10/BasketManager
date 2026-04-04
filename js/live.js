(() => {
  const getDeps = () => window.AppLiveDeps || {};
  const getState = () => {
    const deps = getDeps();
    return typeof deps.getState === 'function' ? deps.getState() : null;
  };
  const getUI = () => {
    const deps = getDeps();
    return typeof deps.getUI === 'function' ? deps.getUI() : (window.AppUI || {});
  };

  const { t } = window.AppText || {};
  const { computeTeamTotals, estimatePossessions, formatPct } = window.StatsUtils || {};
  const { getLineText, formatClockFromSeconds } = window.LiveUtils || {};

  let liveTimer = null;
  let liveLines = [];
  let liveClockTimer = null;
  let liveClockSeconds = null;
  let liveMomentumHistory = [];
  let liveContext = null;
  let liveLastLead = 0;
  let tvModeEnabled = false;
  let liveHighlights = [];
  let liveSpeed = 1;
  let lastLineText = '';
  let lastLineCount = 0;
  let lastLineEl = null;

  const renderLiveSim = () => {
    const ui = getUI();
    const deps = getDeps();
    if (!ui.liveSim) return;
    if (typeof deps.isSimulating === 'function' && deps.isSimulating()) return;
    ui.liveSim.innerHTML = `<div class="muted">${t ? t('msg_live_empty') : 'Sem simulacao ao vivo.'}</div>`;
    if (ui.liveScoreboard) ui.liveScoreboard.classList.add('hidden');
    if (ui.livePotg) ui.livePotg.classList.add('hidden');
    if (ui.liveHighlights) ui.liveHighlights.classList.add('hidden');
    if (ui.liveAdvanced) ui.liveAdvanced.innerHTML = '';
    if (ui.liveFouls) ui.liveFouls.innerHTML = '';
    if (ui.liveBanner) ui.liveBanner.innerHTML = '';
    if (ui.liveMomentum) ui.liveMomentum.classList.remove('flash');
    if (ui.liveLoading) ui.liveLoading.classList.add('hidden');
  };

  const openLiveOverlay = () => {
    const ui = getUI();
    const deps = getDeps();
    if (deps.openOverlay && ui.liveOverlay) deps.openOverlay(ui.liveOverlay);
    if (ui.liveScoreboard) ui.liveScoreboard.classList.remove('hidden');
  };

  const closeLiveOverlay = () => {
    const ui = getUI();
    const deps = getDeps();
    if (deps.closeOverlay && ui.liveOverlay) deps.closeOverlay(ui.liveOverlay);
    if (ui.liveScoreboard) ui.liveScoreboard.classList.add('hidden');
    stopLiveClock();
    setTvMode(false);
  };

  const setTvMode = (enabled) => {
    tvModeEnabled = enabled;
    document.body.classList.toggle('tv-mode', enabled);
    const ui = getUI();
    if (ui.btnLiveTv) {
      ui.btnLiveTv.textContent = enabled ? (t ? t('btn_live_tv_exit') : 'Sair TV') : (t ? t('btn_live_tv') : 'Modo TV');
    }
  };

  const getTvModeEnabled = () => tvModeEnabled;

  const updateLiveScoreboard = (meta) => {
    const ui = getUI();
    const gameState = getState();
    if (!meta || !ui.liveScoreboard) return;
    if (ui.liveHomeName && meta.homeName) ui.liveHomeName.textContent = meta.homeName;
    if (ui.liveAwayName && meta.awayName) ui.liveAwayName.textContent = meta.awayName;
    if (ui.liveHomeScore) ui.liveHomeScore.textContent = typeof meta.homeScore === 'number' ? meta.homeScore : ui.liveHomeScore.textContent;
    if (ui.liveAwayScore) ui.liveAwayScore.textContent = typeof meta.awayScore === 'number' ? meta.awayScore : ui.liveAwayScore.textContent;
    if (ui.liveQuarter) ui.liveQuarter.textContent = meta.quarter ? `Q${meta.quarter}` : ui.liveQuarter.textContent;
    if (ui.liveClock && meta.clock) ui.liveClock.textContent = meta.clock;

    if (ui.liveHomeTeam && ui.liveAwayTeam && typeof meta.homeScore === 'number' && typeof meta.awayScore === 'number') {
      const lead = Math.sign(meta.homeScore - meta.awayScore);
      ui.liveHomeTeam.classList.toggle('lead', meta.homeScore > meta.awayScore);
      ui.liveAwayTeam.classList.toggle('lead', meta.awayScore > meta.homeScore);
      if (lead !== 0 && liveLastLead !== 0 && lead !== liveLastLead) {
        triggerMomentumFlash();
      }
      if (lead !== 0) liveLastLead = lead;
    }

    if (ui.liveHomeMeta) {
      const homeTO = typeof meta.homeTimeouts === 'number' ? meta.homeTimeouts : 7;
      const homeF = typeof meta.homeFouls === 'number' ? meta.homeFouls : 0;
      const homeBonus = homeF >= 5 ? `  ${t ? t('label_bonus') : 'Bonus'}` : '';
      ui.liveHomeMeta.textContent = `TO ${homeTO}  F ${homeF}${homeBonus}`;
    }
    if (ui.liveAwayMeta) {
      const awayTO = typeof meta.awayTimeouts === 'number' ? meta.awayTimeouts : 7;
      const awayF = typeof meta.awayFouls === 'number' ? meta.awayFouls : 0;
      const awayBonus = awayF >= 5 ? `  ${t ? t('label_bonus') : 'Bonus'}` : '';
      ui.liveAwayMeta.textContent = `TO ${awayTO}  F ${awayF}${awayBonus}`;
    }

    if (ui.liveHomeLogo && ui.liveAwayLogo && meta.homeName && meta.awayName && gameState) {
      const homeTeam = gameState.teams.find((tm) => tm.name === meta.homeName);
      const awayTeam = gameState.teams.find((tm) => tm.name === meta.awayName);
      if (homeTeam) {
        const colors = [homeTeam.colors.primary, homeTeam.colors.secondary];
        ui.liveHomeLogo.innerHTML = window.Theme ? window.Theme.buildTeamLogoHTML(window.Theme.getTeamLogoText(homeTeam.city, homeTeam.nickname), colors, true) : '';
      }
      if (awayTeam) {
        const colors = [awayTeam.colors.primary, awayTeam.colors.secondary];
        ui.liveAwayLogo.innerHTML = window.Theme ? window.Theme.buildTeamLogoHTML(window.Theme.getTeamLogoText(awayTeam.city, awayTeam.nickname), colors, true) : '';
      }
    }
    updateLiveProgress(meta);
  };

  const updateLiveProgress = (meta) => {
    const ui = getUI();
    if (!ui.liveProgressBar || !ui.liveProgressLabel || !meta) return;
    const quarter = typeof meta.quarter === 'number' ? meta.quarter : 1;
    const totalQuarters = 4;
    const quarterLength = 12 * 60;
    let secondsLeft = quarterLength;
    if (meta.clock && meta.clock.includes(':')) {
      const parts = meta.clock.split(':');
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      if (!Number.isNaN(minutes) && !Number.isNaN(seconds)) {
        secondsLeft = minutes * 60 + seconds;
      }
    }
    const elapsed = Math.max(0, (quarter - 1) * quarterLength + (quarterLength - secondsLeft));
    const total = totalQuarters * quarterLength;
    const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
    ui.liveProgressBar.style.width = `${pct.toFixed(1)}%`;
    ui.liveProgressLabel.textContent = `Q${quarter} • ${meta.clock || '12:00'} • ${pct.toFixed(0)}%`;
  };

  const startLiveClock = (initialClock) => {
    const ui = getUI();
    if (!ui.liveClock) return;
    if (liveClockTimer) clearInterval(liveClockTimer);
    liveClockSeconds = typeof initialClock === 'number' ? initialClock : null;
    if (typeof liveClockSeconds !== 'number') return;
    ui.liveClock.textContent = formatClockFromSeconds ? formatClockFromSeconds(liveClockSeconds) : ui.liveClock.textContent;
    liveClockTimer = setInterval(() => {
      if (typeof liveClockSeconds !== 'number') return;
      liveClockSeconds = Math.max(0, liveClockSeconds - 0.2);
      if (formatClockFromSeconds) ui.liveClock.textContent = formatClockFromSeconds(liveClockSeconds);
    }, 200);
  };

  const stopLiveClock = () => {
    if (liveClockTimer) clearInterval(liveClockTimer);
    liveClockTimer = null;
    liveClockSeconds = null;
  };

  const setLiveClockFromMeta = (meta) => {
    if (!meta || !meta.clock) return;
    if (!meta.clock.includes(':')) return;
    const parts = meta.clock.split(':');
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    if (Number.isNaN(minutes) || Number.isNaN(seconds)) return;
    const value = minutes * 60 + seconds;
    liveClockSeconds = value;
    if (!liveClockTimer) {
      startLiveClock(value);
    }
  };

  const updateMomentumChart = () => {
    const ui = getUI();
    if (!ui.liveMomentum) return;
    const canvas = ui.liveMomentum;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    const values = liveMomentumHistory.slice(-40);
    if (!values.length) return;
    const maxVal = Math.max(12, ...values.map((v) => Math.abs(v)));
    const mid = height / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(width, mid);
    ctx.stroke();

    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--team-primary').trim() || '#4cc3ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    values.forEach((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = mid - (value / maxVal) * (height * 0.4);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  const updateEfficiencyChart = (meta) => {
    const ui = getUI();
    if (!ui.liveEfficiency || !meta || !meta.quarters) return;
    const canvas = ui.liveEfficiency;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const homeQ = meta.quarters.home || [];
    const awayQ = meta.quarters.away || [];
    if (!homeQ.length || !awayQ.length) return;
    const maxVal = Math.max(...homeQ, ...awayQ, 30);
    const padding = 16;
    const barWidth = (width - padding * 2) / (homeQ.length * 2 + (homeQ.length - 1));
    let x = padding;
    const homeColor = getComputedStyle(document.documentElement).getPropertyValue('--team-primary').trim() || '#4cc3ff';
    const awayColor = getComputedStyle(document.documentElement).getPropertyValue('--team-secondary').trim() || '#ffb347';
    for (let i = 0; i < homeQ.length; i += 1) {
      const hVal = homeQ[i];
      const aVal = awayQ[i];
      const hHeight = (hVal / maxVal) * (height - 24);
      const aHeight = (aVal / maxVal) * (height - 24);
      ctx.fillStyle = homeColor;
      ctx.fillRect(x, height - hHeight, barWidth, hHeight);
      ctx.fillStyle = awayColor;
      ctx.fillRect(x + barWidth, height - aHeight, barWidth, aHeight);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillText(`Q${i + 1}`, x, height - 4);
      x += barWidth * 2 + barWidth;
    }
  };

  const pushMomentum = (meta) => {
    if (!meta || typeof meta.homeScore !== 'number' || typeof meta.awayScore !== 'number') return;
    const diff = meta.homeScore - meta.awayScore;
    liveMomentumHistory.push(diff);
    if (liveMomentumHistory.length > 60) liveMomentumHistory.shift();
    updateMomentumChart();
  };

  const triggerMomentumFlash = () => {
    const ui = getUI();
    if (ui.liveMomentum) {
      ui.liveMomentum.classList.remove('flash');
      void ui.liveMomentum.offsetWidth;
      ui.liveMomentum.classList.add('flash');
    }
    if (ui.liveScoreboard) {
      ui.liveScoreboard.classList.remove('flash');
      void ui.liveScoreboard.offsetWidth;
      ui.liveScoreboard.classList.add('flash');
    }
  };

  const updateLiveBanner = (meta) => {
    const ui = getUI();
    const gameState = getState();
    if (!ui.liveBanner || !meta) return;
    const dayLabel = typeof meta.day === 'number' ? `${t ? t('label_round') : 'Rodada'} ${meta.day + 1}` : '';
    const leagueName = meta.league || (gameState && gameState.league ? gameState.league.name : '');
    ui.liveBanner.innerHTML = `
      <div>${dayLabel}${leagueName ? `  ${leagueName}` : ''}</div>
      <span>${meta.homeName} vs ${meta.awayName}</span>
    `;
  };

  const showPlayerOfGame = (player, teamName) => {
    const ui = getUI();
    if (!ui.livePotg) return;
    if (!player) {
      ui.livePotg.classList.add('hidden');
      ui.livePotg.innerHTML = '';
      return;
    }
    ui.livePotg.classList.remove('hidden');
    ui.livePotg.innerHTML = `
      <div class="badge">${t ? t('label_pog') : 'Jogador do Jogo'}</div>
      <div><strong>${player.name}</strong>  ${teamName}</div>
      <div class="muted">${player.points} pts  ${player.rebounds} reb  ${player.assists} ast</div>
    `;
  };

  const renderLiveAdvanced = (meta) => {
    const ui = getUI();
    if (!ui.liveAdvanced) return;
    if (!meta || !meta.stats || !computeTeamTotals || !estimatePossessions || !formatPct) {
      ui.liveAdvanced.innerHTML = '';
      return;
    }
    const homeTotals = computeTeamTotals(meta.stats.home || []);
    const awayTotals = computeTeamTotals(meta.stats.away || []);
    const homePoss = estimatePossessions(meta.homeScore, meta.awayScore, homeTotals.turnovers);
    const awayPoss = estimatePossessions(meta.awayScore, meta.homeScore, awayTotals.turnovers);
    const homeOrtg = (meta.homeScore / homePoss) * 100;
    const awayOrtg = (meta.awayScore / awayPoss) * 100;
    const homeDrtg = (meta.awayScore / homePoss) * 100;
    const awayDrtg = (meta.homeScore / awayPoss) * 100;
    const homeAstPct = homeTotals.assists / Math.max(1, meta.homeScore / 2.2);
    const awayAstPct = awayTotals.assists / Math.max(1, meta.awayScore / 2.2);
    const homeRebPct = homeTotals.rebounds / Math.max(1, homeTotals.rebounds + awayTotals.rebounds);
    const awayRebPct = awayTotals.rebounds / Math.max(1, homeTotals.rebounds + awayTotals.rebounds);

    ui.liveAdvanced.innerHTML = `
      <div class="badge">${t ? t('label_adv_stats') : 'Stats avancadas'}</div>
      <table>
        <thead>
          <tr>
            <th>${t ? t('label_team') : 'Time'}</th>
            <th>${t ? t('label_possessions') : 'Poss'}</th>
            <th>${t ? t('label_ortg') : 'ORTG'}</th>
            <th>${t ? t('label_drtg') : 'DRTG'}</th>
            <th>${t ? t('label_ast_pct') : 'AST%'}</th>
            <th>${t ? t('label_reb_pct') : 'REB%'}</th>
            <th>${t ? t('label_turnovers') : 'TO'}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${meta.homeName}</td>
            <td>${homePoss}</td>
            <td>${homeOrtg.toFixed(1)}</td>
            <td>${homeDrtg.toFixed(1)}</td>
            <td>${formatPct(homeAstPct)}</td>
            <td>${formatPct(homeRebPct)}</td>
            <td>${homeTotals.turnovers}</td>
          </tr>
          <tr>
            <td>${meta.awayName}</td>
            <td>${awayPoss}</td>
            <td>${awayOrtg.toFixed(1)}</td>
            <td>${awayDrtg.toFixed(1)}</td>
            <td>${formatPct(awayAstPct)}</td>
            <td>${formatPct(awayRebPct)}</td>
            <td>${awayTotals.turnovers}</td>
          </tr>
        </tbody>
      </table>
    `;
  };

  const renderLiveFouls = (meta) => {
    const ui = getUI();
    if (!ui.liveFouls) return;
    if (!meta || !meta.stats) {
      ui.liveFouls.innerHTML = '';
      return;
    }
    const all = [
      ...(meta.stats.home || []).map((s) => ({ ...s, team: meta.homeName })),
      ...(meta.stats.away || []).map((s) => ({ ...s, team: meta.awayName }))
    ];
    const topFouls = all
      .filter((s) => typeof s.fouls === 'number')
      .sort((a, b) => b.fouls - a.fouls || b.minutes - a.minutes)
      .slice(0, 8);
    ui.liveFouls.innerHTML = `
      <div class="badge">${t ? t('label_fouls_table') : 'Faltas'}</div>
      <table>
        <thead>
          <tr>
            <th>${t ? t('th_player') : 'Jogador'}</th>
            <th>${t ? t('label_team') : 'Time'}</th>
            <th>F</th>
          </tr>
        </thead>
        <tbody>
          ${topFouls.map((row) => `<tr><td>${row.name}</td><td>${row.team}</td><td>${row.fouls}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  };

  const showHighlights = (highlights) => {
    const ui = getUI();
    if (!ui.liveHighlights) return;
    if (!highlights || !highlights.length) {
      ui.liveHighlights.classList.add('hidden');
      ui.liveHighlights.innerHTML = '';
      return;
    }
    const topPlays = highlights.slice(0, 3);
    ui.liveHighlights.classList.remove('hidden');
    ui.liveHighlights.innerHTML = `
      <div class="badge">${t ? t('label_top_plays') : 'Top plays'}</div>
      <div class="stack">
        ${topPlays.map((item) => `
          <div>
            ${item.playTag ? `<span class="live-tag ${item.playClass || ''}">${item.playTag}</span>` : ''}
            ${item.text}
          </div>
        `).join('')}
      </div>
      <div class="badge">${t ? t('label_highlights') : 'Highlights'}</div>
      <div class="stack">
        ${highlights.slice(0, 6).map((item) => `
          <div>
            ${item.tag ? `<span class="live-tag ${item.tagClass || ''}">${item.tag}</span>` : ''}
            ${item.text}
          </div>
        `).join('')}
      </div>
    `;
  };

  const classifyHighlightType = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes('perimetro') || lower.includes('jumper') || lower.includes('sniper') || lower.includes('3')) {
      return { tag: '3PT', className: 'three' };
    }
    if (lower.includes('enterrad') || lower.includes('dunk')) {
      return { tag: 'DUNK', className: 'dunk' };
    }
    if (lower.includes('defesa') || lower.includes('defense') || lower.includes('locks') || lower.includes('fecha')) {
      return { tag: 'DEF', className: 'defense' };
    }
    return { tag: 'PLAY', className: 'play' };
  };

  const showLiveLoading = () => {
    const ui = getUI();
    if (!ui.liveLoading) return;
    ui.liveLoading.textContent = t ? t('msg_live_loading') : 'Carregando...';
    ui.liveLoading.classList.remove('hidden');
  };

  const hideLiveLoading = () => {
    const ui = getUI();
    if (!ui.liveLoading) return;
    ui.liveLoading.classList.add('hidden');
  };

  const mergeLiveMeta = (lineMeta) => {
    if (!liveContext && !lineMeta) return null;
    if (!liveContext) return lineMeta;
    if (!lineMeta) return liveContext;
    return { ...liveContext, ...lineMeta };
  };

  const renderLiveLines = (lines) => {
    const deps = getDeps();
    const perfMode = deps.isPerformanceMode ? deps.isPerformanceMode() : false;
    const compactMode = deps.isCompactMode ? deps.isCompactMode() : false;
    const limit = perfMode || compactMode ? 120 : 220;
    const source = lines.length > limit ? lines.slice(-limit) : lines;
    const grouped = [];
    source.forEach((line) => {
      const text = getLineText ? getLineText(line) : String(line);
      const last = grouped[grouped.length - 1];
      if (last && last.text === text) {
        last.count += 1;
        return;
      }
      grouped.push({
        line,
        text,
        count: 1
      });
    });
    return grouped.map((item) => {
      const line = item.line;
      const text = item.text;
      const speaker = typeof line === 'object' ? line.speaker : null;
      const tag = typeof line === 'object' ? line.tag : null;
      const tagClass = typeof line === 'object' ? line.tagClass : '';
      const speakerLabel = speaker === 'commentator' ? (t ? t('label_commentator') : 'Comentarista') : (t ? t('label_narrator') : 'Narrador');
      return `
        <div class="live-line">
          ${speaker ? `<span class="live-speaker ${speaker}">${speakerLabel}</span>` : ''}
          ${tag ? `<span class="live-tag ${tagClass}">${tag}</span>` : ''}
          <span class="live-line-text">${text}</span>
          ${item.count > 1 ? `<span class="live-line-count">×${item.count}</span>` : '<span class="live-line-count"></span>'}
        </div>
      `;
    }).join('');
  };

  const playLiveLog = (lines) => {
    const deps = getDeps();
    const ui = getUI();
    if (!lines || !lines.length) {
      if (deps.renderAll) deps.renderAll();
      return;
    }
    if (liveTimer) clearInterval(liveTimer);
    if (deps.setIsSimulating) deps.setIsSimulating(true);
    openLiveOverlay();
    showLiveLoading();
    const startPlayback = () => {
      const perfMode = deps.isPerformanceMode ? deps.isPerformanceMode() : false;
      const optimizeLines = (source) => {
        if (!perfMode) return source;
        const optimized = [];
        source.forEach((line, index) => {
          if (!line || typeof line !== 'object') {
            if (index % 4 === 0) optimized.push(line);
            return;
          }
          if (line.highlight || line.tag || line.speaker === 'narrator') {
            optimized.push(line);
            return;
          }
          if (index % 4 === 0) {
            optimized.push(line);
          }
        });
        const last = source[source.length - 1];
        if (last && optimized[optimized.length - 1] !== last) optimized.push(last);
        return optimized;
      };
      const playbackLines = optimizeLines([...lines]);
      liveLines = playbackLines;
      liveContext = lines.meta || null;
      liveMomentumHistory = [];
      liveLastLead = 0;
      liveHighlights = [];
      lastLineText = '';
      lastLineCount = 0;
      lastLineEl = null;
      if (ui.livePotg) {
        ui.livePotg.classList.add('hidden');
        ui.livePotg.innerHTML = '';
      }
      if (ui.liveHighlights) {
        ui.liveHighlights.classList.add('hidden');
        ui.liveHighlights.innerHTML = '';
      }
      const target = ui.liveOverlayLog || ui.liveSim;
      target.innerHTML = '';
      const firstLineWithMeta = playbackLines.find((item) => item && typeof item === 'object' && item.meta);
      const initialMeta = mergeLiveMeta(firstLineWithMeta ? firstLineWithMeta.meta : null);
      if (initialMeta) {
        updateLiveBanner(initialMeta);
        updateLiveScoreboard(initialMeta);
        setLiveClockFromMeta(initialMeta);
        if (!perfMode) {
          pushMomentum(initialMeta);
          updateEfficiencyChart(initialMeta);
        }
      }
      hideLiveLoading();
      let index = 0;
      const baseInterval = perfMode ? 120 : (deps.getLiveInterval ? deps.getLiveInterval() : 450);
      const step = () => {
        const line = playbackLines[index];
        if (line) {
          const text = getLineText ? getLineText(line) : String(line);
          const speaker = typeof line === 'object' ? line.speaker : null;
          const tag = typeof line === 'object' ? line.tag : null;
          const tagClass = typeof line === 'object' ? line.tagClass : '';
          const speakerLabel = speaker === 'commentator' ? (t ? t('label_commentator') : 'Comentarista') : (t ? t('label_narrator') : 'Narrador');
          const meta = typeof line === 'object' ? mergeLiveMeta(line.meta) : mergeLiveMeta(null);
          if (text === lastLineText && lastLineEl) {
            lastLineCount += 1;
            const countEl = lastLineEl.querySelector('.live-line-count');
            if (countEl) countEl.textContent = `×${lastLineCount}`;
          } else {
            lastLineText = text;
            lastLineCount = 1;
            const content = `
              <div class="live-line">
                ${speaker ? `<span class="live-speaker ${speaker}">${speakerLabel}</span>` : ''}
                ${tag ? `<span class="live-tag ${tagClass}">${tag}</span>` : ''}
                <span class="live-line-text">${text}</span>
                <span class="live-line-count"></span>
              </div>
            `;
            target.insertAdjacentHTML('beforeend', content);
            lastLineEl = target.lastElementChild;
            target.scrollTop = target.scrollHeight;
          }
          if (deps.maybePlaySfxForLine) deps.maybePlaySfxForLine(line);
          if (line && typeof line === 'object' && line.highlight) {
            const playTag = classifyHighlightType(text);
            liveHighlights.push({
              text,
              tag: line.tag,
              tagClass: line.tagClass,
              playTag: playTag.tag,
              playClass: playTag.className
            });
          }
          if (meta) {
            updateLiveScoreboard(meta);
            updateLiveBanner(meta);
            setLiveClockFromMeta(meta);
            if (!perfMode) {
              pushMomentum(meta);
              updateEfficiencyChart(meta);
            }
          }
        }
        index += 1;
        if (index >= playbackLines.length) {
          if (liveTimer) {
            clearTimeout(liveTimer);
            liveTimer = null;
          }
          if (deps.setIsSimulating) deps.setIsSimulating(false);
          stopLiveClock();
          if (liveContext && liveContext.stats && liveContext.stats.stars && liveContext.stats.stars[0]) {
            const star = liveContext.stats.stars[0];
            const gameState = getState();
            const homeTeam = gameState ? gameState.teams.find((t) => t.id === liveContext.homeId) : null;
            const awayTeam = gameState ? gameState.teams.find((t) => t.id === liveContext.awayId) : null;
            const teamName = homeTeam && homeTeam.roster.find((p) => p.id === star.playerId)
              ? homeTeam.name
              : (awayTeam ? awayTeam.name : '');
            showPlayerOfGame(star, teamName);
          }
          renderLiveAdvanced(liveContext);
          renderLiveFouls(liveContext);
          showHighlights(liveHighlights);
          if (deps.renderAll) deps.renderAll();
          return;
        }
        const speed = Math.max(0.25, liveSpeed || 1);
        const interval = Math.max(30, baseInterval / speed);
        liveTimer = setTimeout(step, interval);
      };
      step();
    };
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => setTimeout(startPlayback, 0));
    } else {
      setTimeout(startPlayback, 0);
    }
  };

  const skipLiveLog = () => {
    const deps = getDeps();
    const ui = getUI();
    if (!liveLines.length) {
      closeLiveOverlay();
      return;
    }
    if (liveTimer) {
      clearTimeout(liveTimer);
      liveTimer = null;
    }
    const target = ui.liveOverlayLog || ui.liveSim;
    target.innerHTML = renderLiveLines(liveLines);
    target.scrollTop = target.scrollHeight;
    liveMomentumHistory = [];
    liveHighlights = [];
    liveLines.forEach((line) => {
      if (line && typeof line === 'object' && line.meta) {
        const meta = mergeLiveMeta(line.meta);
        if (meta) pushMomentum(meta);
      }
      if (line && typeof line === 'object' && line.highlight) {
        const text = getLineText ? getLineText(line) : '';
        if (text) {
          const playTag = classifyHighlightType(text);
          liveHighlights.push({
            text,
            tag: line.tag,
            tagClass: line.tagClass,
            playTag: playTag.tag,
            playClass: playTag.className
          });
        }
      }
    });
    const lastLine = liveLines[liveLines.length - 1];
    if (lastLine) {
      if (deps.maybePlaySfxForLine) deps.maybePlaySfxForLine(lastLine);
      const meta = typeof lastLine === 'object' ? mergeLiveMeta(lastLine.meta) : mergeLiveMeta(null);
      if (meta) {
        updateLiveScoreboard(meta);
        updateLiveBanner(meta);
        updateEfficiencyChart(meta);
      }
    }
    stopLiveClock();
    if (liveContext && liveContext.stats && liveContext.stats.stars && liveContext.stats.stars[0]) {
      const star = liveContext.stats.stars[0];
      const gameState = getState();
      const homeTeam = gameState ? gameState.teams.find((t) => t.id === liveContext.homeId) : null;
      const awayTeam = gameState ? gameState.teams.find((t) => t.id === liveContext.awayId) : null;
      const teamName = homeTeam && homeTeam.roster.find((p) => p.id === star.playerId)
        ? homeTeam.name
        : (awayTeam ? awayTeam.name : '');
      showPlayerOfGame(star, teamName);
    }
    renderLiveAdvanced(liveContext);
    renderLiveFouls(liveContext);
    showHighlights(liveHighlights);
    if (deps.setIsSimulating) deps.setIsSimulating(false);
    if (deps.renderAll) deps.renderAll();
  };

  const setLiveSpeed = (value) => {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed) || parsed <= 0) return;
    liveSpeed = parsed;
    const ui = getUI();
    if (ui.liveSpeedValue) {
      ui.liveSpeedValue.textContent = `${liveSpeed}x`;
    }
    if (ui.liveSpeedControls) {
      ui.liveSpeedControls.querySelectorAll('[data-speed]').forEach((btn) => {
        const btnSpeed = parseFloat(btn.dataset.speed);
        btn.classList.toggle('active', btnSpeed === liveSpeed);
      });
    }
  };

  const getLiveSpeed = () => liveSpeed;

  window.AppLive = {
    renderLiveSim,
    openLiveOverlay,
    closeLiveOverlay,
    setTvMode,
    getTvModeEnabled,
    updateLiveScoreboard,
    playLiveLog,
    skipLiveLog,
    setLiveSpeed,
    getLiveSpeed
  };
})();
