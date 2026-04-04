(() => {
  // ------------------------------
  // Core configuration / tables
  // ------------------------------
  const STORAGE_KEY = 'gm-pro-basketball-save-v1';
  const SAVE_VERSION = 2;
  // Data tables moved to js/data.js to keep this file maintainable.

  const {
    getSecondaryPositions,
    getNationalityForLeague,
    buildPlayerName,
    computeOvr,
    getPotentialMax,
    computeEffectiveOvr,
    updatePlayerRole,
    assignTraits,
    generatePlayer
  } = window.GameCore || {};

  const {
    getScoutingLevel,
    ensureScoutBias,
    getScoutingError,
    getScoutedPotentialEstimate,
    formatScoutedPotential,
    getVisiblePotentialMax,
    getRiskLabel,
    getProjectionLabel,
    getRecommendationLabel
  } = window.Scouting || {};

  // ------------------------------
  // UI references (moved to js/ui.js)
  // ------------------------------
  const ui = window.AppUI || {};

  let gameState = null;
  let selectedTeamName = '';
  let selectedLeagueId = '';
  let activeProfileId = null;
  let activeProfileName = null;
  let activeSaveId = null;
  let pendingSaveNotice = null;
  let activeViewId = 'dashboard';
  let previewTimer = null;
  let previewTrackIndex = null;
  let previewRestore = null;
  let teamPickerTimer = null;
  let previewIdleId = null;
  let teamPickerBound = false;
  let lastTeamPickerLeague = null;
  let lastTeamPickerSpecs = null;
  let lastAutoSaveAt = 0;
  let splashAudioPlayed = false;
  let isSimulating = false;
  let liveTimer = null;
  let liveLines = [];
  let liveClockTimer = null;
  let liveClockSeconds = null;
  let liveMomentumHistory = [];
  let liveContext = null;
  let liveLastLead = 0;
  let liveHighlights = [];
  let pendingHotseatSwitch = null;
  const LIVE_LINE_INTERVAL = 450;
  let pendingStartAction = null;
  let forceNewGame = false;
  let customFranchise = null;
  let selectedTacticsPlayerId = null;

  const {
    rand,
    randomChoice,
    createId,
    clamp,
    shuffle,
    weightedChoice
  } = window.AppUtils || {};

  // Core helpers moved to js/game-core.js.

  const AppText = window.AppText || {};
  const {
    t,
    formatMoney,
    logMessage,
    applyTranslations,
    getLanguage,
    setLanguage
  } = AppText;
  const AppOverlay = window.AppOverlay || {};
  const {
    syncOverlayMode,
    openOverlay,
    closeOverlay
  } = AppOverlay;

  const safeOpenOverlay = (overlay) => {
    if (!overlay) return;
    if (typeof openOverlay === 'function') {
      openOverlay(overlay);
      return;
    }
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-modal', 'true');
    document.body.classList.add('overlay-open');
  };

  const safeCloseOverlay = (overlay) => {
    if (!overlay) return;
    if (typeof closeOverlay === 'function') {
      closeOverlay(overlay);
      return;
    }
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    const overlays = [ui.startScreen, ui.overlay, ui.loginOverlay, ui.menuOverlay, ui.liveOverlay, ui.hotseatOverlay]
      .filter(Boolean);
    const anyOpen = overlays.some((el) => !el.classList.contains('hidden'));
    if (!anyOpen) {
      document.body.classList.remove('overlay-open');
    }
  };

  const hideSplashScreen = () => {
    const splash = document.getElementById('splash');
    if (!splash || splash.classList.contains('hidden')) return;
    splash.classList.add('hidden');
    setTimeout(() => {
      if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
    }, 700);
  };

  const shouldPlaySplashAudio = () => {
    if (gameState && gameState.settings) {
      return !!(gameState.settings.musicOn || gameState.settings.sfxOn);
    }
    return true;
  };

  const playSplashAudio = () => {
    if (splashAudioPlayed || !shouldPlaySplashAudio()) return;
    splashAudioPlayed = true;
    if (typeof ensureAudioContext === 'function') ensureAudioContext();
    try {
      const ctx = typeof getAudioContext === 'function' ? getAudioContext() : (window.audioCtx || null);
      if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        ctx.resume().catch(() => {});
      }
    } catch (err) {
      // ignore
    }
    if (typeof playSplashJingle === 'function') {
      playSplashJingle();
      return;
    }
    if (typeof playShortBuzzerSfx === 'function') playShortBuzzerSfx();
    if (typeof playBounceSfx === 'function') setTimeout(() => playBounceSfx(), 120);
    if (typeof playSwishSfx === 'function') setTimeout(() => playSwishSfx(), 240);
  };

  const bindSplashAudio = () => {
    const splash = document.getElementById('splash');
    if (!splash) return;
    splash.addEventListener('pointerdown', playSplashAudio, { once: true });
    document.addEventListener('keydown', playSplashAudio, { once: true });
  };

  const PROFILE_LIST_KEY = 'gm-pro-basketball-profiles';
  const LOGIN_QUICK_KEY = 'basket-manager-login-quick';
  const QUICK_SAVE_ID = '__quick__';
  const QUICK_SAVE_KEY = 'basket-manager-quick-save';

  // ------------------------------
  // Translations (i18n)
  // ------------------------------
  // I18N tables moved to js/i18n.js.

  const teamPreviewCache = new Map();

  const compactMedia = window.matchMedia('(max-width: 720px)');

  const getCompactPreference = () => {
    if (gameState && gameState.settings && typeof gameState.settings.compactMode === 'boolean') {
      return gameState.settings.compactMode;
    }
    return null;
  };

  const applyCompactMode = () => {
    const pref = getCompactPreference();
    const shouldCompact = typeof pref === 'boolean' ? pref : compactMedia.matches;
    document.body.classList.toggle('compact', shouldCompact);
    if (ui.compactMode) {
      ui.compactMode.checked = shouldCompact;
    }
  };

  const applyPerformanceMode = () => {
    const enabled = gameState && gameState.settings ? !!gameState.settings.performanceMode : false;
    document.body.classList.toggle('performance', enabled);
    if (ui.performanceMode) {
      ui.performanceMode.checked = enabled;
    }
  };

  const updatePerformanceUI = () => {
    if (!ui.performanceMode) return;
    const enabled = gameState && gameState.settings ? !!gameState.settings.performanceMode : false;
    ui.performanceMode.checked = enabled;
    document.body.classList.toggle('performance', enabled);
  };

  const ensureSelectionDefaults = () => {
    const leagues = typeof getLeaguesSafe === 'function'
      ? getLeaguesSafe()
      : (typeof LEAGUES !== 'undefined' && Array.isArray(LEAGUES) ? LEAGUES : (window.LEAGUES || []));
    if (!leagues.length) return;
    if (!selectedLeagueId || !leagues.some((l) => l.id === selectedLeagueId)) {
      selectedLeagueId = leagues[0].id;
    }
    const league = leagues.find((l) => l.id === selectedLeagueId) || leagues[0];
    if (!league || !league.teams || !league.teams.length) return;
    const fallbackTeamName = `${league.teams[0].city} ${league.teams[0].nickname}`;
    const exists = league.teams.some((t) => `${t.city} ${t.nickname}` === selectedTeamName);
    if (!selectedTeamName || !exists) {
      selectedTeamName = fallbackTeamName;
    }
  };

  // Start screen / login flow helpers.
  const showStartScreen = () => {
    safeCloseOverlay(ui.loginOverlay);
    safeCloseOverlay(ui.overlay);
    safeCloseOverlay(ui.hotseatOverlay);
    safeOpenOverlay(ui.startScreen);
  };

  const openTeamSelection = () => {
    safeCloseOverlay(ui.startScreen);
    safeCloseOverlay(ui.loginOverlay);
    safeOpenOverlay(ui.overlay);
    ensureSelectionDefaults();
    try {
      renderLeagueCards();
      buildTeamPicker();
      updateFilterClearState();
    } catch (err) {
      console.error(err);
    }
    scheduleTeamPickerRender(true);
  };

  const maybeOpenHotseatOverlay = () => {
    if (!pendingHotseatSwitch || !ui.hotseatOverlay || isSimulating) return;
    const next = gameState.humans[pendingHotseatSwitch.nextIndex];
    if (ui.hotseatNext && next) {
      const team = getTeamById(next.teamId);
      ui.hotseatNext.textContent = `${next.name} • ${team ? team.name : ''}`;
    }
    openOverlay(ui.hotseatOverlay);
  };

  const applyHotseatSwitch = () => {
    if (!pendingHotseatSwitch) return;
    gameState.activeHumanIndex = pendingHotseatSwitch.nextIndex;
    syncActiveHuman();
    pendingHotseatSwitch = null;
    closeOverlay(ui.hotseatOverlay);
    renderAll();
  };

  const queueHotseatSwitch = () => {
    if (!gameState.humans || gameState.humans.length < 2) return;
    const nextIndex = (gameState.activeHumanIndex + 1) % gameState.humans.length;
    pendingHotseatSwitch = { nextIndex };
  };

  const hasActiveHumanGameOnDay = (day) => (
    gameState.schedule.some((g) => g.day === day && (g.home === gameState.userTeamId || g.away === gameState.userTeamId))
  );

  const buildMusicTrackOptions = () => {
    if (!ui.musicTrack) return;
    const tracks = (typeof MUSIC_TRACKS !== 'undefined' && Array.isArray(MUSIC_TRACKS)) ? MUSIC_TRACKS : [];
    if (!tracks.length) {
      ui.musicTrack.innerHTML = '<option value="0">-</option>';
      return;
    }
    ui.musicTrack.innerHTML = tracks.map((track, index) => `
      <option value="${index}">${track.name}${track.vibe ? ` • ${track.vibe}` : ''}</option>
    `).join('');
  };

  const clearPreview = (restore) => {
    if (previewTimer) {
      clearTimeout(previewTimer);
      previewTimer = null;
    }
    if (restore && previewRestore && gameState && gameState.settings) {
      gameState.settings.musicTrack = previewRestore.track;
      gameState.settings.musicOn = previewRestore.musicOn;
      refreshAudioUI();
      if (previewRestore.musicOn) {
        if (typeof startMusicTrack === 'function') startMusicTrack(previewRestore.track);
      } else if (typeof stopMusic === 'function') {
        stopMusic();
      }
    }
    previewRestore = null;
    previewTrackIndex = null;
    renderMusicPlaylist();
  };

  const handlePreviewTrack = (index) => {
    if (!gameState || !gameState.settings) return;
    if (previewTrackIndex === index) {
      clearPreview(true);
      return;
    }
    clearPreview(false);
    previewRestore = {
      track: gameState.settings.musicTrack || 0,
      musicOn: !!gameState.settings.musicOn
    };
    previewTrackIndex = index;
    gameState.settings.musicOn = true;
    gameState.settings.musicTrack = index;
    refreshAudioUI();
    if (typeof startMusicTrack === 'function') startMusicTrack(index);
    renderMusicPlaylist();
    previewTimer = setTimeout(() => clearPreview(true), 12000);
  };

  const buildWaveBars = (track) => {
    if (track.waveBars) return track.waveBars;
    const bars = 14;
    const heights = [];
    for (let i = 0; i < bars; i += 1) {
      const degree = track.melody[i % track.melody.length];
      const base = degree === null || typeof degree === 'undefined' ? 3 : (degree % 7) + 3;
      const height = clamp(base * 3 + (track.tempo % 7), 4, 24);
      heights.push(height);
    }
    track.waveBars = heights.map((h) => `<span style="height:${h}px"></span>`).join('');
    return track.waveBars;
  };

  const renderMusicPlaylist = () => {
    if (!ui.musicPlaylist) return;
    if (ui.menuOverlay && ui.menuOverlay.classList.contains('hidden')) return;
    const current = gameState && gameState.settings ? gameState.settings.musicTrack : 0;
    const tracks = (typeof MUSIC_TRACKS !== 'undefined' && Array.isArray(MUSIC_TRACKS)) ? MUSIC_TRACKS : [];
    if (!tracks.length) {
      ui.musicPlaylist.innerHTML = '<div class="muted">Sem trilhas disponíveis.</div>';
      return;
    }
    ui.musicPlaylist.innerHTML = tracks.map((track, index) => `
      <div class="row">
        <div class="stack">
          <div><strong>${track.name}</strong></div>
          <div class="muted">${track.vibe || '-'} • ${track.tempo} BPM</div>
          <div class="mini-wave">${buildWaveBars(track)}</div>
        </div>
        <div class="row">
          <button class="btn ${previewTrackIndex === index ? 'danger' : ''}" data-action="preview-track" data-track="${index}">
            ${previewTrackIndex === index ? t('btn_preview_stop') : t('btn_preview_play')}
          </button>
          ${current === index ? `<span class="badge">${t('label_current_track')}</span>` : ''}
        </div>
      </div>
    `).join('');
  };

  const renderHotseatPanel = () => {
    if (!ui.hotseatTeam || !ui.hotseatList || !gameState) return;
    const usedTeams = new Set(gameState.humans.map((h) => h.teamId));
    ui.hotseatTeam.innerHTML = gameState.teams
      .filter((team) => !usedTeams.has(team.id))
      .map((team) => `<option value="${team.id}">${team.name}</option>`)
      .join('');
    if (!ui.hotseatTeam.innerHTML) {
      ui.hotseatTeam.innerHTML = '<option value="">-</option>';
    }
    ui.hotseatList.innerHTML = gameState.humans.map((human, index) => {
      const team = getTeamById(human.teamId);
      const isActive = index === gameState.activeHumanIndex;
      return `
        <div class="row">
          <div class="stack">
            <strong>${human.name}</strong>
            <div class="muted">${team ? team.name : '-'}</div>
          </div>
          <button class="btn ${isActive ? 'success' : 'danger'}" data-action="hotseat-remove" data-index="${index}">
            ${isActive ? 'Ativo' : 'Remover'}
          </button>
        </div>
      `;
    }).join('');
  };

  const renderSaveSlots = () => {
    if (!ui.saveSlot) return;
    rebuildSaveMetaFromStorage();
    const profiles = loadProfiles();
    const quickSave = loadQuickSave();
    const allSaves = profiles.flatMap((profile) => (
      StorageAPI.listSaves(profile.id).map((save) => ({
        ...save,
        profileId: profile.id,
        profileName: profile.name || profile.id
      }))
    ));
    if (!allSaves.length) {
      if (quickSave) {
        ui.saveSlot.innerHTML = '<option value="__quick__">Quick Save</option>';
      } else {
        ui.saveSlot.innerHTML = '<option value="">-</option>';
      }
      return;
    }
    const grouped = {};
    allSaves.forEach((save) => {
      if (!grouped[save.profileId]) grouped[save.profileId] = { name: save.profileName, saves: [] };
      grouped[save.profileId].saves.push(save);
    });
    const groupHtml = Object.keys(grouped).map((profileId) => {
      const group = grouped[profileId];
      const options = group.saves.map((save, index) => {
        const label = save.name || `Carreira ${index + 1}`;
        const meta = `${save.team || '-'} • ${save.league || '-'} • T${save.season || 1}`;
        return `<option value="${profileId}::${save.id}">${label} (${meta})</option>`;
      }).join('');
      return `<optgroup label="${group.name}">${options}</optgroup>`;
    }).join('');
    ui.saveSlot.innerHTML = groupHtml;
    if (quickSave) {
      ui.saveSlot.innerHTML += '<option value="__quick__">Quick Save</option>';
    }
    const desired = activeProfileId && activeSaveId ? `${activeProfileId}::${activeSaveId}` : null;
    if (desired && ui.saveSlot.querySelector(`option[value="${desired}"]`)) {
      ui.saveSlot.value = desired;
    } else if (quickSave) {
      ui.saveSlot.value = QUICK_SAVE_ID;
    } else {
      ui.saveSlot.selectedIndex = 0;
    }
  };

  const handleSaveSlotLoad = () => {
    if (!ui.saveSlot || !ui.saveSlot.value) return;
    const loaded = loadSaveFromSlotValue(ui.saveSlot.value);
    if (!loaded) {
      notifyPendingSaveNotice();
      return;
    }
    applyLoadedState(loaded);
    closeOverlay(ui.menuOverlay);
    lastAutoSaveAt = Date.now();
    logMessage('msg_save_loaded');
    notifyPendingSaveNotice();
  };

  const handleSaveSlotNew = () => {
    ensureDefaultProfile();
    if (!activeProfileId) return;
    activeSaveId = StorageAPI.createId();
    pendingStartAction = 'new';
    forceNewGame = true;
    logMessage('msg_save_created');
    openTeamSelection();
  };

  const handleSaveExport = () => {
    ensureDefaultProfile();
    if (!gameState) return;
    StorageAPI.exportState(gameState);
  };

  const handleSaveImport = () => {
    if (ui.saveImportFile) ui.saveImportFile.click();
  };

  const handleSaveImportFile = async (file) => {
    try {
      ensureDefaultProfile();
      const imported = await StorageAPI.importState(file);
      if (!imported) throw new Error('invalid');
      if (!isValidSaveState(imported)) throw new Error('invalid');
      activeSaveId = StorageAPI.createId();
      imported.profileId = activeProfileId;
      imported.saveId = activeSaveId;
      imported.saveName = imported.saveName || `Importado ${new Date().toLocaleDateString('pt-BR')}`;
      gameState = migrateSaveState(imported);
      normalizeLoadedState();
      StorageAPI.saveState(activeProfileId, activeSaveId, gameState);
      updateProfileMeta(gameState);
      lastAutoSaveAt = Date.now();
      renderAll();
      logMessage('msg_save_import_ok');
      notifyPendingSaveNotice();
    } catch (err) {
      logMessage('msg_save_import_fail');
    }
  };

  const handleSaveBackup = () => {
    ensureDefaultProfile();
    if (!gameState || !activeProfileId || !activeSaveId) return;
    StorageAPI.createBackup(activeProfileId, activeSaveId, gameState);
    logMessage('msg_backup_done');
  };

  const handleSaveDelete = () => {
    ensureDefaultProfile();
    if (!ui.saveSlot || !ui.saveSlot.value) return;
    const rawValue = ui.saveSlot.value;
    if (rawValue === QUICK_SAVE_ID) {
      const confirmDelete = confirm(t('msg_save_delete_confirm'));
      if (!confirmDelete) return;
      localStorage.removeItem(QUICK_SAVE_KEY);
      renderSaveSlots();
      return;
    }
    let targetProfileId = activeProfileId;
    let id = rawValue;
    if (rawValue.includes('::')) {
      const parts = rawValue.split('::');
      targetProfileId = parts[0] || targetProfileId;
      id = parts[1] || id;
    }
    if (!targetProfileId || !id) return;
    const confirmDelete = confirm(t('msg_save_delete_confirm'));
    if (!confirmDelete) return;
    StorageAPI.deleteSave(targetProfileId, id);
    if (activeSaveId === id && activeProfileId === targetProfileId) {
      activeSaveId = null;
    }
    if (gameState && gameState.saveId === id) {
      gameState.saveId = null;
      gameState.saveName = null;
      logMessage('msg_save_deleted_active');
    } else {
      logMessage('msg_save_deleted');
    }
    const profileMeta = StorageAPI.getProfileMeta(targetProfileId);
    if (profileMeta && profileMeta.lastSaveId === id) {
      StorageAPI.updateProfileMeta(targetProfileId, { lastSaveId: null });
    }
    renderSaveSlots();
  };

  const handleLoginLoadSave = () => {
    let rawName = (ui.managerNameInput.value || '').trim();
    if (!rawName) {
      const quick = loadQuickSave();
      if (quick && quick.managerName) {
        rawName = quick.managerName;
        ui.managerNameInput.value = rawName;
      } else {
        alert(t('msg_login_name_required'));
        ui.managerNameInput.focus();
        return;
      }
    }
    if (!ui.loginSaveSlot || !ui.loginSaveSlot.value) return;
    const profileId = sanitizeProfileId(rawName);
    let value = ui.loginSaveSlot.value;
    let profileIdFromValue = profileId;
    if (value.includes('::')) {
      const parts = value.split('::');
      profileIdFromValue = parts[0] || profileIdFromValue;
    }
    if (value === QUICK_SAVE_ID) {
      const quick = loadQuickSave();
      if (!quick) {
        alert('Nenhum save encontrado.');
        return;
      }
      activeProfileId = quick.profileId || profileId;
      activeProfileName = quick.managerName || rawName;
      if (ui.managerNameInput) ui.managerNameInput.value = activeProfileName;
      activeSaveId = QUICK_SAVE_ID;
      applyLoadedState(quick);
      closeOverlay(ui.loginOverlay);
      closeOverlay(ui.menuOverlay);
      pendingStartAction = null;
      forceNewGame = false;
      return;
    }
    if (!value.includes('::')) {
      value = `${profileId}::${value}`;
    }
    const loaded = loadSaveFromSlotValue(value);
    if (loaded) {
      if (profileIdFromValue) {
        activeProfileName = getProfileNameById(profileIdFromValue);
        if (ui.managerNameInput) ui.managerNameInput.value = activeProfileName;
      } else {
        activeProfileName = rawName;
      }
      applyLoadedState(loaded);
      closeOverlay(ui.loginOverlay);
      closeOverlay(ui.menuOverlay);
      pendingStartAction = null;
      forceNewGame = false;
      return;
    }
    alert('Nenhum save encontrado.');
  };

  const handleLoginDeleteSave = () => {
    const rawName = (ui.managerNameInput.value || '').trim();
    if (!rawName) {
      alert(t('msg_login_name_required'));
      ui.managerNameInput.focus();
      return;
    }
    if (!ui.loginSaveSlot || !ui.loginSaveSlot.value) return;
    const profileId = sanitizeProfileId(rawName);
    const saveId = ui.loginSaveSlot.value;
    const confirmDelete = confirm(t('msg_save_delete_confirm'));
    if (!confirmDelete) return;
    if (saveId === QUICK_SAVE_ID) {
      localStorage.removeItem(QUICK_SAVE_KEY);
    } else {
      StorageAPI.deleteSave(profileId, saveId);
    }
    if (activeProfileId === profileId && activeSaveId === saveId) {
      activeSaveId = null;
    }
    renderLoginSaveSlots(profileId);
    buildProfileList();
    alert(t('msg_save_deleted'));
  };

  const handleRunTests = () => {
    if (typeof window.runTests !== 'function') return;
    const result = window.runTests();
    if (result && result.summary) {
      logMessage('msg_tests_ok', { value: result.summary });
      const failed = (result.results || []).filter((item) => !item.ok).map((item) => item.name);
      if (failed.length) {
        logMessage('msg_tests_fail', { value: failed.slice(0, 6).join(', ') });
      }
    }
  };

  const handleHotseatAdd = () => {
    if (!gameState || !ui.hotseatName || !ui.hotseatTeam) return;
    const name = ui.hotseatName.value.trim();
    const teamId = ui.hotseatTeam.value;
    if (!name || !teamId) return;
    if (gameState.humans.some((h) => h.teamId === teamId)) {
      logMessage('msg_hotseat_exists');
      return;
    }
    gameState.humans.push({ id: createId(), name, teamId });
    logMessage('msg_hotseat_added', { name, team: getTeamById(teamId).name });
    ui.hotseatName.value = '';
    renderHotseatPanel();
  };

  const handleHotseatRemove = (index) => {
    if (!gameState || !gameState.humans) return;
    if (index === gameState.activeHumanIndex) {
      logMessage('msg_hotseat_active_locked');
      return;
    }
    gameState.humans.splice(index, 1);
    if (gameState.activeHumanIndex >= gameState.humans.length) {
      gameState.activeHumanIndex = 0;
    }
    syncActiveHuman();
    logMessage('msg_hotseat_removed');
    renderHotseatPanel();
  };

  const openLoginOverlay = () => {
    safeCloseOverlay(ui.startScreen);
    safeOpenOverlay(ui.loginOverlay);
    safeCloseOverlay(ui.hotseatOverlay);
    if (ui.managerNameInput) {
      const profiles = loadProfiles();
      const fallback = (profiles && profiles.length ? profiles[0].name : null) || activeProfileName || 'GM';
      if (!ui.managerNameInput.value.trim()) {
        ui.managerNameInput.value = fallback;
      }
      renderLoginSaveSlots(sanitizeProfileId(ui.managerNameInput.value.trim()));
      ui.managerNameInput.focus();
    }
    if (ui.loginQuick) {
      const stored = localStorage.getItem(LOGIN_QUICK_KEY);
      ui.loginQuick.checked = stored ? stored === '1' : true;
    }
    if (ui.managerNameInput) {
      const name = ui.managerNameInput.value.trim();
      renderLoginSaveSlots(name ? sanitizeProfileId(name) : null);
    }
  };

  const updateFanToleranceUI = () => {
    if (!ui.fanTolerance || !ui.fanToleranceValue) return;
    const value = gameState && gameState.settings ? gameState.settings.fanTolerance : 1;
    ui.fanTolerance.value = value;
    ui.fanToleranceValue.textContent = `${value.toFixed(2)}x`;
  };

  const syncCompactUI = () => {
    if (!ui.compactMode) return;
    const pref = getCompactPreference();
    ui.compactMode.checked = typeof pref === 'boolean' ? pref : compactMedia.matches;
  };

  const handleFanToleranceInput = () => {
    if (!ui.fanTolerance || !ui.fanToleranceValue) return;
    const value = parseFloat(ui.fanTolerance.value);
    if (Number.isNaN(value)) return;
    ui.fanToleranceValue.textContent = `${value.toFixed(2)}x`;
    if (gameState && gameState.settings) {
      gameState.settings.fanTolerance = value;
    }
  };

  const sanitizeProfileId = (name) => name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20) || 'gm';

  const getProfileKey = (profileId, saveId) => StorageAPI.getProfileKey(profileId, saveId);

  const loadProfiles = () => StorageAPI.loadProfiles();

  const saveProfiles = (profiles) => StorageAPI.saveProfiles(profiles);

  const updateProfileMeta = (state) => {
    if (!activeProfileId) return;
    const team = state && state.userTeamId ? getTeamById(state.userTeamId) : null;
    StorageAPI.updateProfileMeta(activeProfileId, {
      name: activeProfileName || activeProfileId,
      team: team ? team.name : undefined,
      league: state && state.league ? state.league.name : undefined,
      season: state ? state.season : undefined,
      lastSave: Date.now(),
      lastSaveId: activeSaveId || (state ? state.saveId : undefined)
    });
  };

  const setProfileInfo = () => {
    if (!activeProfileName) {
      ui.profileInfo.textContent = t('no_profile');
      return;
    }
    const displayName = gameState && gameState.managerName ? gameState.managerName : activeProfileName;
    ui.profileInfo.textContent = t('gm_label', { name: displayName });
  };

  const setSaveInfo = () => {
    if (!ui.saveIndicator) return;
    if (!gameState || !gameState.saveName) {
      ui.saveIndicator.textContent = '';
      ui.saveIndicator.classList.add('hidden');
      return;
    }
    ui.saveIndicator.textContent = `Save: ${gameState.saveName}`;
    ui.saveIndicator.classList.remove('hidden');
  };

  const getStorageErrorMessage = () => {
    const err = StorageAPI && typeof StorageAPI.getLastError === 'function' ? StorageAPI.getLastError() : null;
    if (!err) return null;
    const msg = err && err.message ? err.message : String(err);
    if (/quota|exceeded/i.test(msg)) {
      return 'Armazenamento do navegador cheio. Exclua saves antigos ou exporte a carreira.';
    }
    return `Falha ao salvar: ${msg}`;
  };

  const hasAnySavedCareers = () => {
    rebuildSaveMetaFromStorage();
    const profiles = loadProfiles();
    for (let i = 0; i < profiles.length; i += 1) {
      const saves = StorageAPI.listSaves(profiles[i].id);
      if (saves && saves.length) return true;
    }
    return !!loadQuickSave();
  };

  const openStartLoad = () => {
    if (hasAnySavedCareers()) {
      buildProfileList();
      if (ui.loginQuick) {
        ui.loginQuick.checked = false;
        localStorage.setItem(LOGIN_QUICK_KEY, '0');
      }
      openLoginOverlay();
      const quick = loadQuickSave();
      if (quick && ui.managerNameInput && !ui.managerNameInput.value) {
        ui.managerNameInput.value = quick.managerName || quick.profileId || 'GM';
        renderLoginSaveSlots(quick.profileId || sanitizeProfileId(ui.managerNameInput.value));
      }
      return true;
    }
    openTeamSelection();
    return false;
  };

  const getProfileNameById = (profileId) => {
    const profiles = loadProfiles();
    const found = profiles.find((p) => p.id === profileId);
    return found ? found.name || found.id : profileId;
  };

  const loadSaveFromSlotValue = (value) => {
    ensureDefaultProfile();
    if (!value) return null;
    if (value === QUICK_SAVE_ID) {
      return loadQuickSave();
    }
    let profileId = activeProfileId;
    let saveId = value;
    if (value.includes('::')) {
      const parts = value.split('::');
      profileId = parts[0] || profileId;
      saveId = parts[1] || saveId;
    }
    if (profileId && profileId !== activeProfileId) {
      activeProfileId = profileId;
      activeProfileName = getProfileNameById(profileId);
      setProfileInfo();
    }
    activeSaveId = saveId;
    return loadGame(saveId);
  };

  const buildLightTeam = (team) => ({
    id: team.id,
    name: team.name,
    city: team.city,
    nickname: team.nickname,
    colors: team.colors,
    conference: team.conference,
    division: team.division,
    wins: team.wins,
    losses: team.losses,
    budget: team.budget
  });

  const buildLightWorldLeagues = (state) => {
    if (!state) return null;
    const source = Array.isArray(state.worldLeagues) && state.worldLeagues.length
      ? state.worldLeagues
      : (typeof LEAGUES !== 'undefined' ? LEAGUES : []);
    if (!source || !source.length) return null;
    return source.map((league) => ({
      id: league.id,
      name: league.name,
      country: league.country,
      gamesPerTeam: league.gamesPerTeam,
      conferences: league.conferences,
      playoffTeams: league.playoffTeams,
      draftLottery: league.draftLottery,
      teams: (league.teams || []).map((team) => buildLightTeam(team))
    }));
  };

  const prepareStateForSave = () => {
    if (!gameState) return null;
    const payload = {
      ...gameState,
      customFranchise: customFranchise || null,
      worldLeagues: buildLightWorldLeagues(gameState)
    };
    if (Array.isArray(payload.messages) && payload.messages.length > 60) {
      payload.messages = payload.messages.slice(0, 60);
    }
    return payload;
  };

  const syncActiveHuman = () => {
    if (!gameState || !gameState.humans || !gameState.humans.length) return;
    const index = clamp(gameState.activeHumanIndex || 0, 0, gameState.humans.length - 1);
    const human = gameState.humans[index];
    if (!human) return;
    gameState.activeHumanIndex = index;
    gameState.userTeamId = human.teamId;
    gameState.managerName = human.name;
  };

  // Rating helpers moved to js/game-core.js.

  // Scouting helpers moved to js/scouting.js.

  const getPositionFitMultiplier = (player, slotPos) => {
    if (!player || !slotPos) return 1;
    if (player.pos === slotPos) return 1;
    if (player.secondaryPos && player.secondaryPos.includes(slotPos)) return 0.96;
    return 0.9;
  };

  const applyAttributeDelta = (player, attr, delta) => {
    if (!delta) return 0;
    const currentOvr = computeOvr(player);
    const maxPot = getPotentialMax(player);
    let adjusted = delta;
    if (delta > 0) {
      const gap = maxPot - currentOvr;
      if (gap <= 0) return 0;
      const factor = gap < 6 ? 0.4 : gap < 12 ? 0.7 : 1;
      adjusted = Math.max(1, Math.round(delta * factor));
      if (adjusted > gap) adjusted = gap;
    }
    player[attr] = clamp(player[attr] + adjusted, 30, 99);
    return adjusted;
  };

  const pushOvrHistory = (player) => {
    if (!player) return;
    if (!Array.isArray(player.ovrHistory)) player.ovrHistory = [];
    const value = player.ovr;
    const last = player.ovrHistory[player.ovrHistory.length - 1];
    if (last !== value) player.ovrHistory.push(value);
    if (player.ovrHistory.length > 14) {
      player.ovrHistory = player.ovrHistory.slice(-14);
    }
  };

  const getGrowthStage = (player) => {
    if (player.age <= 22) return t('stage_prospect');
    if (player.age <= 27) return t('stage_rising');
    if (player.age <= 31) return t('stage_prime');
    return t('stage_decline');
  };

  const getPotentialProgress = (player, maxOverride = null) => {
    const maxPot = typeof maxOverride === 'number' ? maxOverride : getPotentialMax(player);
    const base = 50;
    const denom = Math.max(1, maxPot - base);
    return clamp(Math.round(((player.ovr - base) / denom) * 100), 0, 100);
  };

  const formatAwardLabel = (award) => {
    if (!award) return '';
    const match = award.match(/(.+?)\sT(\d+)/);
    const base = match ? match[1] : award;
    const seasonPart = match ? `T${match[2]}` : '';
    const map = {
      'All-Star MVP': t('award_allstar_mvp'),
      MVP: t('award_mvp'),
      DPOY: t('award_dpoy'),
      ROY: t('award_roy'),
      Scoring: t('award_scoring'),
      'Finals MVP': t('award_finals_mvp')
    };
    const label = map[base] || base;
    return seasonPart ? `${label} ${seasonPart}` : label;
  };

  // Traits / effective OVR helpers moved to js/game-core.js.

  const {
    getTeamLogoText,
    buildTeamLogoHTML,
    applyTeamTheme,
    resetTeamTheme,
    applyThemeFromTeam
  } = window.Theme || {};

  const safeApplyTeamTheme = (colors = {}) => {
    if (typeof applyTeamTheme === 'function') {
      applyTeamTheme(colors, null);
      return;
    }
    const root = document.documentElement;
    const primary = colors.primary || colors[0] || '#1f2a44';
    const secondary = colors.secondary || colors[1] || '#f2a900';
    root.style.setProperty('--team-primary', primary);
    root.style.setProperty('--team-secondary', secondary);
    root.style.setProperty('--team-primary-soft', `${primary}99`);
  };

  const SPLASH_THEME_KEY = 'bm-last-theme';

  const normalizeThemeColors = (colors = {}) => {
    if (Array.isArray(colors)) {
      return {
        primary: colors[0] || '#1f2a44',
        secondary: colors[1] || '#f2a900'
      };
    }
    return {
      primary: colors.primary || colors[0] || '#1f2a44',
      secondary: colors.secondary || colors[1] || '#f2a900'
    };
  };

  const saveSplashTheme = (colors, teamLabel = '') => {
    if (typeof localStorage === 'undefined') return;
    const palette = normalizeThemeColors(colors);
    const payload = {
      primary: palette.primary,
      secondary: palette.secondary,
      team: teamLabel || '',
      updatedAt: Date.now()
    };
    try {
      localStorage.setItem(SPLASH_THEME_KEY, JSON.stringify(payload));
    } catch (err) {
      // ignore
    }
  };

  const loadSplashTheme = () => {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(SPLASH_THEME_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.primary || !data.secondary) return null;
      return data;
    } catch (err) {
      return null;
    }
  };

  const applyStoredSplashTheme = () => {
    const stored = loadSplashTheme();
    if (!stored) return;
    safeApplyTeamTheme({ primary: stored.primary, secondary: stored.secondary });
  };

  applyStoredSplashTheme();

  const previewThemeFromState = (state) => {
    if (!state || !state.teams || !state.teams.length) return;
    const team = state.teams.find((t) => t.id === state.userTeamId) || null;
    if (!team) return;
    if (typeof applyTeamTheme === 'function') {
      applyTeamTheme(team.colors, team);
    } else {
      safeApplyTeamTheme(team.colors || {});
    }
    saveSplashTheme(team.colors, `${team.city} ${team.nickname}`);
  };

  const previewThemeFromSaveValue = (value) => {
    if (!value) return;
    if (value === QUICK_SAVE_ID) {
      previewThemeFromState(loadQuickSave());
      return;
    }
    let profileId = activeProfileId || null;
    let saveId = value;
    if (value.includes('::')) {
      const parts = value.split('::');
      profileId = parts[0] || profileId;
      saveId = parts[1] || saveId;
    }
    if (!profileId || !saveId) return;
    const state = StorageAPI.loadState(profileId, saveId);
    previewThemeFromState(state);
  };

  const scanSaveKeys = () => {
    const results = [];
    if (typeof localStorage === 'undefined') return results;
    const prefix = `${STORAGE_KEY}:`;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const parts = key.split(':');
      if (parts.length >= 3) {
        results.push({ profileId: parts[1], saveId: parts[2] });
      }
    }
    return results;
  };

  const rebuildSaveMetaFromStorage = () => {
    const entries = scanSaveKeys();
    if (!entries.length) return;
    const profiles = loadProfiles();
    const profileIds = new Set(profiles.map((p) => p.id));
    entries.forEach(({ profileId, saveId }) => {
      const state = StorageAPI.loadState(profileId, saveId);
      if (state) {
        StorageAPI.upsertSaveMeta(profileId, saveId, state);
      }
      if (!profileIds.has(profileId)) {
        profiles.push({ id: profileId, name: profileId });
        profileIds.add(profileId);
      }
    });
    saveProfiles(profiles);
  };

  const loadQuickSave = () => {
    try {
      const raw = localStorage.getItem(QUICK_SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      return null;
    }
  };

  const saveQuickSave = (state) => {
    try {
      localStorage.setItem(QUICK_SAVE_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      return false;
    }
  };

  const applyLoadedState = (loaded) => {
    if (!loaded) return false;
    gameState = loaded;
    normalizeLoadedState();
    const loadedTeam = getTeamById(gameState.userTeamId);
    applyThemeFromTeam(loadedTeam);
    if (loadedTeam) {
      saveSplashTheme(loadedTeam.colors, `${loadedTeam.city} ${loadedTeam.nickname}`);
    }
    refreshAudioUI();
    applyAudioPlayback();
    safeCloseOverlay(ui.startScreen);
    safeCloseOverlay(ui.loginOverlay);
    renderAll();
    renderSaveSlots();
    setProfileInfo();
    setSaveInfo();
    return true;
  };

  const findLatestSaveEntry = () => {
    let profiles = loadProfiles();
    if (!profiles || !profiles.length) {
      rebuildSaveMetaFromStorage();
      profiles = loadProfiles();
    }
    let best = null;
    profiles.forEach((profile) => {
      const saves = StorageAPI.listSaves(profile.id);
      saves.forEach((save) => {
        if (!best || (save.lastSave || 0) > (best.lastSave || 0)) {
          best = { ...save, profileId: profile.id, profileName: profile.name || profile.id };
        }
      });
    });
    if (best) return best;
    const quick = loadQuickSave();
    if (quick) {
      return {
        id: QUICK_SAVE_ID,
        profileId: quick.profileId || activeProfileId,
        profileName: quick.managerName || activeProfileName,
        lastSave: 0
      };
    }
    return null;
  };

  const getLatestSaveId = () => {
    ensureDefaultProfile();
    const entry = findLatestSaveEntry();
    if (!entry) return null;
    if (entry.profileId) {
      activeProfileId = entry.profileId;
      activeProfileName = entry.profileName || entry.profileId;
    }
    return entry.id;
  };

  const loadLatestSave = () => {
    const id = getLatestSaveId();
    if (!id) return null;
    return id === QUICK_SAVE_ID ? loadQuickSave() : loadGame(id);
  };

  const ensureDefaultProfile = () => {
    if (activeProfileId) return;
    let profiles = loadProfiles();
    if (!profiles || !profiles.length) {
      rebuildSaveMetaFromStorage();
      profiles = loadProfiles();
    }
    if (profiles && profiles.length) {
      const sorted = [...profiles].sort((a, b) => (b.lastSave || 0) - (a.lastSave || 0));
      const chosen = sorted[0];
      activeProfileId = chosen.id;
      activeProfileName = chosen.name || chosen.id;
      return;
    }
    activeProfileName = activeProfileName || 'GM';
    activeProfileId = sanitizeProfileId(activeProfileName);
    profiles.push({ id: activeProfileId, name: activeProfileName });
    saveProfiles(profiles);
  };

  const FALLBACK_LEAGUES = [
    {
      id: 'nba',
      name: 'Liga USA',
      country: 'Estados Unidos',
      gamesPerTeam: 82,
      conferences: ['Leste', 'Oeste'],
      playoffTeams: 16,
      draftLottery: true,
      teams: [
        { city: 'New York', nickname: 'Skyliners' },
        { city: 'Los Angeles', nickname: 'Waves' },
        { city: 'Chicago', nickname: 'Forge' },
        { city: 'Miami', nickname: 'Flames' },
        { city: 'Boston', nickname: 'Harbors' }
      ]
    },
    {
      id: 'nbb',
      name: 'Liga Brasil',
      country: 'Brasil',
      gamesPerTeam: 34,
      conferences: ['Unica'],
      playoffTeams: 8,
      draftLottery: false,
      teams: [
        { city: 'Sao Paulo', nickname: 'Titans' },
        { city: 'Rio', nickname: 'Wolves' },
        { city: 'Brasilia', nickname: 'Capitals' },
        { city: 'Minas', nickname: 'Guardians' },
        { city: 'Franca', nickname: 'Kings' }
      ]
    }
  ];
  const FALLBACK_PALETTE = [['#1f2a44', '#f2a900'], ['#2a6fdb', '#72d6c9'], ['#5a3b7a', '#f7b267']];

  const getLeaguesSafe = () => {
    if (typeof window !== 'undefined' && window.LEAGUES && window.LEAGUES.length) return window.LEAGUES;
    if (typeof LEAGUES !== 'undefined' && LEAGUES && LEAGUES.length) return LEAGUES;
    return FALLBACK_LEAGUES;
  };

  const getPaletteSafe = () => {
    if (typeof window !== 'undefined' && window.TEAM_COLOR_PALETTE && window.TEAM_COLOR_PALETTE.length) {
      return window.TEAM_COLOR_PALETTE;
    }
    if (typeof TEAM_COLOR_PALETTE !== 'undefined' && TEAM_COLOR_PALETTE && TEAM_COLOR_PALETTE.length) {
      return TEAM_COLOR_PALETTE;
    }
    return FALLBACK_PALETTE;
  };

  const getSafeTeamLogoText = (city, nickname) => {
    if (typeof getTeamLogoText === 'function') return getTeamLogoText(city, nickname);
    const a = (city || '').trim()[0] || '';
    const b = (nickname || '').trim()[0] || '';
    return `${a}${b}`.toUpperCase() || 'BM';
  };

  const buildSafeTeamLogoHTML = (text, colors, compact) => {
    if (typeof buildTeamLogoHTML === 'function') {
      return buildTeamLogoHTML(text, colors, compact);
    }
    const primary = colors && colors[0] ? colors[0] : '#1f2a44';
    const secondary = colors && colors[1] ? colors[1] : '#f2a900';
    return `
      <div class="logo-fallback" style="background: linear-gradient(140deg, ${primary}, ${secondary});">
        <span>${text}</span>
      </div>
    `;
  };

  // ------------------------------
  // Audio (UI hooks; engine in js/audio.js)
  // ------------------------------

  const refreshAudioUI = () => {
    if (!gameState || !gameState.settings) return;
    if (ui.musicToggle) ui.musicToggle.checked = gameState.settings.musicOn;
    if (ui.sfxToggle) ui.sfxToggle.checked = gameState.settings.sfxOn;
    if (ui.ambientToggle) ui.ambientToggle.checked = gameState.settings.ambientOn;
    if (ui.musicVolume) ui.musicVolume.value = gameState.settings.musicVolume;
    if (ui.sfxVolume) ui.sfxVolume.value = gameState.settings.sfxVolume;
    if (ui.ambientVolume) ui.ambientVolume.value = gameState.settings.ambientVolume;
    if (ui.musicTrack) ui.musicTrack.value = String(gameState.settings.musicTrack || 0);
    if (typeof setMusicVolume === 'function') setMusicVolume(gameState.settings.musicVolume);
    if (typeof setSfxVolume === 'function') setSfxVolume(gameState.settings.sfxVolume);
    if (typeof setAmbientVolume === 'function') setAmbientVolume(gameState.settings.ambientVolume);
    renderMusicPlaylist();
  };

  const applyAudioPlayback = () => {
    if (!gameState || !gameState.settings) return;
    if (gameState.settings.musicOn) {
      if (typeof startMusicTrack === 'function') {
        startMusicTrack(gameState.settings.musicTrack || 0);
      }
    } else if (typeof stopMusic === 'function') {
      stopMusic();
    }
    if (gameState.settings.ambientOn) {
      if (typeof ensureAudioContext === 'function') ensureAudioContext();
      if (typeof startAmbientCrowd === 'function') startAmbientCrowd();
    } else if (typeof stopAmbientCrowd === 'function') {
      stopAmbientCrowd();
    }
  };

  const maybePlaySfxForLine = (line) => {
    if (typeof shouldPlayAudio !== 'function' || !shouldPlayAudio('sfx')) return;
    if (typeof ensureAudioContext !== 'function') return;
    ensureAudioContext();
    const ctx = typeof getAudioContext === 'function' ? getAudioContext() : (window.audioCtx || null);
    if (!ctx) return;
    const text = getLineText(line).toLowerCase();
    if (text.includes('bola ao alto') || text.includes('tip-off') || text.includes('salto inicial')) {
      playBounceSfx();
      return;
    }
    if (text.startsWith('q') && text.includes(':')) {
      playShortBuzzerSfx();
      return;
    }
    if (text.includes('intervalo') || text.includes('halftime')) {
      playCrowdSfx();
      return;
    }
    if (text.startsWith('final') || text.includes('final:')) {
      playBuzzerSfx();
      return;
    }
    if (text.includes('falta') || text.includes('foul')) {
      playWhistleSfx();
      return;
    }
    if (text.includes('destaque') || text.includes('star:') || text.includes('figura')) {
      playSwishSfx();
      return;
    }
    if (text.includes('perimetro') || text.includes('sniper') || text.includes('3pt') || text.includes('3 pts') || text.includes('3 pontos') || text.includes('bola de tres')) {
      playSwishSfx();
      return;
    }
    if (text.includes('enterrad') || text.includes('dunk')) {
      playDunkSfx();
      return;
    }
    if (text.includes('defesa') || text.includes('block') || text.includes('fecha a porta')) {
      playClapSfx();
      playRimSfx();
      return;
    }
    if (text.includes('assistenc') || text.includes('armacao')) {
      playSneakerSfx();
      return;
    }
    if (text.includes('rebote')) {
      playBounceSfx();
      playThudSfx();
      return;
    }
    if (text.includes('transicao') || text.includes('fastbreak')) {
      playSneakerSfx();
      return;
    }
    if (text.includes('parcial') || text.includes('run') || text.includes('parcial de')) {
      playCrowdVariant();
      if (Math.random() < 0.3) playStompSfx();
      return;
    }
    if (text.includes('clutch') || text.includes('virada') || text.includes('lideranca')) {
      playCrowdVariant();
    }
    if (text.includes('grande vantagem') || text.includes('blowout')) {
      playGroanSfx();
    }
    if (Math.random() < 0.08) {
      playBounceSfx();
    }
  };

  const getFormationLabel = (id) => {
    const found = FORMATIONS.find((item) => item.id === id);
    return found ? found.label : id;
  };

  const getStrategyLabel = (id) => {
    const found = STRATEGIES.find((item) => item.id === id);
    return found ? found.label : id;
  };

  const calculatePayroll = (team) => team.roster.reduce((acc, player) => acc + player.salary, 0);

  const computeMonthlyIncome = (team) => {
    const financeSkill = gameState.gmSkills ? gameState.gmSkills.finance : 1;
    const financeStaff = gameState.staff ? gameState.staff.finance : 0;
    const financeBonus = 1 + (financeSkill - 1) * 0.05 + financeStaff * 0.03;
    const arenaLevel = team.facilities ? team.facilities.arena : team.arenaLevel || 1;
    const base = 2.2 + team.fanBase / 55 + team.fanMood / 70 + arenaLevel * 0.6;
    return parseFloat((base * financeBonus).toFixed(2));
  };

  const applyMonthlyFinance = () => {
    gameState.teams.forEach((team) => {
      const payroll = calculatePayroll(team);
      const monthlyCost = parseFloat((payroll / 12).toFixed(2));
      const income = computeMonthlyIncome(team);
      const net = parseFloat((income - monthlyCost).toFixed(2));
      team.budget = parseFloat((team.budget + net).toFixed(2));
      if (team.budget < -30) team.budget = -30;
      if (team.id === gameState.userTeamId) {
        logMessage('msg_monthly_finance', {
          income: formatMoney(income),
          cost: formatMoney(monthlyCost),
          net: formatMoney(net),
          budget: formatMoney(team.budget)
        });
        if (team.budget <= 5 && (gameState.day - (team.lastBudgetAlertDay || -99) >= 14)) {
          logMessage('msg_budget_low', { budget: formatMoney(team.budget) });
          team.lastBudgetAlertDay = gameState.day;
        }
      }
    });
  };

  // ------------------------------
  // Morale / fan feedback
  // ------------------------------
  const updateMoraleAfterGame = (team, stats, won) => {
    const day = gameState.day;
    stats.forEach((stat) => {
      const player = team.roster.find((p) => p.id === stat.playerId);
      if (!player) return;
      let delta = 0;
      if (stat.minutes >= 28) delta += 1;
      if (stat.minutes <= 8) delta -= 2;
      if (stat.points >= 20) delta += 1;
      if (stat.points <= 4 && stat.minutes >= 12) delta -= 1;
      delta += won ? 1 : -1;
      player.morale = clamp((player.morale || 70) + delta, 20, 99);

      const prevState = player.moraleState || 'neutral';
      const nextState = player.morale <= 35 ? 'unhappy' : player.morale >= 70 ? 'happy' : 'neutral';
      const canAlert = day - (player.lastMoraleAlertDay || -99) >= 7;
      if (team.id === gameState.userTeamId && canAlert && nextState !== prevState) {
        if (nextState === 'unhappy') {
          logMessage('msg_player_unhappy', { name: player.name });
          player.lastMoraleAlertDay = day;
        }
        if (nextState === 'neutral' && prevState === 'unhappy') {
          logMessage('msg_player_calm', { name: player.name });
          player.lastMoraleAlertDay = day;
        }
      }
      if (team.id === gameState.userTeamId && stat.minutes <= 8 && player.starLevel >= 1 && canAlert) {
        logMessage('msg_minutes_request', { name: player.name });
        player.lastMoraleAlertDay = day;
      }
      player.moraleState = nextState;
    });
  };

  const updateFanFeedback = (team) => {
    if (team.id !== gameState.userTeamId) return;
    const day = gameState.day;
    if (team.lastFanAlertDay && day - team.lastFanAlertDay < 7) return;
    const tolerance = gameState.settings && typeof gameState.settings.fanTolerance === 'number'
      ? gameState.settings.fanTolerance
      : 1;
    const unhappyThreshold = Math.round(40 / tolerance);
    const happyThreshold = Math.round(80 * tolerance);
    if (team.fanMood <= unhappyThreshold) {
      logMessage('msg_fans_unhappy', { mood: team.fanMood });
      team.lastFanAlertDay = day;
    } else if (team.fanMood >= happyThreshold) {
      logMessage('msg_fans_happy', { mood: team.fanMood });
      team.lastFanAlertDay = day;
    }
  };

  const ensureRotationSlots = (team) => {
    if (!team.rotation) team.rotation = { starters: [] };
    if (!team.rotation.slots) team.rotation.slots = {};
    const slots = team.rotation.slots;
    const healthy = team.roster.filter((p) => p.injuryDays === 0);
    const healthyIds = new Set(healthy.map((p) => p.id));
    Object.keys(slots).forEach((pos) => {
      if (!healthyIds.has(slots[pos])) delete slots[pos];
    });
    const used = new Set(Object.values(slots).filter(Boolean));
    const fitScore = (player, pos) => {
      if (player.pos === pos) return 2;
      if (player.secondaryPos && player.secondaryPos.includes(pos)) return 1;
      return 0;
    };
    POSITION_SLOTS.forEach((pos) => {
      if (slots[pos]) return;
      const candidate = healthy
        .filter((player) => !used.has(player.id))
        .sort((a, b) => {
          const fit = fitScore(b, pos) - fitScore(a, pos);
          if (fit !== 0) return fit;
          return b.ovr - a.ovr;
        })[0];
      if (candidate) {
        slots[pos] = candidate.id;
        used.add(candidate.id);
      }
    });
    team.rotation.starters = POSITION_SLOTS
      .map((pos) => slots[pos])
      .filter(Boolean)
      .slice(0, 5);
  };

  const ensureRotation = (team) => {
    ensureRotationSlots(team);
    const healthy = team.roster.filter((p) => p.injuryDays === 0);
    const starters = team.rotation.starters.filter((id) => healthy.some((p) => p.id === id));
    const candidates = healthy
      .filter((p) => !starters.includes(p.id))
      .sort((a, b) => computeOvr(b) - computeOvr(a));

    while (starters.length < 5 && candidates.length) {
      starters.push(candidates.shift().id);
    }
    team.rotation.starters = starters;
  };

  const computeTeamOvr = (team) => {
    ensureRotation(team);
    const slots = team.rotation.slots || {};
    const starters = POSITION_SLOTS
      .map((pos) => {
        const player = team.roster.find((p) => p.id === slots[pos]);
        if (!player || player.injuryDays > 0) return null;
        return { player, pos };
      })
      .filter(Boolean);
    const bench = team.roster.filter((p) => !team.rotation.starters.includes(p.id) && p.injuryDays === 0);
    const startersAvg = starters.reduce((acc, item) => (
      acc + computeEffectiveOvr(item.player) * getPositionFitMultiplier(item.player, item.pos)
    ), 0) / Math.max(starters.length, 1);
    const benchAvg = bench.reduce((acc, p) => acc + computeEffectiveOvr(p), 0) / Math.max(bench.length, 1);
    return Math.round(startersAvg * 0.75 + benchAvg * 0.25);
  };

  // Player generator moved to js/game-core.js.

  const buildRotationSlotsFromRoster = (roster) => {
    const slots = {};
    const used = new Set();
    const fitScore = (player, pos) => {
      if (player.pos === pos) return 2;
      if (player.secondaryPos && player.secondaryPos.includes(pos)) return 1;
      return 0;
    };
    POSITION_SLOTS.forEach((pos) => {
      const candidate = roster
        .filter((player) => !used.has(player.id))
        .sort((a, b) => {
          const fit = fitScore(b, pos) - fitScore(a, pos);
          if (fit !== 0) return fit;
          return b.ovr - a.ovr;
        })[0];
      if (candidate) {
        slots[pos] = candidate.id;
        used.add(candidate.id);
      }
    });
    return slots;
  };

  const createTeam = (league, spec, index) => {
    const confCount = league.conferences.length;
    const conf = confCount > 1 ? league.conferences[index < league.teams.length / 2 ? 0 : 1] : 'Unica';
    const colors = spec.colors || TEAM_COLOR_PALETTE[index % TEAM_COLOR_PALETTE.length];
    const name = `${spec.city} ${spec.nickname}`;
    const tacticalProfile = randomChoice(TACTICAL_PROFILES);
    const roster = [];
    const starSlots = shuffle([...POSITIONS]).slice(0, 2);
    POSITIONS.forEach((pos) => {
      const boost = starSlots.includes(pos) ? rand(8, 14) : 0;
      roster.push(generatePlayer(pos, [19, 32], 50, boost, league.id));
      roster.push(generatePlayer(pos, [20, 34], 48, 0, league.id));
    });
    roster.push(generatePlayer('SG', [20, 33], 46, 0, league.id));
    roster.push(generatePlayer('PF', [20, 33], 46, 0, league.id));

    roster.forEach((player) => {
      player.ovr = computeOvr(player);
      player.seasonStartOvr = player.ovr;
      player.seasonStartAttrs = {
        attack: player.attack,
        defense: player.defense,
        physical: player.physical,
        shooting: player.shooting,
        passing: player.passing
      };
      player.lastTrainingGain = 0;
      player.lastTrainingAttr = null;
      player.ovrHistory = [player.ovr];
    });

    const sorted = [...roster].sort((a, b) => b.ovr - a.ovr);
    const starters = sorted.slice(0, 5).map((p) => p.id);
    const slots = buildRotationSlotsFromRoster(roster);

    return {
      id: createId(),
      name,
      city: spec.city,
      nickname: spec.nickname,
      colors: { primary: colors[0], secondary: colors[1] },
      coach: `${randomChoice(FIRST_NAMES)} ${randomChoice(LAST_NAMES)}`,
      leagueId: league.id,
      conf,
      strategy: 'balanced',
      budget: rand(90, 140),
      fanBase: rand(55, 90),
      fanMood: rand(60, 85),
      lastFanAlertDay: -99,
      lastBudgetAlertDay: -99,
      arenaLevel: 1,
      wins: 0,
      losses: 0,
      facilities: {
        training: 1,
        medical: 1,
        scouting: 1,
        arena: 1
      },
      roster,
      tacticalProfile,
      tactics: {
        formation: tacticalProfile ? tacticalProfile.formation : 'balanced',
        strategy: tacticalProfile ? tacticalProfile.strategy : 'half',
        pace: 0,
        defense: 0
      },
      rotation: {
        starters,
        slots,
        focusMinutes: 34
      }
    };
  };

  const createPreviewPlayer = (pos, base, leagueId) => {
    const nationality = typeof getNationalityForLeague === 'function'
      ? getNationalityForLeague(leagueId)
      : (typeof randomChoice === 'function' && typeof NATIONALITIES !== 'undefined' ? randomChoice(NATIONALITIES) : 'USA');
    const name = typeof buildPlayerName === 'function'
      ? buildPlayerName(nationality)
      : `${randomChoice(FIRST_NAMES)} ${randomChoice(LAST_NAMES)}`;
    const jitter = () => rand(-4, 4);
    const player = {
      id: createId(),
      name,
      pos,
      secondaryPos: [],
      nationality,
      age: rand(21, 31),
      attack: clamp(base + jitter(), 45, 90),
      defense: clamp(base + jitter(), 45, 90),
      physical: clamp(base + jitter(), 45, 90),
      shooting: clamp(base + jitter(), 45, 90),
      passing: clamp(base + jitter(), 45, 90),
      energy: 95,
      morale: 70,
      injuryDays: 0,
      salary: 0,
      contractYears: 0,
      starLevel: 0,
      scoring: 0
    };
    player.ovr = computeOvr(player);
    player.starLevel = player.ovr >= 84 ? 3 : player.ovr >= 78 ? 2 : player.ovr >= 72 ? 1 : 0;
    player.scoring = player.shooting / 100;
    return player;
  };

  const createPreviewTeam = (league, spec, index) => {
    const confCount = league.conferences.length;
    const conf = confCount > 1 ? league.conferences[index < league.teams.length / 2 ? 0 : 1] : 'Unica';
    const colors = spec.colors || TEAM_COLOR_PALETTE[index % TEAM_COLOR_PALETTE.length];
    const name = `${spec.city} ${spec.nickname}`;
    const tacticalProfile = randomChoice(TACTICAL_PROFILES);
    const base = clamp(66 + rand(-4, 4) + (index % 6), 58, 78);
    const roster = POSITION_SLOTS.map((pos) => createPreviewPlayer(pos, base + rand(-2, 3), league.id));
    const starters = roster.map((p) => p.id);
    const slots = {};
    roster.forEach((player) => { slots[player.pos] = player.id; });
    return {
      id: `preview-${league.id}-${index}`,
      name,
      city: spec.city,
      nickname: spec.nickname,
      colors: { primary: colors[0], secondary: colors[1] },
      coach: '-',
      leagueId: league.id,
      conf,
      strategy: 'balanced',
      budget: 0,
      fanBase: 70,
      fanMood: 70,
      lastFanAlertDay: -99,
      lastBudgetAlertDay: -99,
      arenaLevel: 1,
      wins: 0,
      losses: 0,
      facilities: { training: 1, medical: 1, scouting: 1, arena: 1 },
      roster,
      tacticalProfile,
      tactics: {
        formation: tacticalProfile ? tacticalProfile.formation : 'balanced',
        strategy: tacticalProfile ? tacticalProfile.strategy : 'half',
        pace: 0,
        defense: 0
      },
      rotation: {
        starters,
        slots,
        focusMinutes: 34
      },
      preview: true
    };
  };

  const createSchedule = (teams, league) => {
    const games = [];
    const baseGamesPerTeam = (teams.length - 1) * 2;
    const extraSeriesNeeded = {};
    const targetGames = league.gamesPerTeam || baseGamesPerTeam;
    const extraSeries = Math.max(0, Math.round((targetGames - baseGamesPerTeam) / 2));
    teams.forEach((team) => {
      extraSeriesNeeded[team.id] = extraSeries;
    });

    for (let i = 0; i < teams.length; i += 1) {
      for (let j = i + 1; j < teams.length; j += 1) {
        games.push({ home: teams[i].id, away: teams[j].id, played: false });
        games.push({ home: teams[j].id, away: teams[i].id, played: false });
      }
    }

    const addExtraSeries = (confTeams) => {
      const pool = [];
      confTeams.forEach((team) => {
        for (let i = 0; i < extraSeriesNeeded[team.id]; i += 1) {
          pool.push(team.id);
        }
      });
      shuffle(pool);

      let attempts = 0;
      while (pool.length >= 2 && attempts < 5000) {
        attempts += 1;
        const a = pool.pop();
        const b = pool.pop();
        if (!a || !b) break;
        if (a === b) {
          pool.unshift(a, b);
          shuffle(pool);
          continue;
        }
        games.push({ home: a, away: b, played: false });
        games.push({ home: b, away: a, played: false });
        extraSeriesNeeded[a] -= 1;
        extraSeriesNeeded[b] -= 1;
      }
    };

    if (extraSeries > 0) {
      if (league.conferences.length > 1) {
        league.conferences.forEach((conf) => {
          addExtraSeries(teams.filter((team) => team.conf === conf));
        });
      } else {
        addExtraSeries(teams);
      }
    }

    for (let i = games.length - 1; i > 0; i -= 1) {
      const j = rand(0, i);
      [games[i], games[j]] = [games[j], games[i]];
    }

    const gamesPerDay = 8;
    return games.map((game, index) => ({
      ...game,
      day: Math.floor(index / gamesPerDay),
      scoreHome: 0,
      scoreAway: 0,
      stats: null
    }));
  };

  const createFreeAgents = (count = 25, leagueId = null) => {
    return Array.from({ length: count }, (_, i) => {
      const boost = i < 2 ? rand(6, 10) : 0;
      return generatePlayer(randomChoice(POSITIONS), [19, 35], 45, boost, leagueId);
    });
  };

  const createDraftPool = (count = 30, leagueId = null) => {
    const pool = Array.from({ length: count }, (_, i) => {
      const boost = i < 5 ? rand(8, 14) : i < 12 ? rand(4, 8) : 0;
      return generatePlayer(randomChoice(POSITIONS), [18, 22], 46, boost, leagueId);
    });
    return pool.sort((a, b) => computeOvr(b) - computeOvr(a));
  };

  const buildDraftOrder = () => {
    const standings = gameState.teams
      .map((team) => ({ id: team.id, wins: team.wins }))
      .sort((a, b) => a.wins - b.wins);
    if (gameState.league && gameState.league.draftLottery) {
      const lotteryTeams = standings.slice(0, 14);
      const weights = [14, 14, 14, 12, 10, 9, 7, 6, 5, 4, 3, 2, 2, 1];
      const pool = [];
      lotteryTeams.forEach((team, index) => {
        for (let i = 0; i < weights[index]; i += 1) pool.push(team.id);
      });
      const topPicks = [];
      while (topPicks.length < 4 && pool.length) {
        const pickId = pool.splice(rand(0, pool.length - 1), 1)[0];
        if (!topPicks.includes(pickId)) topPicks.push(pickId);
      }
      const remaining = lotteryTeams.map((t) => t.id).filter((id) => !topPicks.includes(id));
      return [...topPicks, ...remaining, ...standings.slice(14).map((t) => t.id)];
    }
    return standings.map((item) => item.id);
  };

  const buildRivalries = (teams) => {
    const pairs = [];
    const pool = shuffle([...teams]);
    for (let i = 0; i < pool.length - 1 && pairs.length < 6; i += 2) {
      pairs.push({ a: pool[i].id, b: pool[i + 1].id });
    }
    return pairs;
  };

  const buildPickAssets = (teams, season) => teams.flatMap((team) => ([
    {
      id: createId(),
      season,
      round: 1,
      originalTeamId: team.id,
      ownerTeamId: team.id
    },
    {
      id: createId(),
      season,
      round: 2,
      originalTeamId: team.id,
      ownerTeamId: team.id
    }
  ]));

  const getPickAssetsForTeam = (teamId, season) => (
    gameState.pickAssets.filter((pick) => pick.ownerTeamId === teamId && pick.season === season)
  );

  const getPickAssetById = (pickId) => gameState.pickAssets.find((pick) => pick.id === pickId);

  const formatPickLabel = (pick) => {
    const original = getTeamById(pick.originalTeamId);
    const name = original ? original.name : t('label_unknown_team');
    return `T${pick.season} R${pick.round} (${name})`;
  };
  if (window.AppMarket) {
    window.AppMarket.getPickAssetsForTeam = getPickAssetsForTeam;
    window.AppMarket.getPickAssetById = getPickAssetById;
    window.AppMarket.formatPickLabel = formatPickLabel;
  } else {
    window.AppMarket = {
      getPickAssetsForTeam,
      getPickAssetById,
      formatPickLabel
    };
  }

  const getPickValue = (pick, strategy = 'balanced') => {
    const original = getTeamById(pick.originalTeamId);
    const teamOvr = original ? computeTeamOvr(original) : 72;
    const base = pick.round === 1 ? 18 : 8;
    let value = clamp(base + (78 - teamOvr) * 0.35, 4, 28);
    if (strategy === 'rebuild') value *= 1.2;
    if (strategy === 'contender') value *= 0.85;
    return value;
  };

  const startDraft = () => {
    if (gameState.market.draftPool.length === 0) {
      gameState.market.draftPool = createDraftPool(60, gameState.league ? gameState.league.id : null);
    }
    const order = buildDraftOrder();
    gameState.draftState = {
      round: 1,
      pick: 1,
      order,
      totalPicks: order.length * 2,
      picks: []
    };
  };

  const getDraftTeamForPick = (draftState) => {
    const roundIndex = draftState.round - 1;
    const order = roundIndex % 2 === 0 ? draftState.order : [...draftState.order].reverse();
    const originalTeamId = order[draftState.pick - 1];
    if (!gameState.pickAssets) return originalTeamId;
    const pick = gameState.pickAssets.find((item) => (
      item.season === gameState.season
      && item.round === draftState.round
      && item.originalTeamId === originalTeamId
    ));
    return pick ? pick.ownerTeamId : originalTeamId;
  };

  const autoDraftPick = (teamId) => {
    const team = getTeamById(teamId);
    const available = gameState.market.draftPool;
    if (!available.length) return null;
    const countForPos = (pos) => team.roster.filter((p) => (
      p.pos === pos || (p.secondaryPos && p.secondaryPos.includes(pos))
    )).length;
    const needBonus = (pos) => {
      const count = countForPos(pos);
      if (count <= 1) return 8;
      if (count === 2) return 4;
      if (count === 3) return 1;
      return 0;
    };
    let bestIndex = 0;
    let bestScore = -Infinity;
    available.forEach((player, index) => {
      const base = player.ovr || computeOvr(player);
      const bonus = needBonus(player.pos);
      const ageBonus = player.age <= 20 ? 1.5 : player.age <= 22 ? 0.8 : 0;
      const score = base + bonus + ageBonus;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    const pick = available.splice(bestIndex, 1)[0];
    team.roster.push(pick);
    team.roster = team.roster.slice(0, 15);
    return pick;
  };

  const advanceDraft = (userPickId = null) => {
    if (!gameState.draftState) return;
    const draftState = gameState.draftState;
    const totalTeams = draftState.order.length;

    const finalizePick = (teamId, player) => {
      draftState.picks.push({
        round: draftState.round,
        pick: draftState.pick,
        teamId,
        playerName: player.name
      });
    };

    while (draftState.round <= 2) {
      const teamId = getDraftTeamForPick(draftState);
      if (teamId === gameState.userTeamId && !userPickId) {
        break;
      }
      if (teamId === gameState.userTeamId && userPickId) {
        const playerIndex = gameState.market.draftPool.findIndex((p) => p.id === userPickId);
        if (playerIndex < 0) return;
        const player = gameState.market.draftPool.splice(playerIndex, 1)[0];
        getTeamById(teamId).roster.push(player);
        finalizePick(teamId, player);
        userPickId = null;
      } else {
        const player = autoDraftPick(teamId);
        if (!player) break;
        finalizePick(teamId, player);
      }

      draftState.pick += 1;
      if (draftState.pick > totalTeams) {
        draftState.round += 1;
        draftState.pick = 1;
      }
    }

    if (draftState.round > 2) {
      logMessage('msg_draft_end');
      gameState.draftState = null;
    }
  };

  const simulateFullDraft = () => {
    if (!gameState.draftState) startDraft();
    while (gameState.draftState) {
      const teamId = getDraftTeamForPick(gameState.draftState);
      if (teamId === gameState.userTeamId) {
        const player = autoDraftPick(teamId);
        if (player) {
          advanceDraft(player.id);
        }
      } else {
        advanceDraft();
      }
    }
  };

  const generateObjectives = (team, league = null) => {
    const teamOvr = computeTeamOvr(team);
    const games = league ? league.gamesPerTeam : 82;
    const targetWins = clamp(Math.round(games * 0.38 + teamOvr * 0.45), Math.round(games * 0.3), Math.round(games * 0.75));
    const reachPlayoffs = teamOvr >= 68;
    const targetBudget = Math.round(team.budget + rand(6, 16));
    return {
      targetWins,
      reachPlayoffs,
      targetBudget
    };
  };

  const buildWorldLeagues = () => {
    return LEAGUES.map((league) => ({
      ...league,
      teams: getLeagueSpecs(league).map((spec, index) => createTeam(league, spec, index))
    }));
  };

  const getLeagueSpecs = (league) => {
    const specs = [...league.teams];
    if (customFranchise && customFranchise.leagueId === league.id) {
      specs[specs.length - 1] = {
        city: customFranchise.city,
        nickname: customFranchise.nickname,
        colors: customFranchise.colors
      };
    }
    return specs;
  };

  // ------------------------------
  // Game state creation / loading
  // ------------------------------
  const createInitialState = (teamName, leagueId) => {
    const worldLeagues = buildWorldLeagues();
    const currentLeague = worldLeagues.find((league) => league.id === leagueId) || worldLeagues[0];
    const teams = currentLeague.teams;
    const userTeam = teams.find((team) => team.name === teamName) || teams[0];
    const managerName = activeProfileName || 'GM';
    teams.forEach((team) => updateTeamStrategy(team));

    const saveId = activeSaveId || StorageAPI.createId();
    const saveName = `Carreira ${StorageAPI.listSaves(activeProfileId || '')?.length + 1 || 1}`;
    activeSaveId = saveId;
    return {
      version: SAVE_VERSION,
      season: 1,
      phase: 'regular',
      day: 0,
      managerName,
      profileId: activeProfileId,
      saveId,
      saveName,
      userTeamId: userTeam.id,
      humans: [
        {
          id: createId(),
          name: managerName,
          teamId: userTeam.id
        }
      ],
      activeHumanIndex: 0,
      league: {
        id: currentLeague.id,
        name: currentLeague.name,
        country: currentLeague.country,
        gamesPerTeam: currentLeague.gamesPerTeam,
        conferences: currentLeague.conferences,
        playoffTeams: currentLeague.playoffTeams,
        draftLottery: currentLeague.draftLottery
      },
      teams,
      worldLeagues,
      worldLeaguesHistory: [],
      schedule: createSchedule(teams, currentLeague),
      draftState: null,
      rivalries: buildRivalries(teams),
      awardsHistory: [],
      seasonRecaps: [],
      allStar: {
        season: 1,
        done: false,
        history: []
      },
      customFranchise: customFranchise || null,
      gmSkills: {
        scouting: 1,
        negotiation: 1,
        development: 1,
        finance: 1
      },
      skillPoints: 0,
      staff: {
        offense: 0,
        defense: 0,
        shooting: 0,
        strength: 0,
        finance: 0
      },
      sponsor: null,
      objectives: generateObjectives(userTeam, currentLeague),
      international: {
        next: null,
        history: []
      },
      settings: {
        language: typeof getLanguage === 'function' ? getLanguage() : 'pt',
        fanTolerance: 1,
        rosterSort: 'ovr',
        rosterFilter: 'all',
        musicOn: true,
        sfxOn: true,
        musicVolume: 0.35,
        sfxVolume: 0.6,
        musicTrack: 0,
        performanceMode: false,
        ambientOn: false,
        ambientVolume: 0.2
      },
      market: {
        freeAgents: createFreeAgents(25, currentLeague.id),
        draftPool: []
      },
      pickAssets: buildPickAssets(teams, 1),
      tradeInbox: [],
      tradeHistory: [],
      messages: [t('msg_welcome')],
      performanceStats: {
        simDayTimes: [],
        lastSimMs: 0
      },
      progressLog: [],
      trainingLog: [],
      trainingFocus: null,
      trainingFilter: 'all',
      trainingSort: 'progress'
    };
  };

  const computeChecksum = (state) => {
    try {
      const json = JSON.stringify(state, (key, value) => (key === '__checksum' ? undefined : value));
      let hash = 5381;
      for (let i = 0; i < json.length; i += 1) {
        hash = ((hash << 5) + hash) + json.charCodeAt(i);
        hash &= 0xffffffff;
      }
      return (hash >>> 0).toString(16);
    } catch (err) {
      return '';
    }
  };

  const scheduleChecksumValidation = (profileId, saveId, state) => {
    if (!state || !state.__checksum) return;
    const runner = () => {
      const expected = computeChecksum(state);
      if (expected !== state.__checksum) {
        pendingSaveNotice = pendingSaveNotice || 'msg_save_checksum_warn';
        notifyPendingSaveNotice();
      }
    };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(runner, { timeout: 2000 });
    } else {
      setTimeout(runner, 0);
    }
  };

  const isValidSaveState = (state) => {
    if (!state || typeof state !== 'object') return false;
    if (!Array.isArray(state.teams) || !state.teams.length) return false;
    if (!state.league || !state.league.id) return false;
    if (!state.userTeamId) return false;
    if (typeof state.season !== 'number') return false;
    return true;
  };

  const migrateSaveState = (state) => {
    if (!state || typeof state !== 'object') return state;
    const currentVersion = typeof state.version === 'number' ? state.version : 1;
    state.version = currentVersion;
    if (state.version < SAVE_VERSION) {
      state.version = SAVE_VERSION;
      pendingSaveNotice = pendingSaveNotice || 'msg_save_migrated';
    }
    return state;
  };

  const notifyPendingSaveNotice = () => {
    if (!pendingSaveNotice) return;
    if (gameState) {
      logMessage(pendingSaveNotice);
    } else {
      alert(t(pendingSaveNotice));
    }
    pendingSaveNotice = null;
  };
  const saveGame = (force = false) => {
    ensureDefaultProfile();
    if (!gameState || !activeProfileId) {
      alert('Inicie uma carreira antes de salvar.');
      return;
    }
    const now = Date.now();
    const autoSaveMs = gameState.settings && gameState.settings.performanceMode ? 15000 : 8000;
    if (!force && now - lastAutoSaveAt < autoSaveMs) return;
    lastAutoSaveAt = now;
    if (!activeSaveId) {
      activeSaveId = StorageAPI.createId();
      gameState.saveId = activeSaveId;
      gameState.saveName = gameState.saveName || `Carreira ${StorageAPI.listSaves(activeProfileId).length + 1}`;
    }
    gameState.managerName = activeProfileName || gameState.managerName;
    gameState.profileId = activeProfileId;
    gameState.saveId = activeSaveId;
    gameState.version = SAVE_VERSION;
    const payload = prepareStateForSave();
    if (!payload) return;
    payload.saveId = activeSaveId;
    payload.profileId = activeProfileId;
    payload.managerName = gameState.managerName;
    payload.version = SAVE_VERSION;
    payload.__checksum = computeChecksum(payload);
    let payloadSize = null;
    try {
      payloadSize = JSON.stringify(payload).length;
    } catch (err) {
      const errorMsg = getStorageErrorMessage() || 'Falha ao preparar o save.';
      if (ui.saveStatus) ui.saveStatus.textContent = errorMsg;
      alert(errorMsg);
      return;
    }
    let saved = false;
    try {
      saved = StorageAPI.saveState(activeProfileId, activeSaveId, payload);
    } catch (err) {
      saved = false;
    }
    if (!saved) {
      const quickSaved = saveQuickSave(payload);
      if (quickSaved) {
        activeSaveId = QUICK_SAVE_ID;
        if (ui.saveStatus) {
          ui.saveStatus.textContent = `Quick Save em ${new Date().toLocaleTimeString('pt-BR')}`;
        }
      } else {
        logMessage('msg_save_storage_fail');
        const errorMsg = getStorageErrorMessage();
        if (ui.saveStatus && errorMsg) {
          ui.saveStatus.textContent = errorMsg;
        }
        if (errorMsg) alert(errorMsg);
      }
      return;
    }
    updateProfileMeta(gameState);
    if (ui.saveStatus) {
      const sizeLabel = payloadSize ? ` • ${(payloadSize / 1024).toFixed(0)} KB` : '';
      ui.saveStatus.textContent = `Salvo em ${new Date().toLocaleTimeString('pt-BR')}${sizeLabel}`;
    }
    setSaveInfo();
    renderSaveSlots();
  };

  const loadGame = (saveId = null) => {
    ensureDefaultProfile();
    if (!activeProfileId) return null;
    if (!saveId && !activeSaveId) {
      const profileMeta = StorageAPI.getProfileMeta(activeProfileId);
      if (profileMeta && profileMeta.lastSaveId) {
        activeSaveId = profileMeta.lastSaveId;
      }
    }
    const id = saveId || activeSaveId;
    if (!id || id === QUICK_SAVE_ID) {
      const quick = loadQuickSave();
      if (!quick) return null;
      return migrateSaveState(quick);
    }
    const parsed = StorageAPI.loadState(activeProfileId, id);
    if (!parsed) {
      const quick = loadQuickSave();
      if (quick && isValidSaveState(quick)) {
        return migrateSaveState(quick);
      }
      return null;
    }
    if (!isValidSaveState(parsed)) {
      const backup = StorageAPI.loadLatestBackup(activeProfileId, id);
      if (backup && isValidSaveState(backup)) {
        pendingSaveNotice = pendingSaveNotice || 'msg_save_restored';
        const migrated = migrateSaveState(backup);
        activeSaveId = id;
        migrated.saveId = id;
        return migrated;
      }
      pendingSaveNotice = pendingSaveNotice || 'msg_save_corrupt';
      return null;
    }
    const migrated = migrateSaveState(parsed);
    activeSaveId = id;
    migrated.saveId = id;
    scheduleChecksumValidation(activeProfileId, id, migrated);
    return migrated;
  };

  const normalizeLoadedState = () => {
    if (!gameState) return;
    if (gameState.customFranchise) {
      customFranchise = gameState.customFranchise;
    }
    if (typeof gameState.version !== 'number') {
      gameState.version = SAVE_VERSION;
    } else if (gameState.version < SAVE_VERSION) {
      gameState.version = SAVE_VERSION;
    }
    if (!gameState.objectives) {
      gameState.objectives = generateObjectives(getTeamById(gameState.userTeamId), gameState.league);
    }
    if (!gameState.international) {
      gameState.international = { next: null, history: [] };
    }
    if (!gameState.draftState) {
      gameState.draftState = null;
    }
    if (!gameState.progressLog) {
      gameState.progressLog = [];
    }
    if (!gameState.trainingLog) {
      gameState.trainingLog = [];
    }
    if (!gameState.trainingFocus) {
      gameState.trainingFocus = null;
    }
    if (!gameState.trainingFilter) {
      gameState.trainingFilter = 'all';
    }
    if (!gameState.trainingSort) {
      gameState.trainingSort = 'progress';
    }
    if (!gameState.performanceStats) {
      gameState.performanceStats = { simDayTimes: [], lastSimMs: 0 };
    }
    if (!gameState.settings) {
      gameState.settings = {
        language: 'pt',
        fanTolerance: 1,
        rosterSort: 'ovr',
        rosterFilter: 'all',
        musicOn: true,
        sfxOn: true,
        musicVolume: 0.35,
        sfxVolume: 0.6,
        musicTrack: 0,
        performanceMode: false,
        ambientOn: false,
        ambientVolume: 0.2
      };
    }
    if (typeof gameState.settings.fanTolerance !== 'number') {
      gameState.settings.fanTolerance = 1;
    }
    if (!gameState.settings.rosterSort) {
      gameState.settings.rosterSort = 'ovr';
    }
    if (!gameState.settings.rosterFilter) {
      gameState.settings.rosterFilter = 'all';
    }
    if (typeof gameState.settings.musicOn !== 'boolean') {
      gameState.settings.musicOn = true;
    }
    if (typeof gameState.settings.sfxOn !== 'boolean') {
      gameState.settings.sfxOn = true;
    }
    if (typeof gameState.settings.musicVolume !== 'number') {
      gameState.settings.musicVolume = 0.35;
    }
    if (typeof gameState.settings.sfxVolume !== 'number') {
      gameState.settings.sfxVolume = 0.6;
    }
    if (typeof gameState.settings.musicTrack !== 'number') {
      gameState.settings.musicTrack = 0;
    }
    if (typeof gameState.settings.performanceMode !== 'boolean') {
      gameState.settings.performanceMode = false;
    }
    if (typeof gameState.settings.ambientOn !== 'boolean') {
      gameState.settings.ambientOn = false;
    }
    if (typeof gameState.settings.ambientVolume !== 'number') {
      gameState.settings.ambientVolume = 0.2;
    }
    if (!gameState.saveId) {
      gameState.saveId = activeSaveId || StorageAPI.createId();
    }
    if (!gameState.saveName) {
      gameState.saveName = `Carreira ${StorageAPI.listSaves(activeProfileId || '').length + 1}`;
    }
    activeSaveId = gameState.saveId;
    if (typeof setLanguage === 'function') {
      setLanguage(gameState.settings.language || 'pt');
    }
    if (!gameState.worldLeagues) {
      const world = buildWorldLeagues();
      const current = world.find((league) => gameState.league && league.id === gameState.league.id) || world[0];
      current.teams = gameState.teams;
      gameState.worldLeagues = world;
    }
    if (!gameState.rivalries) {
      gameState.rivalries = buildRivalries(gameState.teams);
    }
    if (!gameState.awardsHistory) {
      gameState.awardsHistory = [];
    }
    if (!gameState.seasonRecaps) {
      gameState.seasonRecaps = [];
    }
    if (!gameState.worldLeaguesHistory) {
      gameState.worldLeaguesHistory = [];
    }
    if (!gameState.allStar) {
      gameState.allStar = { season: gameState.season, done: false, history: [] };
    }
    if (!gameState.gmSkills) {
      gameState.gmSkills = { scouting: 1, negotiation: 1, development: 1, finance: 1 };
    }
    if (typeof gameState.skillPoints !== 'number') {
      gameState.skillPoints = 0;
    }
    if (!gameState.staff) {
      gameState.staff = { offense: 0, defense: 0, shooting: 0, strength: 0, finance: 0 };
    }
    if (!gameState.sponsor) {
      gameState.sponsor = null;
    }
    if (!gameState.tradeInbox) {
      gameState.tradeInbox = [];
    }
    if (!gameState.tradeHistory) {
      gameState.tradeHistory = [];
    }
    if (!gameState.trainingLog) {
      gameState.trainingLog = [];
    }
    if (!gameState.humans || !gameState.humans.length) {
      gameState.humans = [
        {
          id: createId(),
          name: gameState.managerName || activeProfileName || 'GM',
          teamId: gameState.userTeamId
        }
      ];
    }
    if (typeof gameState.activeHumanIndex !== 'number') {
      gameState.activeHumanIndex = 0;
    }
    syncActiveHuman();
    gameState.teams.forEach((team) => {
      if (!team.facilities) {
        team.facilities = { training: 1, medical: 1, scouting: 1, arena: 1 };
      }
      if (typeof team.facilities.arena !== 'number') {
        team.facilities.arena = 1;
      }
      if (typeof team.fanBase !== 'number') team.fanBase = rand(55, 90);
      if (typeof team.fanMood !== 'number') team.fanMood = rand(60, 85);
      if (typeof team.lastFanAlertDay !== 'number') team.lastFanAlertDay = -99;
      if (typeof team.lastBudgetAlertDay !== 'number') team.lastBudgetAlertDay = -99;
      if (typeof team.arenaLevel !== 'number') team.arenaLevel = 1;
      if (!team.coach) team.coach = `${randomChoice(FIRST_NAMES)} ${randomChoice(LAST_NAMES)}`;
      if (!team.tacticalProfile) {
        team.tacticalProfile = randomChoice(TACTICAL_PROFILES);
      }
      if (!team.tactics) {
        team.tactics = {
          formation: team.tacticalProfile ? team.tacticalProfile.formation : 'balanced',
          strategy: team.tacticalProfile ? team.tacticalProfile.strategy : 'half',
          pace: 0,
          defense: 0
        };
      }
      if (!team.rotation) {
        team.rotation = { starters: [], focusMinutes: 34 };
      }
      if (!team.rotation.slots) {
        team.rotation.slots = buildRotationSlotsFromRoster(team.roster);
      }
      team.roster.forEach((player) => {
        if (typeof player.energy !== 'number') player.energy = rand(70, 100);
        if (typeof player.injuryDays !== 'number') player.injuryDays = 0;
        if (!player.nationality) {
          const leagueId = team.leagueId || (gameState.league ? gameState.league.id : null);
          player.nationality = getNationalityForLeague(leagueId);
        }
        if (!player.archetype) player.archetype = randomChoice(ARCHETYPES).label;
        if (typeof player.scoring !== 'number') player.scoring = clamp((player.shooting + player.attack) / 200, 0.2, 0.95);
        if (!player.secondaryPos) player.secondaryPos = getSecondaryPositions(player.pos);
        if (typeof player.scoutBias !== 'number') player.scoutBias = parseFloat((Math.random() * 2 - 1).toFixed(2));
        if (typeof player.potentialMax !== 'number') {
          const basePot = typeof player.potential === 'number' ? player.potential : rand(60, 90);
          player.potential = basePot;
          player.potentialMax = clamp(basePot + rand(2, 6), basePot, 99);
        }
        if (player.potential > player.potentialMax) {
          player.potentialMax = player.potential;
        }
        if (!player.awards) player.awards = [];
        if (typeof player.optionType === 'undefined') player.optionType = null;
        if (!player.seasonStats) {
          player.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, min: 0, tov: 0, fouls: 0 };
        }
        if (typeof player.seasonStats.tov !== 'number') player.seasonStats.tov = 0;
        if (typeof player.seasonStats.fouls !== 'number') player.seasonStats.fouls = 0;
        if (typeof player.morale !== 'number') player.morale = rand(60, 90);
        if (!player.moraleState) player.moraleState = 'neutral';
        if (typeof player.lastMoraleAlertDay !== 'number') player.lastMoraleAlertDay = -99;
        if (typeof player.starLevel !== 'number') {
          player.starLevel = player.ovr >= 85 ? 3 : player.ovr >= 78 ? 2 : player.ovr >= 70 ? 1 : 0;
        }
        if (!player.role) player.role = player.starLevel >= 3 ? 'Estrela' : player.starLevel === 2 ? 'Titular' : player.starLevel === 1 ? 'Rotacao' : 'Prospecto';
        if (typeof player.seasonStartOvr !== 'number') player.seasonStartOvr = player.ovr;
        if (typeof player.lastTrainingGain !== 'number') player.lastTrainingGain = 0;
        if (!player.seasonStartAttrs) {
          player.seasonStartAttrs = {
            attack: player.attack,
            defense: player.defense,
            physical: player.physical,
            shooting: player.shooting,
            passing: player.passing
          };
        }
        if (typeof player.lastTrainingAttr !== 'string') player.lastTrainingAttr = null;
        if (!Array.isArray(player.ovrHistory) || !player.ovrHistory.length) {
          player.ovrHistory = [player.ovr];
        } else {
          const last = player.ovrHistory[player.ovrHistory.length - 1];
          if (last !== player.ovr) player.ovrHistory.push(player.ovr);
        }
        player.ovr = computeOvr(player);
        updatePlayerRole(player);
        assignTraits(player);
      });
      ensureRotation(team);
    });
    if (gameState.market) {
      const marketLeagueId = gameState.league ? gameState.league.id : null;
      if (Array.isArray(gameState.market.freeAgents)) {
        gameState.market.freeAgents.forEach((player) => {
          if (!player.nationality) player.nationality = getNationalityForLeague(marketLeagueId);
        });
      }
      if (Array.isArray(gameState.market.draftPool)) {
        gameState.market.draftPool.forEach((player) => {
          if (!player.nationality) player.nationality = getNationalityForLeague(marketLeagueId);
        });
      }
    }
    updateLeagueStrategies();
    if (!gameState.pickAssets || !gameState.pickAssets.length) {
      gameState.pickAssets = buildPickAssets(gameState.teams, gameState.season);
    }
  };

  const addMessage = (text) => {
    gameState.messages.unshift(`[Dia ${gameState.day}] ${text}`);
    if (gameState.messages.length > 40) {
      gameState.messages.pop();
    }
  };
  if (window.AppTextDeps) {
    window.AppTextDeps.addMessage = addMessage;
    window.AppTextDeps.getTvModeEnabled = () => (window.AppLive && window.AppLive.getTvModeEnabled ? window.AppLive.getTvModeEnabled() : false);
  } else {
    window.AppTextDeps = {
      addMessage,
      getTvModeEnabled: () => (window.AppLive && window.AppLive.getTvModeEnabled ? window.AppLive.getTvModeEnabled() : false)
    };
  }

  const getTeamById = (id) => gameState.teams.find((team) => team.id === id);

  const applyTacticModifiers = (team) => {
    const formation = FORMATIONS.find((item) => item.id === team.tactics.formation) || FORMATIONS[0];
    const strategy = STRATEGIES.find((item) => item.id === team.tactics.strategy) || STRATEGIES[0];
    return {
      attack: formation.atk + strategy.atk,
      defense: formation.def + strategy.def,
      pace: formation.pace + strategy.pace
    };
  };

  const applyFatigueAndInjury = (team, stats, isUserTeam) => {
    const staff = gameState.staff || { strength: 0 };
    stats.forEach((stat) => {
      const player = team.roster.find((p) => p.id === stat.playerId);
      if (!player || player.injuryDays > 0) return;
      const fatigue = Math.round(stat.minutes / 10) + rand(0, 2);
      player.energy = clamp(player.energy - fatigue, 0, 100);
      const baseRisk = player.energy < 45 ? 0.08 : 0.02;
      const injuryRisk = Math.max(0.005, baseRisk - staff.strength * 0.01);
      if (Math.random() < injuryRisk) {
        player.injuryDays = rand(3, 14);
        if (isUserTeam) {
          logMessage('msg_injury', { name: player.name, days: player.injuryDays });
          if (player.injuryDays >= 10) {
            logMessage('msg_injury_severe', { name: player.name, days: player.injuryDays });
          }
        }
      }
    });
  };

  const applyDailyRecovery = () => {
    gameState.teams.forEach((team) => {
      const medicalBonus = team.facilities ? team.facilities.medical : 1;
      const staff = gameState.staff || { strength: 0 };
      team.roster.forEach((player) => {
        if (player.injuryDays > 0) {
          player.injuryDays -= medicalBonus >= 3 ? 2 : 1;
          if (player.injuryDays < 0) player.injuryDays = 0;
          player.energy = clamp(player.energy + 2 + medicalBonus + staff.strength, 0, 100);
          if (player.injuryDays === 0 && team.id === gameState.userTeamId) {
            logMessage('msg_medical_clear', { name: player.name });
          }
        } else {
          player.energy = clamp(player.energy + 3 + medicalBonus + staff.strength, 0, 100);
        }
      });
      ensureRotation(team);
    });
  };

  const applyWeeklyProgression = () => {
    gameState.teams.forEach((team) => {
      const facilityBonus = team.facilities ? team.facilities.training : 1;
      const gmDev = gameState.gmSkills ? gameState.gmSkills.development : 1;
      const staff = gameState.staff || { offense: 0, defense: 0, shooting: 0, strength: 0, finance: 0 };
      team.roster.forEach((player) => {
        const beforeOvr = player.ovr;
        if (player.injuryDays > 0) return;
        const ageFactor = player.age <= 24 ? 2 : player.age <= 28 ? 1 : -1;
        const potFactor = Math.max(0, getPotentialMax(player) - 60) / 22;
        const base = rand(0, 1) + ageFactor + Math.round(potFactor);
        const delta = Math.max(-2, Math.min(4, Math.round(base + facilityBonus - 1 + (gmDev - 1) * 0.6)));
        if (delta === 0) return;
        const attrs = ['attack', 'defense', 'physical', 'shooting', 'passing'];
        for (let i = 0; i < staff.offense; i += 1) attrs.push('attack');
        for (let i = 0; i < staff.defense; i += 1) attrs.push('defense');
        for (let i = 0; i < staff.shooting; i += 1) attrs.push('shooting');
        for (let i = 0; i < staff.strength; i += 1) attrs.push('physical');
        const pick = randomChoice(attrs);
        const applied = applyAttributeDelta(player, pick, delta);
        if (applied !== 0) {
          player.ovr = computeOvr(player);
          updatePlayerRole(player);
          assignTraits(player);
          if (team.id === gameState.userTeamId && applied > 0) {
            gameState.progressLog.unshift(`${player.name} +${applied} em ${pick.toUpperCase()}`);
          }
        }
        if (player.ovr !== beforeOvr) {
          pushOvrHistory(player);
        }
      });
    });
    if (gameState.progressLog.length > 12) {
      gameState.progressLog = gameState.progressLog.slice(0, 12);
    }
    generateTradeOffers();
  };

  const splitScore = (total) => {
    const weights = [rand(18, 30), rand(18, 30), rand(18, 30), rand(18, 30)];
    const sum = weights.reduce((acc, v) => acc + v, 0);
    const quarters = weights.map((w) => Math.round((w / sum) * total));
    const adjust = total - quarters.reduce((acc, v) => acc + v, 0);
    quarters[0] += adjust;
    return quarters;
  };

  const {
    buildHighlightLine,
    buildLiveLine,
    getLineText,
    formatClock,
    formatClockFromSeconds
  } = window.LiveUtils || {};

  const pickTacticEvent = (team) => {
    if (!team || !team.tactics) return null;
    const { formation, strategy } = team.tactics;
    if (strategy === 'fast' || formation === 'pace') return { key: 'live_play_fastbreak', tag: 'FAST', className: 'fast' };
    if (strategy === 'zone') return { key: 'live_play_zone_stop', tag: 'ZONE', className: 'zone' };
    if (formation === 'switch' || strategy === 'press') return { key: 'live_play_switch', tag: 'SWITCH', className: 'switch' };
    if (strategy === 'iso') return { key: 'live_play_iso', tag: 'ISO', className: 'iso' };
    if (formation === 'inside') return { key: 'live_play_paint', tag: 'PAINT', className: 'paint' };
    if (strategy === 'drop') return { key: 'live_play_zone_stop', tag: 'ZONE', className: 'zone' };
    return null;
  };

  const parseClock = (clockStr) => {
    if (!clockStr || typeof clockStr !== 'string') return null;
    const parts = clockStr.split(':').map((v) => parseInt(v, 10));
    if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
    return parts[0] * 60 + parts[1];
  };

  const distributeQuarterPoints = (total) => {
    const partA = rand(25, 40);
    const partB = rand(25, 40);
    const partC = 100 - partA - partB;
    const a = Math.round(total * (partA / 100));
    const b = Math.round(total * (partB / 100));
    const c = total - a - b;
    return [a, b, c];
  };

  const buildLiveNarrative = (home, away, homeScore, awayScore, stats, pace) => {
    const lines = [];
    const homeQ = splitScore(homeScore);
    const awayQ = splitScore(awayScore);
    const metaBase = {
      homeName: home.name,
      awayName: away.name
    };
    const timeoutState = {
      home: 7,
      away: 7
    };
    let foulState = {
      home: 0,
      away: 0
    };

    const applyFoulsTimeouts = () => {
      foulState = {
        home: clamp(foulState.home + rand(0, 2), 0, 9),
        away: clamp(foulState.away + rand(0, 2), 0, 9)
      };
      if (timeoutState.home > 0 && Math.random() < 0.35) timeoutState.home -= 1;
      if (timeoutState.away > 0 && Math.random() < 0.35) timeoutState.away -= 1;
    };

    const buildMeta = (quarter, clock, homeScoreNow, awayScoreNow) => ({
      ...metaBase,
      quarter,
      clock,
      homeScore: homeScoreNow,
      awayScore: awayScoreNow,
      homeTimeouts: timeoutState.home,
      awayTimeouts: timeoutState.away,
      homeFouls: foulState.home,
      awayFouls: foulState.away
    });
    lines.push(buildLiveLine(
      t('live_tipoff', { home: home.name, away: away.name }),
      buildMeta(1, formatClock(12, 0), 0, 0),
      'narrator',
      null,
      '',
      true
    ));
    if (pace >= 1.1) {
      lines.push(buildLiveLine(t('live_pace_fast'), buildMeta(1, formatClock(10, 30), 0, 0), 'commentator'));
    } else if (pace <= 0.95) {
      lines.push(buildLiveLine(t('live_pace_slow'), buildMeta(1, formatClock(10, 30), 0, 0), 'commentator'));
    }

    let homeTotal = 0;
    let awayTotal = 0;
    let prevLead = 0;

    for (let i = 0; i < 4; i += 1) {
      const quarter = i + 1;
      foulState = { home: 0, away: 0 };
      const [homeEarly, homeMid, homeLate] = distributeQuarterPoints(homeQ[i]);
      const [awayEarly, awayMid, awayLate] = distributeQuarterPoints(awayQ[i]);
      const clockEarly = formatClock(9, rand(10, 50));
      const clockMid = formatClock(6, rand(5, 50));
      const clockLate = formatClock(2, rand(5, 50));

      homeTotal += homeEarly;
      awayTotal += awayEarly;
      applyFoulsTimeouts();
      const tacticTeam = Math.random() < 0.5 ? home : away;
      const tacticEvent = pickTacticEvent(tacticTeam);
      if (tacticEvent) {
        lines.push(buildLiveLine(
          t(tacticEvent.key, { team: tacticTeam.name }),
          buildMeta(quarter, clockEarly, homeTotal, awayTotal),
          'narrator',
          tacticEvent.tag,
          tacticEvent.className,
          true
        ));
      }

      homeTotal += homeMid;
      awayTotal += awayMid;
      applyFoulsTimeouts();
      const diffMid = homeTotal - awayTotal;
      if (Math.abs(diffMid) >= 8 && Math.random() < 0.6) {
        lines.push(buildLiveLine(
          t('live_run', {
            team: diffMid > 0 ? home.name : away.name,
            run: `${rand(8, 14)}-${rand(0, 4)}`
          }),
          buildMeta(quarter, clockMid, homeTotal, awayTotal),
          'commentator',
          null,
          '',
          true
        ));
      }

      homeTotal += homeLate;
      awayTotal += awayLate;
      applyFoulsTimeouts();
      const diffLate = homeTotal - awayTotal;
      const quarterTotal = homeQ[i] + awayQ[i];
      if (Math.abs(diffLate) >= 10) {
        lines.push(buildLiveLine(
          t('live_quarter_dominate', { team: diffLate > 0 ? home.name : away.name, q: quarter }),
          buildMeta(quarter, clockLate, homeTotal, awayTotal),
          'commentator',
          null,
          '',
          true
        ));
      } else if (Math.abs(diffLate) <= 2) {
        lines.push(buildLiveLine(
          t('live_quarter_tight', { q: quarter }),
          buildMeta(quarter, clockLate, homeTotal, awayTotal),
          'commentator'
        ));
      }

      if (quarterTotal >= 65) {
        lines.push(buildLiveLine(
          t('live_quarter_fire', { q: quarter }),
          buildMeta(quarter, clockLate, homeTotal, awayTotal),
          'commentator',
          null,
          '',
          true
        ));
      } else if (quarterTotal <= 44) {
        lines.push(buildLiveLine(
          t('live_quarter_lockdown', { q: quarter }),
          buildMeta(quarter, clockLate, homeTotal, awayTotal),
          'commentator',
          null,
          '',
          true
        ));
      }

      lines.push(buildLiveLine(
        t('live_qscore', {
          q: quarter,
          home: home.name,
          away: away.name,
          homeScore: homeQ[i],
          awayScore: awayQ[i]
        }),
        buildMeta(quarter, formatClock(0, 0), homeTotal, awayTotal),
        'narrator'
      ));

      const leadNow = Math.sign(homeTotal - awayTotal);
      if (prevLead !== 0 && leadNow !== 0 && leadNow !== prevLead) {
        lines.push(buildLiveLine(
          t('live_lead_change', { team: leadNow > 0 ? home.name : away.name }),
          buildMeta(quarter, clockLate, homeTotal, awayTotal),
          'commentator',
          null,
          '',
          true
        ));
      }
      if (leadNow !== 0) prevLead = leadNow;

      if (i === 1) {
        lines.push(buildLiveLine(t('live_halftime', {
          homeTeam: home.name,
          awayTeam: away.name,
          home: homeTotal,
          away: awayTotal
        }), buildMeta(quarter, formatClock(0, 0), homeTotal, awayTotal), 'narrator'));
      }
    }

    const winner = homeScore >= awayScore ? home : away;
    const diffFinal = Math.abs(homeScore - awayScore);
    if (diffFinal <= 5 && stats) {
      const winnerStats = winner.id === home.id ? stats.home : stats.away;
      const clutchStat = winnerStats && winnerStats.length
        ? [...winnerStats].sort((a, b) => b.points - a.points)[0]
        : null;
      if (clutchStat) {
        lines.push(buildLiveLine(t('live_clutch', { player: clutchStat.name }), buildMeta(4, formatClock(0, 18), homeScore, awayScore), 'commentator', null, '', true));
      }
    } else if (diffFinal >= 18) {
      lines.push(buildLiveLine(t('live_blowout', { team: winner.name }), buildMeta(4, formatClock(0, 18), homeScore, awayScore), 'commentator', null, '', true));
    }

    lines.push(buildLiveLine(t('live_final', {
      home: home.name,
      away: away.name,
      homeScore,
      awayScore
    }), buildMeta(4, formatClock(0, 0), homeScore, awayScore), 'narrator'));

    if (stats && stats.stars && stats.stars[0]) {
      const star = stats.stars[0];
      lines.push(buildLiveLine(
        t('live_star', { name: star.name, pts: star.points, reb: star.rebounds, ast: star.assists }),
        buildMeta(4, formatClock(0, 0), homeScore, awayScore),
        'commentator',
        null,
        '',
        true
      ));
      const starPlayer = getPlayerById(home, star.playerId) || getPlayerById(away, star.playerId);
      const highlight = buildHighlightLine(starPlayer, star);
      if (highlight) lines.push(buildLiveLine(highlight, buildMeta(4, formatClock(0, 0), homeScore, awayScore), 'commentator', null, '', true));
    }

    return { lines, quarters: { home: homeQ, away: awayQ } };
  };

  // Game simulation helpers moved to js/sim.js.

  const AppSeasonCore = window.AppSeasonCore || {};
  const {
    simulateDay,
    getCurrentDay,
    buildRoundLog,
    getNextUserGame,
    getStandings,
    startPlayoffs,
    handleEndSeason
  } = AppSeasonCore;

  const AppMarketCore = window.AppMarketCore || {};
  const {
    runAIFrontOffice,
    applyInterLeagueTransfers
  } = AppMarketCore;


  const updateRotation = (team, playerId, isStarter) => {
    ensureRotationSlots(team);
    const slots = team.rotation.slots || {};
    if (isStarter) {
      if (team.rotation.starters.length >= 5 && !Object.values(slots).includes(playerId)) {
        logMessage('msg_starters_limit');
        return false;
      }
      const player = team.roster.find((p) => p.id === playerId);
      const preferred = player ? player.pos : null;
      if (preferred && !slots[preferred]) {
        slots[preferred] = playerId;
      } else {
        const empty = POSITION_SLOTS.find((pos) => !slots[pos]);
        if (empty) {
          slots[empty] = playerId;
        }
      }
    } else {
      Object.keys(slots).forEach((pos) => {
        if (slots[pos] === playerId) delete slots[pos];
      });
    }
    ensureRotation(team);
    return true;
  };

  function getPlayerById(team, id) {
    if (!team || !team.roster) return null;
    return team.roster.find((p) => p.id === id) || null;
  }

  // Shared deps for UI modules.
  window.AppRenderDeps = {
    getState: () => gameState,
    getUI: () => ui,
    getTeamById,
    computeTeamOvr,
    getNextUserGame,
    getStandings,
    ensureRotationSlots,
    ensureRotation,
    getPositionFitMultiplier,
    computeMonthlyIncome,
    logMessage,
    getInternationalCycle: (season) => {
      if (season % 4 === 0) return 'Olimpiadas';
      if (season % 4 === 2) return 'Copa do Mundo';
      return null;
    }
  };
  window.AppMarketDeps = {
    getState: () => gameState,
    getUI: () => ui,
    getTeamById,
    getPlayerById,
    getPickAssetById,
    formatPickLabel,
    getPickAssetsForTeam,
    startDraft,
    getDraftTeamForPick,
    buildTradeSuggestions,
    computeMonthlyIncome
  };
  window.AppSeasonDeps = {
    getState: () => gameState,
    logMessage
  };
  const handleInternationalTournament = () => {
    if (window.AppSeason && typeof window.AppSeason.handleInternationalTournament === 'function') {
      window.AppSeason.handleInternationalTournament();
    }
  };
  window.AppLiveDeps = {
    getState: () => gameState,
    getUI: () => ui,
    openOverlay,
    closeOverlay,
    maybePlaySfxForLine,
    setIsSimulating: (value) => { isSimulating = value; },
    isSimulating: () => isSimulating,
    isPerformanceMode: () => (gameState && gameState.settings && gameState.settings.performanceMode),
    getLiveInterval: () => LIVE_LINE_INTERVAL
  };

  // ------------------------------
  // Rendering (UI)
  // ------------------------------
  const AppRender = window.AppRender || {};
  const {
    renderSummary,
    renderNextGame,
    renderStandings,
    renderObjectives,
    renderMessages,
    renderHealth,
    renderSeasonLeaders,
    renderAdvancedLeague,
    renderPerformancePanel,
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
    renderLongterm,
    renderStaff,
    renderGMSkills,
    renderSponsors,
    renderScouting,
    renderAwards,
    renderRivalries,
    renderHallFame,
    renderSeasonHistory,
    renderMarketHistory,
    renderWorldPlayoffs,
    renderNational
  } = AppRender;

  const AppMarket = window.AppMarket || {};
  const { renderMarket, renderExtensions } = AppMarket;
  const AppLive = window.AppLive || {};
  const {
    renderLiveSim,
    playLiveLog,
    skipLiveLog,
    openLiveOverlay,
    closeLiveOverlay,
    setTvMode,
    updateLiveScoreboard
  } = AppLive;

  const renderActiveView = (viewId = activeViewId) => {
    if (!gameState) return;
    syncActiveHuman();
    {
      const currentTeam = getTeamById(gameState.userTeamId);
      applyThemeFromTeam(currentTeam);
      if (currentTeam) {
        saveSplashTheme(currentTeam.colors, `${currentTeam.city} ${currentTeam.nickname}`);
      }
    }
    setProfileInfo();
    const map = {
      dashboard: [
        renderSummary,
        renderNextGame,
        renderStandings,
        renderObjectives,
        renderMessages,
        renderHealth,
        renderSeasonLeaders,
        renderAdvancedLeague,
        renderPerformancePanel,
        renderMinutesPanel,
        renderSeasonRecap
      ],
      roster: [renderRoster],
      tactics: [renderTactics, renderRotation, renderTacticsBoard],
      games: [renderSchedule, renderPlayoffs, renderLiveSim],
      finances: [renderFinances],
      market: [renderMarket, renderExtensions],
      club: [
        renderFacilities,
        renderLongterm,
        renderStaff,
        renderGMSkills,
        renderSponsors,
        renderScouting,
        renderAwards,
        renderRivalries,
        renderHallFame,
        renderSeasonHistory,
        renderMarketHistory,
        renderWorldPlayoffs
      ],
      training: [renderTraining],
      national: [renderNational]
    };
    const renderers = map[viewId] || [];
    renderers.forEach((fn) => {
      if (typeof fn === 'function') fn();
    });
    renderHotseatPanel();
    renderSaveSlots();
    renderMusicPlaylist();
  };

  const renderAll = () => {
    renderActiveView(activeViewId);
    maybeOpenHotseatOverlay();
    saveGame();
    setSaveInfo();
  };
  if (window.AppLiveDeps) {
    window.AppLiveDeps.renderAll = () => renderAll();
  }

// ------------------------------
  // Actions / handlers
  // ------------------------------
  const handleSimNext = () => {
    if (isSimulating) return;
    if (gameState.phase === 'retired') {
      logMessage('msg_career_end_short');
      renderAll();
      return;
    }
    if (gameState.phase === 'offseason') {
      logMessage('msg_offseason_active');
      renderAll();
      return;
    }
    const remaining = gameState.schedule.some((g) => !g.played);
    if (!remaining) {
      if (gameState.phase === 'regular') {
        startPlayoffs();
        handleEndSeason();
      }
      renderAll();
      return;
    }

    const day = getCurrentDay();
    const watchAll = ui.watchAll && ui.watchAll.checked;
    if (watchAll) {
      const switched = simulateDay(day);
      const games = gameState.schedule.filter((g) => g.day === day);
      const roundLog = buildRoundLog(games, day);
      if (roundLog.length) {
        setActiveView('games');
        logMessage('msg_round_sim');
        playLiveLog(roundLog);
      } else {
        logMessage('msg_round_no_user');
        renderAll();
      }
      saveGame(true);
      if (switched) return;
      return;
    }

    const liveLog = [];
    const switched = simulateDay(day, liveLog);

    const finishedRegular = gameState.schedule.every((g) => g.played);
    if (finishedRegular && gameState.phase === 'regular') {
      startPlayoffs();
    }

    if (liveLog.length) {
      setActiveView('games');
      logMessage('msg_round_sim');
      playLiveLog(liveLog);
    } else {
      logMessage('msg_round_no_user');
      renderAll();
    }
    saveGame(true);
    if (switched) return;
  };

  const handleSimWeek = () => {
    if (isSimulating) return;
    if (gameState.phase === 'retired') {
      logMessage('msg_career_end_short');
      renderAll();
      return;
    }
    if (gameState.phase === 'offseason') {
      logMessage('msg_offseason_active');
      renderAll();
      return;
    }
    for (let i = 0; i < 7; i += 1) {
      const remaining = gameState.schedule.some((g) => !g.played);
      if (!remaining) break;
      const switched = simulateDay(getCurrentDay());
      if (switched) {
        logMessage('msg_round_sim');
        renderAll();
        return;
      }
    }

    const finishedRegular = gameState.schedule.every((g) => g.played);
    if (finishedRegular && gameState.phase === 'regular') {
      startPlayoffs();
    }

    logMessage('msg_week_sim');
    renderAll();
    saveGame(true);
  };

  const handleRosterAction = (event) => {
    const target = event.target;
    if (!target.dataset.action) return;

    const team = getTeamById(gameState.userTeamId);
    const player = team.roster.find((p) => p.id === target.dataset.id);
    if (!player) return;

    if (target.dataset.action === 'toggle-starter') {
      if (player.injuryDays > 0) {
        logMessage('msg_injured_cannot_start', { name: player.name });
        renderAll();
        return;
      }
      const isStarter = team.rotation.starters.includes(player.id);
      const success = updateRotation(team, player.id, !isStarter);
      if (success) logMessage('msg_player_now', { name: player.name, role: !isStarter ? 'titular' : 'reserva' });
    }

    if (target.dataset.action === 'release') {
      team.roster = team.roster.filter((p) => p.id !== player.id);
      team.rotation.starters = team.rotation.starters.filter((id) => id !== player.id);
      if (team.rotation.slots) {
        Object.keys(team.rotation.slots).forEach((pos) => {
          if (team.rotation.slots[pos] === player.id) delete team.rotation.slots[pos];
        });
      }
      gameState.market.freeAgents.unshift(player);
      logMessage('msg_released', { name: player.name });
    }

    renderAll();
  };

  const handleMarketAction = (event) => {
    const target = event.target;
    if (!target.dataset.action) return;

    const team = getTeamById(gameState.userTeamId);

    if (target.dataset.action === 'sign') {
      const playerIndex = gameState.market.freeAgents.findIndex((p) => p.id === target.dataset.id);
      if (playerIndex < 0) return;
      const player = gameState.market.freeAgents[playerIndex];
      if (team.roster.length >= 15) {
        logMessage('msg_roster_full');
        renderAll();
        return;
      }
      if (team.budget < player.salary) {
        logMessage('msg_budget_contract');
        renderAll();
        return;
      }
      team.budget -= player.salary;
      player.contractYears = rand(1, 4);
      team.roster.push(player);
      gameState.market.freeAgents.splice(playerIndex, 1);
      logMessage('msg_signed', { name: player.name });
      renderAll();
      return;
    }

    if (target.dataset.action === 'draft') {
      if (gameState.phase !== 'offseason') {
        logMessage('msg_draft_offseason');
        renderAll();
        return;
      }
      if (!gameState.draftState) {
        startDraft();
      }
      const currentTeam = getDraftTeamForPick(gameState.draftState);
      if (currentTeam !== gameState.userTeamId) {
        logMessage('msg_not_your_pick');
        renderAll();
        return;
      }
      advanceDraft(target.dataset.id);
      logMessage('msg_pick_made');
      renderAll();
    }
  };

  const handleTacticsChange = (event) => {
    const target = event.target;
    if (target.name === 'formation') {
      getTeamById(gameState.userTeamId).tactics.formation = target.value;
      logMessage('msg_formation_set', { value: target.value });
      renderAll();
    }
    if (target.name === 'strategy') {
      getTeamById(gameState.userTeamId).tactics.strategy = target.value;
      logMessage('msg_strategy_set', { value: target.value });
      renderAll();
    }
  };

  const handleTraining = () => {
    const choice = document.querySelector('input[name="training"]:checked');
    if (!choice) {
      logMessage('msg_choose_training');
      renderAll();
      return;
    }

    const team = getTeamById(gameState.userTeamId);
    if (!gameState.trainingLog) gameState.trainingLog = [];
    gameState.trainingFocus = choice.value;
    const gmDev = gameState.gmSkills ? gameState.gmSkills.development : 1;
    const staff = gameState.staff || { offense: 0, defense: 0, shooting: 0, strength: 0, finance: 0 };
    const staffMap = {
      attack: 'offense',
      defense: 'defense',
      physical: 'strength',
      shooting: 'shooting',
      passing: 'offense'
    };
    const staffKey = staffMap[choice.value] || 'offense';
    const staffBonus = staff[staffKey] ? staff[staffKey] * 0.4 : 0;
    const devBonus = (gmDev - 1) * 0.35;
    const session = {
      season: gameState.season,
      day: gameState.day,
      focus: choice.value,
      gains: []
    };
    team.roster.forEach((player) => {
      const beforeOvr = player.ovr;
      const gain = Math.max(0, Math.round(rand(0, 2) + staffBonus + devBonus));
      const applied = applyAttributeDelta(player, choice.value, gain);
      if (applied !== 0) {
        player.ovr = computeOvr(player);
        updatePlayerRole(player);
        assignTraits(player);
      }
      const ovrDelta = player.ovr - beforeOvr;
      if (applied !== 0 || ovrDelta !== 0) {
        player.lastTrainingGain = applied;
        player.lastTrainingAttr = choice.value;
        session.gains.push({
          id: player.id,
          name: player.name,
          pos: player.pos,
          attr: choice.value,
          gain: applied,
          ovrDelta
        });
        if (team.id === gameState.userTeamId && applied > 0) {
          gameState.progressLog.unshift(`${player.name} +${applied} em ${choice.value.toUpperCase()}`);
        }
      }
      if (player.ovr !== beforeOvr) {
        pushOvrHistory(player);
      }
      player.energy = clamp(player.energy - 2, 0, 100);
    });

    if (session.gains.length) {
      gameState.trainingLog.unshift(session);
      gameState.trainingLog = gameState.trainingLog.slice(0, 12);
    }
    if (gameState.progressLog.length > 12) {
      gameState.progressLog = gameState.progressLog.slice(0, 12);
    }
    logMessage('msg_training_applied', { value: choice.value });
    renderAll();
  };

  const handleOffer = () => {
    const playerId = document.getElementById('neg-player').value;
    const salary = parseFloat(document.getElementById('neg-salary').value);
    const years = parseInt(document.getElementById('neg-years').value, 10);
    const option = document.getElementById('neg-option') ? document.getElementById('neg-option').value : 'none';
    if (Number.isNaN(salary) || Number.isNaN(years)) return;
    const team = getTeamById(gameState.userTeamId);
    const playerIndex = gameState.market.freeAgents.findIndex((p) => p.id === playerId);
    if (playerIndex < 0) return;
    const player = gameState.market.freeAgents[playerIndex];
    const negotiation = (gameState.gmSkills ? gameState.gmSkills.negotiation : 1);
    const financeStaff = gameState.staff ? gameState.staff.finance : 0;
    const expectedBase = player.salary + player.starLevel * 1.5;
    const expected = clamp(expectedBase - negotiation * 0.6 - financeStaff * 0.4, 1, 35);
    const acceptance = salary >= expected * (0.85 + Math.random() * 0.25);
    if (team.roster.length >= 15) {
      logMessage('msg_roster_full');
      renderAll();
      return;
    }
    if (team.budget < salary) {
      logMessage('msg_offer_budget');
      renderAll();
      return;
    }
    if (!acceptance) {
      logMessage('msg_offer_rejected', { name: player.name });
      renderAll();
      return;
    }
    player.salary = parseFloat(salary.toFixed(1));
    player.contractYears = clamp(years, 1, 4);
    player.optionType = option === 'none' ? null : option;
    team.budget -= salary;
    team.roster.push(player);
    gameState.market.freeAgents.splice(playerIndex, 1);
    logMessage('msg_offer_accepted', { name: player.name, years: player.contractYears });
    renderAll();
  };

  const handleExtensionOffer = () => {
    const playerId = document.getElementById('ext-player') ? document.getElementById('ext-player').value : null;
    const salary = parseFloat(document.getElementById('ext-salary') ? document.getElementById('ext-salary').value : '0');
    const years = parseInt(document.getElementById('ext-years') ? document.getElementById('ext-years').value : '1', 10);
    const option = document.getElementById('ext-option') ? document.getElementById('ext-option').value : 'none';
    if (!playerId || Number.isNaN(salary) || Number.isNaN(years)) return;
    const team = getTeamById(gameState.userTeamId);
    const player = team.roster.find((p) => p.id === playerId);
    if (!player) return;
    if (team.budget < salary) {
      logMessage('msg_extension_budget');
      renderAll();
      return;
    }
    const negotiation = (gameState.gmSkills ? gameState.gmSkills.negotiation : 1);
    const financeStaff = gameState.staff ? gameState.staff.finance : 0;
    const expectedBase = player.salary + player.starLevel * 1.2 + player.ovr * 0.03;
    const expected = clamp(expectedBase - negotiation * 0.6 - financeStaff * 0.4, 1, 35);
    const acceptance = salary >= expected * (0.85 + Math.random() * 0.2);
    if (!acceptance) {
      logMessage('msg_extension_rejected', { name: player.name });
      renderAll();
      return;
    }
    player.salary = parseFloat(salary.toFixed(1));
    player.contractYears = clamp(years, 1, 4);
    player.optionType = option === 'none' ? null : option;
    team.budget -= salary;
    logMessage('msg_extension_accepted', { name: player.name, years: player.contractYears });
    renderAll();
  };

  const handleExtensionChange = () => {
    const select = document.getElementById('ext-player');
    const salaryInput = document.getElementById('ext-salary');
    if (!select || !salaryInput) return;
    const option = select.options[select.selectedIndex];
    if (!option || !option.dataset.salary) return;
    const baseSalary = parseFloat(option.dataset.salary);
    if (Number.isNaN(baseSalary)) return;
    salaryInput.value = (baseSalary + 0.6).toFixed(1);
  };

  const getTeamAvgAge = (team) => {
    if (!team || !team.roster || !team.roster.length) return 26;
    const total = team.roster.reduce((acc, p) => acc + p.age, 0);
    return total / team.roster.length;
  };

  const getTeamStrategy = (team) => {
    const ovr = computeTeamOvr(team);
    const age = getTeamAvgAge(team);
    const record = team.wins - team.losses;
    if (record >= 8 && ovr >= 74) return 'contender';
    if (record <= -8 || ovr <= 68 || age <= 24) return 'rebuild';
    return 'balanced';
  };

  const updateTeamStrategy = (team) => {
    if (!team) return;
    team.strategy = getTeamStrategy(team);
  };

  const updateLeagueStrategies = () => {
    gameState.teams.forEach((team) => updateTeamStrategy(team));
  };

  const playerValue = (player, strategy = 'balanced') => {
    const ovr = computeOvr(player);
    const pot = getPotentialMax(player);
    const agePenalty = player.age * 0.35;
    const star = player.starLevel ? player.starLevel * 7 : 0;
    const salaryPenalty = (player.salary || 0) * 1.1;
    const contractBonus = Math.max(0, 4 - (player.contractYears || 1)) * 1.2;
    let base = ovr * 1.35 + pot * 0.35 - agePenalty - salaryPenalty + star + contractBonus;
    if (strategy === 'contender') {
      base += (ovr - 72) * 0.6;
      base -= Math.max(0, player.age - 30) * 0.7;
    } else if (strategy === 'rebuild') {
      base += (pot - ovr) * 0.8;
      base += Math.max(0, 26 - player.age) * 0.5;
    }
    return base;
  };

  const getPositionDepth = (team) => {
    const depth = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
    team.roster.forEach((player) => {
      if (depth[player.pos] !== undefined) depth[player.pos] += 1;
      if (player.secondaryPos) {
        player.secondaryPos.forEach((pos) => {
          if (depth[pos] !== undefined) depth[pos] += 0.5;
        });
      }
    });
    return depth;
  };

  const getNeedMultiplier = (team, pos) => {
    const depth = getPositionDepth(team);
    const count = depth[pos] || 0;
    if (count < 1.5) return 1.18;
    if (count < 2.5) return 1.08;
    if (count > 3.5) return 0.9;
    return 1;
  };

  const getTradeValue = (player, team) => {
    const strategy = team && team.strategy ? team.strategy : 'balanced';
    const base = playerValue(player, strategy);
    return base * getNeedMultiplier(team, player.pos);
  };

  window.AppMarketCoreDeps = {
    getState: () => gameState,
    getTeamStrategy,
    updateTeamStrategy,
    getNeedMultiplier,
    getTradeValue,
    playerValue,
    randomChoice,
    rand,
    logMessage,
    FIRST_NAMES,
    LAST_NAMES
  };

  window.AppSeasonCoreDeps = {
    getState: () => gameState,
    getTeamById,
    createSchedule,
    createDraftPool,
    buildPickAssets,
    generateObjectives,
    generatePlayer,
    applyDailyRecovery,
    applyWeeklyProgression,
    applyMonthlyFinance,
    updateLeagueStrategies,
    hasActiveHumanGameOnDay,
    queueHotseatSwitch,
    computeTeamOvr,
    applyTacticModifiers,
    logMessage,
    computeOvr,
    getPotentialMax,
    updatePlayerRole,
    assignTraits,
    applyAttributeDelta,
    createBackup: () => {
      if (activeProfileId && activeSaveId) {
        StorageAPI.createBackup(activeProfileId, activeSaveId, gameState);
      }
    },
    runAIFrontOffice,
    applyInterLeagueTransfers,
    handleInternationalTournament
  };


  const clampRosterSize = (size) => size >= 8 && size <= 15;

  const evaluateTradeValues = (ownPlayers, targetPlayers, ownPicks, targetPicks, team, targetTeam, cash = 0) => {
    const offerValue = ownPlayers.reduce((acc, player) => acc + getTradeValue(player, targetTeam), 0)
      + ownPicks.reduce((acc, pick) => acc + getPickValue(pick, targetTeam.strategy), 0);
    const targetValue = targetPlayers.reduce((acc, player) => acc + getTradeValue(player, team), 0)
      + targetPicks.reduce((acc, pick) => acc + getPickValue(pick, team.strategy), 0);
    const cashValue = cash * 0.8;
    return {
      offerValue,
      targetValue,
      cashValue,
      diff: offerValue + cashValue - targetValue
    };
  };

  const canExecuteTrade = (ownPlayers, targetPlayers, ownPicks, targetPicks, team, targetTeam, cash) => {
    if ((!ownPlayers.length && !ownPicks.length) || (!targetPlayers.length && !targetPicks.length)) {
      logMessage('msg_trade_empty');
      return false;
    }
    const nextTeamSize = team.roster.length - ownPlayers.length + targetPlayers.length;
    const nextTargetSize = targetTeam.roster.length - targetPlayers.length + ownPlayers.length;
    if (!clampRosterSize(nextTeamSize) || !clampRosterSize(nextTargetSize)) {
      logMessage('msg_trade_roster');
      return false;
    }
    if (cash > 0 && team.budget < cash) {
      logMessage('msg_trade_budget');
      return false;
    }
    if (cash < 0 && targetTeam.budget < Math.abs(cash)) {
      logMessage('msg_trade_cash_target', { team: targetTeam.name });
      return false;
    }
    return true;
  };

  function buildTradeSuggestions() {
    const team = getTeamById(gameState.userTeamId);
    const suggestions = [];
    const myPool = team.roster
      .filter((player) => player.starLevel < 3)
      .sort((a, b) => playerValue(b, team.strategy) - playerValue(a, team.strategy))
      .slice(0, 8);
    const otherTeams = gameState.teams.filter((t) => t.id !== team.id);
    otherTeams.forEach((targetTeam) => {
      const targetPool = [...targetTeam.roster]
        .sort((a, b) => playerValue(b, targetTeam.strategy) - playerValue(a, targetTeam.strategy))
        .slice(0, 8);
      targetPool.forEach((targetPlayer) => {
        const needBoost = getNeedMultiplier(team, targetPlayer.pos);
        myPool.forEach((ownPlayer) => {
          const offerValue = getTradeValue(ownPlayer, targetTeam);
          const targetValue = getTradeValue(targetPlayer, team);
          const diff = targetValue - offerValue;
          const score = Math.abs(diff) + (needBoost < 1 ? 3 : 0);
          if (score > 10) return;
          let cash = 0;
          if (diff > 1) cash = Math.min(10, Math.round(diff * 0.6 * 2) / 2);
          if (diff < -2) cash = -Math.min(10, Math.round(Math.abs(diff) * 0.4 * 2) / 2);
          suggestions.push({
            teamId: targetTeam.id,
            teamName: targetTeam.name,
            ownId: ownPlayer.id,
            targetId: targetPlayer.id,
            ownName: ownPlayer.name,
            targetName: targetPlayer.name,
            cash,
            diff,
            score
          });
        });
      });
    });
    return suggestions.sort((a, b) => a.score - b.score).slice(0, 3);
  }

  const getPlayerComps = (player, pool, count = 2) => {
    if (!player || !pool || pool.length < 2) return '-';
    const candidates = pool
      .filter((p) => p.id !== player.id)
      .map((p) => {
        const ovrDiff = Math.abs(computeOvr(p) - computeOvr(player));
        const posPenalty = p.pos === player.pos ? 0 : 4;
        const archetypePenalty = p.archetype === player.archetype ? 0 : 2;
        return {
          name: p.name,
          score: ovrDiff + posPenalty + archetypePenalty
        };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, count)
      .map((p) => p.name);
    return candidates.length ? candidates.join(', ') : '-';
  };
  if (window.AppMarket) {
    window.AppMarket.getPlayerComps = getPlayerComps;
  } else {
    window.AppMarket = { getPlayerComps };
  }

  const generateTradeOffers = () => {
    const team = getTeamById(gameState.userTeamId);
    if (!team || gameState.phase !== 'regular') return;
    if (gameState.tradeInbox.length >= 5) return;
    if (Math.random() > 0.35) return;
    const targetTeam = randomChoice(gameState.teams.filter((t) => t.id !== team.id));
    if (!targetTeam) return;
    const targetCandidate = randomChoice(targetTeam.roster.filter((p) => p.starLevel < 3)) || randomChoice(targetTeam.roster);
    const ownCandidate = randomChoice(team.roster.filter((p) => p.starLevel < 3)) || randomChoice(team.roster);
    if (!targetCandidate || !ownCandidate) return;
    const ownPlayers = [ownCandidate];
    const targetPlayers = [targetCandidate];
    const value = evaluateTradeValues(ownPlayers, targetPlayers, [], [], team, targetTeam, 0);
    let cash = 0;
    if (value.diff < -2) cash = Math.min(8, Math.round(Math.abs(value.diff) * 0.5 * 2) / 2);
    if (value.diff > 3) cash = -Math.min(6, Math.round(value.diff * 0.4 * 2) / 2);
    const offeredPickIds = [];
    const requestedPickIds = [];
    const pickByRound = (picks, round) => picks.find((p) => p.round === round) || picks[0];
    if (value.diff < -4) {
      const picks = getPickAssetsForTeam(targetTeam.id, gameState.season);
      const pick = pickByRound(picks, 2);
      if (pick) offeredPickIds.push(pick.id);
    }
    if (value.diff > 4) {
      const picks = getPickAssetsForTeam(team.id, gameState.season);
      const pick = pickByRound(picks, 2);
      if (pick) requestedPickIds.push(pick.id);
    }
    const offer = {
      id: createId(),
      fromTeamId: targetTeam.id,
      toTeamId: team.id,
      offeredIds: targetPlayers.map((p) => p.id),
      requestedIds: ownPlayers.map((p) => p.id),
      offeredPickIds,
      requestedPickIds,
      cash,
      day: gameState.day
    };
    gameState.tradeInbox.unshift(offer);
    if (gameState.tradeInbox.length > 6) gameState.tradeInbox.pop();
    logMessage('msg_trade_offer', { team: targetTeam.name });
  };

  const executeTrade = (ownIds, teamId, targetIds, cash = 0, ownPickIds = [], targetPickIds = []) => {
    const team = getTeamById(gameState.userTeamId);
    const targetTeam = getTeamById(teamId);
    if (!team || !targetTeam) return false;
    const ownList = [...new Set(ownIds.filter(Boolean))];
    const targetList = [...new Set(targetIds.filter(Boolean))];
    const ownPlayers = ownList.map((id) => getPlayerById(team, id)).filter(Boolean);
    const targetPlayers = targetList.map((id) => getPlayerById(targetTeam, id)).filter(Boolean);
    const ownPicks = ownPickIds.map(getPickAssetById).filter(Boolean);
    const targetPicks = targetPickIds.map(getPickAssetById).filter(Boolean);
    const invalidOwnPick = ownPicks.some((pick) => pick.ownerTeamId !== team.id);
    const invalidTargetPick = targetPicks.some((pick) => pick.ownerTeamId !== targetTeam.id);
    if (invalidOwnPick || invalidTargetPick) {
      logMessage('msg_trade_pick_invalid');
      return false;
    }
    if (!canExecuteTrade(ownPlayers, targetPlayers, ownPicks, targetPicks, team, targetTeam, cash)) return false;

    const { offerValue, targetValue, cashValue } = evaluateTradeValues(
      ownPlayers,
      targetPlayers,
      ownPicks,
      targetPicks,
      team,
      targetTeam,
      cash
    );
    const bias = targetTeam.wins < team.wins ? 0.96 : 1.04;
    const strategy = targetTeam.strategy || getTeamStrategy(targetTeam);
    const strategyBias = strategy === 'contender' ? 1.05 : strategy === 'rebuild' ? 0.92 : 1;
    const accept = (offerValue + cashValue) >= targetValue * bias * strategyBias * (0.92 + Math.random() * 0.18);
    if (!accept) {
      logMessage('msg_trade_rejected', { team: targetTeam.name });
      return false;
    }

    if (cash > 0) {
      team.budget -= cash;
      targetTeam.budget += cash;
    }
    if (cash < 0) {
      team.budget += Math.abs(cash);
      targetTeam.budget -= Math.abs(cash);
    }
    team.roster = team.roster.filter((p) => !ownList.includes(p.id));
    targetTeam.roster = targetTeam.roster.filter((p) => !targetList.includes(p.id));
    team.roster.push(...targetPlayers);
    targetTeam.roster.push(...ownPlayers);
    ownPicks.forEach((pick) => {
      pick.ownerTeamId = targetTeam.id;
    });
    targetPicks.forEach((pick) => {
      pick.ownerTeamId = team.id;
    });
    ensureRotation(team);
    ensureRotation(targetTeam);
    gameState.tradeHistory.unshift({
      season: gameState.season,
      day: gameState.day,
      teamId: team.id,
      targetTeamId: targetTeam.id,
      sentPlayers: ownPlayers.map((p) => p.name),
      receivedPlayers: targetPlayers.map((p) => p.name),
      sentPicks: ownPicks.map((p) => formatPickLabel(p)),
      receivedPicks: targetPicks.map((p) => formatPickLabel(p)),
      cash
    });
    if (gameState.tradeHistory.length > 20) {
      gameState.tradeHistory = gameState.tradeHistory.slice(0, 20);
    }
    logMessage('msg_trade_done_multi', {
      own: ownPlayers.map((p) => p.name).join(', '),
      target: targetPlayers.map((p) => p.name).join(', ')
    });
    return true;
  };

  const handleTrade = () => {
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
    const success = executeTrade(
      [ownId, ownId2, ownId3],
      teamId,
      [targetId, targetId2, targetId3],
      cash,
      [ownPickId].filter(Boolean),
      [targetPickId].filter(Boolean)
    );
    if (success) renderAll();
  };

  const facilityCost = (level) => 6 + level * 6;
  const staffUpgradeCost = (level) => 4 + (level + 1) * 4;

  const handleFacilityUpgrade = (facilityKey) => {
    const team = getTeamById(gameState.userTeamId);
    const level = team.facilities[facilityKey];
    if (level >= 5) {
      logMessage('msg_facility_max');
      renderAll();
      return;
    }
    const cost = facilityCost(level);
    if (team.budget < cost) {
      logMessage('msg_facility_budget');
      renderAll();
      return;
    }
    team.budget -= cost;
    team.facilities[facilityKey] = Math.min(5, level + 1);
    logMessage('msg_facility_upgraded', { facility: facilityKey });
    renderAll();
  };

  const handleStaffUpgrade = (staffKey) => {
    const level = gameState.staff[staffKey];
    if (level >= MAX_STAFF_LEVEL) {
      logMessage('msg_staff_max');
      renderAll();
      return;
    }
    const cost = staffUpgradeCost(level);
    const team = getTeamById(gameState.userTeamId);
    if (team.budget < cost) {
      logMessage('msg_facility_budget');
      renderAll();
      return;
    }
    team.budget -= cost;
    gameState.staff[staffKey] = level + 1;
    const labelMap = {
      offense: t('staff_offense'),
      defense: t('staff_defense'),
      shooting: t('staff_shooting'),
      strength: t('staff_strength'),
      finance: t('staff_finance')
    };
    logMessage('msg_staff_upgraded', { name: labelMap[staffKey] || staffKey });
    renderAll();
  };

  const handleSkillUpgrade = (skillKey) => {
    if (gameState.skillPoints <= 0) {
      logMessage('msg_no_skill_points');
      renderAll();
      return;
    }
    const current = gameState.gmSkills[skillKey];
    if (current >= MAX_GM_SKILL) {
      logMessage('msg_skill_max');
      renderAll();
      return;
    }
    gameState.gmSkills[skillKey] = current + 1;
    gameState.skillPoints -= 1;
    const labelMap = {
      scouting: t('skill_scouting'),
      negotiation: t('skill_negotiation'),
      development: t('skill_development'),
      finance: t('skill_finance')
    };
    logMessage('msg_skill_upgraded', { name: labelMap[skillKey] || skillKey });
    renderAll();
  };

  const handleSponsorSign = () => {
    const select = document.getElementById('sponsor-select');
    if (!select) return;
    const sponsor = SPONSORS.find((s) => s.id === select.value);
    if (!sponsor) return;
    const team = getTeamById(gameState.userTeamId);
    team.budget += sponsor.bonus;
    team.fanMood = clamp(team.fanMood + sponsor.fanBoost, 30, 99);
    gameState.sponsor = { ...sponsor, yearsLeft: 1 };
    logMessage('msg_sponsor_signed', { name: sponsor.name });
    renderAll();
  };

  const updateTabAccessibility = (activeId) => {
    ui.tabs.forEach((tab) => {
      const isActive = tab.dataset.view === activeId;
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });
  };

  const setupTabKeyboardNav = () => {
    ui.tabs.forEach((tab, index) => {
      tab.addEventListener('keydown', (event) => {
        const key = event.key;
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(key)) return;
        event.preventDefault();
        const total = ui.tabs.length;
        let nextIndex = index;
        if (key === 'ArrowRight') nextIndex = (index + 1) % total;
        if (key === 'ArrowLeft') nextIndex = (index - 1 + total) % total;
        if (key === 'Home') nextIndex = 0;
        if (key === 'End') nextIndex = total - 1;
        const nextTab = ui.tabs[nextIndex];
        if (nextTab) {
          nextTab.focus();
          setActiveView(nextTab.dataset.view);
        }
      });
    });
  };

  function setActiveView(viewId) {
    if (!viewId) return;
    activeViewId = viewId;
    ui.views.forEach((view) => view.classList.toggle('active', view.id === viewId));
    ui.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.view === viewId));
    updateTabAccessibility(viewId);
    renderActiveView(viewId);
  }

  // ------------------------------
  // Team selection preview
  // ------------------------------
  const getPreviewTeam = (league, spec, index) => {
    const key = `${league.id}-${spec.city}-${spec.nickname}`;
    if (!teamPreviewCache.has(key)) {
      const preview = createPreviewTeam(league, spec, index);
      preview.preview = true;
      teamPreviewCache.set(key, preview);
    }
    return teamPreviewCache.get(key);
  };

  const renderTeamPreview = (team, colors) => {
    if (!ui.teamPreview || !team) return;
    const logoText = getSafeTeamLogoText(team.city, team.nickname);
    const profile = team.tacticalProfile || TACTICAL_PROFILES[0];
    const strengths = profile && profile.strengths
      ? profile.strengths.map((key) => t(`strength_${key}`)).join(', ')
      : '-';
    const formationLabel = getFormationLabel(team.tactics.formation);
    const strategyLabel = getStrategyLabel(team.tactics.strategy);
    const topPlayers = [...team.roster].sort((a, b) => b.ovr - a.ovr).slice(0, 3);
    const teamOvr = computeTeamOvr(team);
    ui.teamPreview.innerHTML = `
      <div class="preview-card" style="--team-primary: ${colors[0]}; --team-secondary: ${colors[1]};">
        <div class="team-banner">${buildSafeTeamLogoHTML(logoText, colors, true)} ${team.city} • ${team.nickname}</div>
        <div class="muted">OVR ${teamOvr}</div>
        <div>${t('label_tactics')}: ${formationLabel} • ${strategyLabel}</div>
        <div>${t('label_style')}: ${t(profile.style)}</div>
        <div>${t('label_strengths')}: ${strengths}</div>
      </div>
      <div class="preview-card">
        <div class="badge">${t('label_top_players')}</div>
        ${topPlayers.map((player) => `<div>${player.name} • ${player.pos} • ${player.ovr} OVR</div>`).join('')}
      </div>
    `;
    safeApplyTeamTheme({ primary: colors[0], secondary: colors[1] });
    saveSplashTheme({ primary: colors[0], secondary: colors[1] }, `${team.city} ${team.nickname}`);
  };

  const updateFilterClearState = () => {
    if (!ui.btnClearFilter || !ui.teamFilter) return;
    const hasValue = ui.teamFilter.value.trim().length > 0;
    ui.btnClearFilter.disabled = !hasValue;
  };

  const scheduleTeamPreview = (league, spec, index, colors) => {
    if (!ui.teamPreview) return;
    if (previewIdleId) {
      if (typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(previewIdleId);
      } else {
        clearTimeout(previewIdleId);
      }
      previewIdleId = null;
    }
    const loadingText = typeof t === 'function' ? t('msg_loading_preview') : 'Carregando previa...';
    ui.teamPreview.innerHTML = `<div class="muted">${loadingText}</div>`;
    const run = () => {
      if (!league || !spec) return;
      const preview = getPreviewTeam(league, spec, index);
      renderTeamPreview(preview, colors);
    };
    if (typeof requestIdleCallback === 'function') {
      previewIdleId = requestIdleCallback(run, { timeout: 150 });
    } else {
      previewIdleId = setTimeout(run, 30);
    }
  };

  const scheduleTeamPickerRender = (withLeagues = false, delay = 20) => {
    if (teamPickerTimer) clearTimeout(teamPickerTimer);
    const loadingTeams = typeof t === 'function' ? t('msg_loading_teams') : 'Carregando times...';
    if (ui.teamPicker) {
      ui.teamPicker.innerHTML = `<div class="muted">${loadingTeams}</div>`;
    }
    if (ui.teamPreview) {
      const loadingPreview = typeof t === 'function' ? t('msg_loading_preview') : 'Carregando previa...';
      ui.teamPreview.innerHTML = `<div class="muted">${loadingPreview}</div>`;
    }
    teamPickerTimer = setTimeout(() => {
      requestAnimationFrame(() => {
        if (withLeagues) renderLeagueCards();
        buildTeamPicker();
        updateFilterClearState();
      });
    }, delay);
  };

  const maybeHydrateTeamSelection = () => {
    if (typeof window !== 'undefined' && window.__bmPendingTeamRender) {
      window.__bmPendingTeamRender = false;
      scheduleTeamPickerRender(true);
      return;
    }
    if (ui.overlay && !ui.overlay.classList.contains('hidden')) {
      scheduleTeamPickerRender(true);
    }
  };

  const renderLeagueCards = () => {
    if (!ui.leagueCards) return;
    try {
      const leagues = getLeaguesSafe();
      ensureSelectionDefaults();
      if (!leagues.length) {
        ui.leagueCards.innerHTML = '<div class="muted">Ligas indisponiveis.</div>';
        return;
      }
      ui.leagueCards.innerHTML = leagues.map((league) => `
        <button class="league-card${league.id === selectedLeagueId ? ' active' : ''}" data-league="${league.id}">
          <strong>${league.name}</strong>
          <span>${league.country}</span>
        </button>
      `).join('');
      ui.leagueCards.querySelectorAll('.league-card').forEach((card) => {
        card.addEventListener('click', () => {
          const leagueId = card.dataset.league;
          if (!leagueId) return;
          selectedLeagueId = leagueId;
          if (ui.leagueSelect) ui.leagueSelect.value = leagueId;
          if (ui.teamFilter) ui.teamFilter.value = '';
          updateFilterClearState();
          scheduleTeamPickerRender(true);
        });
      });
    } catch (err) {
      console.error(err);
      ui.leagueCards.innerHTML = '<div class="muted">Erro ao carregar ligas.</div>';
    }
  };

  const renderTeamSelectionFallback = () => {
    if (!ui.leagueCards || !ui.teamPicker) return;
    const leagues = getLeaguesSafe();
    if (!leagues.length) {
      ui.leagueCards.innerHTML = '<div class="muted">Ligas indisponiveis.</div>';
      ui.teamPicker.innerHTML = `<div class="muted">${t('msg_no_teams')}</div>`;
      if (ui.teamPreview) ui.teamPreview.innerHTML = '';
      return;
    }
    const palette = getPaletteSafe();
    if (!selectedLeagueId) selectedLeagueId = leagues[0].id;
    ui.leagueCards.innerHTML = leagues.map((league) => `
      <button class="league-card${league.id === selectedLeagueId ? ' active' : ''}" data-fallback-league="${league.id}">
        <strong>${league.name}</strong>
        <span>${league.country}</span>
      </button>
    `).join('');
    const league = leagues.find((item) => item.id === selectedLeagueId) || leagues[0];
    if (!league) return;
    lastTeamPickerLeague = league;
    lastTeamPickerSpecs = getLeagueSpecs(league);
    ui.teamPicker.innerHTML = league.teams.map((team, index) => {
      const colors = palette[index % palette.length];
      const logoText = getSafeTeamLogoText(team.city, team.nickname);
      return `
        <div class="team-card" data-fallback-team="${team.city} ${team.nickname}" data-index="${index}">
          <div class="logo-row">
            ${buildSafeTeamLogoHTML(logoText, colors, true)}
            <div>
              <strong>${team.city} ${team.nickname}</strong>
              <div class="city">${team.city}</div>
            </div>
          </div>
          <div class="team-swatch" style="background: linear-gradient(90deg, ${colors[0]}, ${colors[1]});"></div>
        </div>
      `;
    }).join('');
    if (ui.teamPreview) {
      ui.teamPreview.innerHTML = '<div class="muted">Selecione um time para ver a previa.</div>';
    }
  };

  const buildTeamPicker = () => {
    if (!ui.teamPicker) return;
    try {
      const leagues = getLeaguesSafe();
      ensureSelectionDefaults();
      const league = leagues.find((item) => item.id === selectedLeagueId) || leagues[0] || null;
      if (!league) {
        ui.teamPicker.innerHTML = `<div class="muted">${t('msg_no_teams')}</div>`;
        if (ui.teamPreview) ui.teamPreview.innerHTML = '';
        return;
      }
      const specs = getLeagueSpecs(league);
      lastTeamPickerLeague = league;
      lastTeamPickerSpecs = specs;
      const teamNames = specs.map((spec, index) => {
      const palette = getPaletteSafe();
      const colors = spec.colors || palette[index % palette.length];
        return {
          name: `${spec.city} ${spec.nickname}`,
          city: spec.city,
          nickname: spec.nickname,
          colors: spec.colors || colors,
          index
        };
      });

    const filterTerm = (ui.teamFilter ? ui.teamFilter.value : '').trim().toLowerCase();
    const visibleTeams = filterTerm
      ? teamNames.filter((team) => (
        team.name.toLowerCase().includes(filterTerm)
        || team.city.toLowerCase().includes(filterTerm)
        || team.nickname.toLowerCase().includes(filterTerm)
      ))
      : teamNames;

      if (!visibleTeams.length) {
        ui.teamPicker.innerHTML = `<div class="muted">${t('msg_no_teams')}</div>`;
        if (ui.teamPreview) ui.teamPreview.innerHTML = '';
        return;
      }

    if (!visibleTeams.some((t) => t.name === selectedTeamName)) {
      selectedTeamName = visibleTeams[0].name;
    }

    ui.teamPicker.innerHTML = visibleTeams.map((team) => {
      const logoText = getSafeTeamLogoText(team.city, team.nickname);
      const isSelected = team.name === selectedTeamName;
      return `
      <div class="team-card${isSelected ? ' selected' : ''}" data-team="${team.name}" data-index="${team.index}">
        <div class="logo-row">
          ${buildSafeTeamLogoHTML(logoText, team.colors, true)}
          <div>
            <strong>${team.name}</strong>
            <div class="city">${team.city}</div>
          </div>
        </div>
        <div class="team-swatch" style="background: linear-gradient(90deg, ${team.colors[0]}, ${team.colors[1]});"></div>
      </div>
    `;
    }).join('');

      const initialIndex = teamNames.findIndex((item) => item.name === selectedTeamName);
      const safeIndex = initialIndex >= 0 ? initialIndex : 0;
      const initialSpec = specs[safeIndex] || specs[0];
      const palette = getPaletteSafe();
      const initialColors = initialSpec.colors || palette[safeIndex % palette.length];
      scheduleTeamPreview(league, initialSpec, safeIndex, initialColors);

      if (ui.btnDeleteFranchise) {
        const canDelete = !!(customFranchise && customFranchise.leagueId === selectedLeagueId);
        ui.btnDeleteFranchise.disabled = !canDelete;
      }
    } catch (err) {
      console.error(err);
      const fallback = typeof t === 'function' ? t('msg_no_teams') : 'Nenhum time encontrado.';
      ui.teamPicker.innerHTML = `<div class="muted">${fallback}</div>`;
      if (ui.teamPreview) ui.teamPreview.innerHTML = '';
      renderTeamSelectionFallback();
    }
  };

  const handleTeamPickerClick = (event) => {
    const card = event.target.closest('.team-card');
    if (!card || !ui.teamPicker || !ui.teamPicker.contains(card)) return;
    const fallbackName = card.dataset.fallbackTeam;
    selectedTeamName = card.dataset.team || fallbackName || selectedTeamName;
    ui.teamPicker.querySelectorAll('.team-card.selected').forEach((item) => item.classList.remove('selected'));
    card.classList.add('selected');
    const specIndex = Number(card.dataset.index);
    const specs = lastTeamPickerSpecs || [];
    const league = lastTeamPickerLeague;
    const spec = specs[specIndex] || specs[0];
    if (!spec || !league) {
      if (ui.teamPreview) {
        ui.teamPreview.innerHTML = `<div class="muted">${selectedTeamName || t('msg_no_teams')}</div>`;
      }
      return;
    }
    const palette = getPaletteSafe();
    const colors = spec.colors || palette[specIndex % palette.length];
    scheduleTeamPreview(league, spec, specIndex, colors);
  };

  const buildLeaguePicker = () => {
    if (!ui.leagueSelect) return;
    const leagues = getLeaguesSafe();
    if (!leagues.length) {
      ui.leagueSelect.innerHTML = '<option value="">-</option>';
      return;
    }
    ensureSelectionDefaults();
    ui.leagueSelect.innerHTML = leagues.map((league) => `
      <option value="${league.id}">${league.name} (${league.country})</option>
    `).join('');
    ui.leagueSelect.value = selectedLeagueId;
    ui.leagueSelect.addEventListener('change', () => {
      selectedLeagueId = ui.leagueSelect.value;
      if (ui.teamFilter) ui.teamFilter.value = '';
      updateFilterClearState();
      scheduleTeamPickerRender(true);
    });
    renderLeagueCards();
  };

  const handleCreateFranchise = () => {
    const city = (ui.franchiseCity.value || '').trim();
    const nickname = (ui.franchiseNickname.value || '').trim();
    if (!city || !nickname) return;
    const primary = (ui.franchisePrimary.value || '#4cc3ff').trim();
    const secondary = (ui.franchiseSecondary.value || '#ffb347').trim();
    customFranchise = {
      leagueId: selectedLeagueId,
      city,
      nickname,
      colors: [primary, secondary]
    };
    selectedTeamName = `${city} ${nickname}`;
    scheduleTeamPickerRender(false);
  };

  const handleDeleteFranchise = () => {
    if (!customFranchise) return;
    customFranchise = null;
    if (ui.franchiseCity) ui.franchiseCity.value = '';
    if (ui.franchiseNickname) ui.franchiseNickname.value = '';
    if (ui.franchisePrimary) ui.franchisePrimary.value = '';
    if (ui.franchiseSecondary) ui.franchiseSecondary.value = '';
    const leagues = getLeaguesSafe();
    const league = leagues.find((item) => item.id === selectedLeagueId) || leagues[0];
    const specs = getLeagueSpecs(league);
    if (specs && specs.length) {
      selectedTeamName = `${specs[0].city} ${specs[0].nickname}`;
    }
    scheduleTeamPickerRender(false);
  };

  const renderLoginSaveSlots = (profileId) => {
    if (!ui.loginSaveSlot) return;
    if (!profileId) {
      ui.loginSaveSlot.innerHTML = '<option value="">- Selecione um save -</option>';
      if (ui.btnLoginLoadSave) ui.btnLoginLoadSave.disabled = true;
      if (ui.btnLoginDeleteSave) ui.btnLoginDeleteSave.disabled = true;
      return;
    }
    const saves = StorageAPI.listSaves(profileId);
    const quick = loadQuickSave();
    const options = ['<option value="">- Selecione um save -</option>'];
    saves.forEach((save, index) => {
      const label = save.name || `Carreira ${index + 1}`;
      const meta = `${save.team || '-'} • ${save.league || '-'} • T${save.season || 1}`;
      options.push(`<option value="${profileId}::${save.id}">${label} (${meta})</option>`);
    });
    if (quick && (!quick.profileId || quick.profileId === profileId)) {
      const quickLabel = quick.saveName || 'Quick Save';
      const quickMeta = `${quick.teamName || quick.league?.name || quick.league?.id || '-'} • T${quick.season || 1}`;
      options.push(`<option value="${QUICK_SAVE_ID}">${quickLabel} (${quickMeta})</option>`);
    }
    if (options.length === 1) {
      ui.loginSaveSlot.innerHTML = '<option value="">- Selecione um save -</option>';
      if (ui.btnLoginLoadSave) ui.btnLoginLoadSave.disabled = true;
      if (ui.btnLoginDeleteSave) ui.btnLoginDeleteSave.disabled = true;
      return;
    }
    ui.loginSaveSlot.innerHTML = options.join('');
    ui.loginSaveSlot.value = '';
    if (ui.btnLoginLoadSave) ui.btnLoginLoadSave.disabled = false;
    if (ui.btnLoginDeleteSave) ui.btnLoginDeleteSave.disabled = false;
  };

  const buildProfileList = () => {
    if (!ui.profileList) return;
    const profiles = loadProfiles();
    if (!profiles.length) {
      const quick = loadQuickSave();
      if (quick) {
        const quickName = quick.managerName || quick.profileId || 'GM';
        ui.profileList.innerHTML = `
          <button class="btn" data-profile-id="${sanitizeProfileId(quickName)}" data-profile-name="${quickName}">
            <div><strong>${quickName}</strong></div>
            <div class="muted">Quick Save disponível</div>
          </button>
        `;
        ui.profileList.querySelectorAll('[data-profile-id]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const name = btn.dataset.profileName || btn.textContent.trim();
            ui.managerNameInput.value = name;
            renderLoginSaveSlots(sanitizeProfileId(name));
          });
        });
      } else {
        ui.profileList.innerHTML = '<div class="muted">Nenhum perfil salvo ainda.</div>';
      }
      return;
    }
    ui.profileList.innerHTML = profiles.map((profile) => `
      <button class="btn" data-profile-id="${profile.id}" data-profile-name="${profile.name}">
        <div><strong>${profile.name}</strong></div>
        ${profile.team ? `<div class="muted">${profile.team} • ${profile.league || '-'}</div>` : ''}
        ${profile.season ? `<div class="muted">Temporada ${profile.season}</div>` : ''}
      </button>
    `).join('');
    ui.profileList.querySelectorAll('[data-profile-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.profileName || btn.textContent.trim();
        ui.managerNameInput.value = name;
        renderLoginSaveSlots(sanitizeProfileId(name));
      });
    });
  };

  const handleLogin = (options = {}) => {
    try {
      const { saveIdOverride = null } = options;
      const loginVisible = ui.loginOverlay && !ui.loginOverlay.classList.contains('hidden');
      if (loginVisible && ui.loginSaveSlot) {
        if (!ui.loginSaveSlot.value) {
          alert('Selecione um save para carregar.');
          ui.loginSaveSlot.focus();
          return;
        }
        handleLoginLoadSave();
        return;
      }
      if (!saveIdOverride && ui.loginSaveSlot && ui.loginSaveSlot.value) {
        handleLoginLoadSave();
        return;
      }
      const rawInput = (ui.managerNameInput && ui.managerNameInput.value ? ui.managerNameInput.value : '').trim();
      const profiles = loadProfiles();
      const fallback = (profiles && profiles.length ? profiles[0].name : null) || activeProfileName || 'GM';
      const rawName = rawInput || fallback;
      if (ui.managerNameInput && !rawInput) {
        ui.managerNameInput.value = rawName;
      }
      activeProfileName = rawName;
      activeProfileId = sanitizeProfileId(rawName);
      if (!profiles.some((p) => p.id === activeProfileId)) {
        profiles.push({ id: activeProfileId, name: activeProfileName });
        saveProfiles(profiles);
      }
      const saves = StorageAPI.listSaves(activeProfileId);
      const profileMeta = StorageAPI.getProfileMeta(activeProfileId);
      if (saveIdOverride && saves.some((s) => s.id === saveIdOverride)) {
        activeSaveId = saveIdOverride;
      } else if (profileMeta && profileMeta.lastSaveId && saves.some((s) => s.id === profileMeta.lastSaveId)) {
        activeSaveId = profileMeta.lastSaveId;
      } else {
        activeSaveId = saves.length ? saves[0].id : null;
      }
      setProfileInfo();
      closeOverlay(ui.loginOverlay);
      closeOverlay(ui.menuOverlay);
      const shouldForceNew = forceNewGame || pendingStartAction === 'new' || pendingStartAction === 'franchise';
      const loaded = shouldForceNew ? null : loadGame(activeSaveId);
      if (loaded) {
        gameState = loaded;
        gameState.managerName = activeProfileName;
        gameState.profileId = activeProfileId;
        normalizeLoadedState();
        if (gameState.league && gameState.league.id) {
          selectedLeagueId = gameState.league.id;
          if (ui.leagueSelect) ui.leagueSelect.value = selectedLeagueId;
          renderLeagueCards();
        }
        if (ui.languageSelect) {
          ui.languageSelect.value = typeof getLanguage === 'function' ? getLanguage() : 'pt';
        }
        applyTranslations();
        updateFanToleranceUI();
        applyCompactMode();
        applyPerformanceMode();
        {
          const currentTeam = getTeamById(gameState.userTeamId);
          applyThemeFromTeam(currentTeam);
          if (currentTeam) {
            saveSplashTheme(currentTeam.colors, `${currentTeam.city} ${currentTeam.nickname}`);
          }
        }
        refreshAudioUI();
        applyAudioPlayback();
        lastAutoSaveAt = Date.now();
        renderAll();
        notifyPendingSaveNotice();
      } else {
        openTeamSelection();
        if (pendingStartAction === 'franchise' && ui.franchiseCity) {
          ui.franchiseCity.focus();
        }
        notifyPendingSaveNotice();
      }
    } catch (err) {
      console.error(err);
      openTeamSelection();
    } finally {
      syncOverlayMode();
      pendingStartAction = null;
      forceNewGame = false;
    }
  };

  const startNewGame = () => {
    ensureDefaultProfile();
    if (ui.languageSelect) {
      if (typeof setLanguage === 'function') {
        setLanguage(ui.languageSelect.value || (typeof getLanguage === 'function' ? getLanguage() : 'pt'));
      }
      applyTranslations();
    }
    gameState = createInitialState(selectedTeamName, selectedLeagueId);
    gameState.settings.language = typeof getLanguage === 'function' ? getLanguage() : 'pt';
    if (ui.fanTolerance) {
      const value = parseFloat(ui.fanTolerance.value);
      gameState.settings.fanTolerance = Number.isNaN(value) ? 1 : value;
    }
    if (ui.compactMode) {
      gameState.settings.compactMode = ui.compactMode.checked;
    }
    if (ui.performanceMode) {
      gameState.settings.performanceMode = ui.performanceMode.checked;
    }
    activeSaveId = gameState.saveId;
    closeOverlay(ui.overlay);
    applyCompactMode();
    applyPerformanceMode();
    {
      const currentTeam = getTeamById(gameState.userTeamId);
      applyThemeFromTeam(currentTeam);
      if (currentTeam) {
        saveSplashTheme(currentTeam.colors, `${currentTeam.city} ${currentTeam.nickname}`);
      }
    }
    refreshAudioUI();
    applyAudioPlayback();
    lastAutoSaveAt = Date.now();
    renderAll();
    renderSaveSlots();
    setSaveInfo();
    saveGame(true);
  };

  const registerServiceWorker = () => {
    if (!('serviceWorker' in navigator)) return;
    const host = window.location && window.location.hostname ? window.location.hostname : '';
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.endsWith('.local');
    const isFile = window.location && window.location.protocol === 'file:';
    if (isLocal || isFile) {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => regs.forEach((reg) => reg.unregister()))
        .catch(() => {});
      if (typeof caches !== 'undefined' && caches.keys) {
        caches.keys().then((keys) => keys.forEach((key) => caches.delete(key))).catch(() => {});
      }
      return;
    }
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  };

  window.openLoginOverlay = openLoginOverlay;
  window.openTeamSelection = openTeamSelection;
  window.openStartLoad = openStartLoad;
  window.startNewGame = startNewGame;
  window.handleLogin = handleLogin;
  window.scheduleTeamPickerRender = scheduleTeamPickerRender;
  window.applyLoadedState = applyLoadedState;
  window.saveGameNow = () => saveGame(true);
  window.loadLatestSave = loadLatestSave;

  window.__bmEventsWired = false;
  const handleFallbackClick = (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const id = button.id;
    if (!id) return;
    const startEl = ui.startScreen || document.getElementById('start-screen');
    const loginEl = ui.loginOverlay || document.getElementById('login-overlay');
    const teamEl = ui.overlay || document.getElementById('overlay');
    const startVisible = startEl && !startEl.classList.contains('hidden');
    const loginVisible = loginEl && !loginEl.classList.contains('hidden');
    const teamSelectVisible = teamEl && !teamEl.classList.contains('hidden');
    if (id === 'btn-start-load') {
      if (!startVisible) return;
      event.preventDefault();
      event.stopPropagation();
      pendingStartAction = null;
      if (openStartLoad()) return;
      openTeamSelection();
      return;
    }
    if (id === 'btn-start-new') {
      if (!startVisible) return;
      event.preventDefault();
      event.stopPropagation();
      pendingStartAction = 'new';
      forceNewGame = true;
      openTeamSelection();
      return;
    }
    if (id === 'btn-start-franchise') {
      if (!startVisible) return;
      event.preventDefault();
      event.stopPropagation();
      pendingStartAction = 'franchise';
      forceNewGame = true;
      openTeamSelection();
      return;
    }
    if (id === 'btn-login') {
      if (!loginVisible) return;
      event.preventDefault();
      event.stopPropagation();
      if (ui.loginSaveSlot && ui.loginSaveSlot.value) {
        handleLoginLoadSave();
      } else {
        handleLogin();
      }
      return;
    }
    if (id === 'btn-login-load-save') {
      if (!loginVisible) return;
      event.preventDefault();
      event.stopPropagation();
      handleLoginLoadSave();
      return;
    }
    if (id === 'btn-login-delete-save') {
      if (!loginVisible) return;
      event.preventDefault();
      event.stopPropagation();
      handleLoginDeleteSave();
      return;
    }
    if (id === 'btn-start') {
      if (!teamSelectVisible) return;
      if (gameState) return;
      event.preventDefault();
      event.stopPropagation();
      startNewGame();
    }
  };

  document.addEventListener('click', handleFallbackClick, true);

  const boot = () => {
    ensureDefaultProfile();
    bindSplashAudio();
    buildLeaguePicker();
    buildMusicTrackOptions();
    buildProfileList();
    showStartScreen();
    setProfileInfo();
    applyTranslations();
    updateFanToleranceUI();
    updateFilterClearState();
    applyCompactMode();
    ensureOverlayState();
    const activeTab = [...ui.tabs].find((tab) => tab.classList.contains('active'));
    if (activeTab && activeTab.dataset.view) {
      activeViewId = activeTab.dataset.view;
    }
    updateTabAccessibility(activeViewId);
    setupTabKeyboardNav();
    updatePerformanceUI();
    if (ui.languageSelect) {
      ui.languageSelect.value = typeof getLanguage === 'function' ? getLanguage() : 'pt';
    }
    registerServiceWorker();
    maybeHydrateTeamSelection();
    hideSplashScreen();
  };

  // ------------------------------
  // Event wiring
  // ------------------------------
  if (ui.tabs && ui.tabs.forEach) {
    ui.tabs.forEach((tab) => {
      tab.addEventListener('click', () => setActiveView(tab.dataset.view));
    });
  }

  if (ui.rosterSort) {
    ui.rosterSort.addEventListener('change', () => {
      if (!gameState || !gameState.settings) return;
      gameState.settings.rosterSort = ui.rosterSort.value;
      renderRoster();
    });
  }

  if (ui.rosterFilter) {
    ui.rosterFilter.addEventListener('change', () => {
      if (!gameState || !gameState.settings) return;
      gameState.settings.rosterFilter = ui.rosterFilter.value;
      renderRoster();
    });
  }

  if (ui.btnStartLoad) {
    ui.btnStartLoad.addEventListener('click', () => {
      pendingStartAction = null;
      forceNewGame = false;
      if (openStartLoad()) return;
      const loaded = loadLatestSave();
      if (loaded && applyLoadedState(loaded)) return;
      openTeamSelection();
    });
  }

  if (ui.btnStartNew) {
    ui.btnStartNew.addEventListener('click', () => {
      pendingStartAction = 'new';
      forceNewGame = true;
      openTeamSelection();
    });
  }

  if (ui.btnStartFranchise) {
    ui.btnStartFranchise.addEventListener('click', () => {
      pendingStartAction = 'franchise';
      forceNewGame = true;
      openTeamSelection();
    });
  }

  if (ui.teamFilter) {
    ui.teamFilter.addEventListener('input', () => {
      scheduleTeamPickerRender(false, 120);
      updateFilterClearState();
    });
  }

  if (ui.btnClearFilter) {
    ui.btnClearFilter.addEventListener('click', () => {
      if (!ui.teamFilter) return;
      ui.teamFilter.value = '';
      updateFilterClearState();
      scheduleTeamPickerRender(false);
    });
  }

  if (ui.teamPicker && !teamPickerBound) {
    ui.teamPicker.addEventListener('click', handleTeamPickerClick);
    teamPickerBound = true;
  }

  if (ui.leagueCards && !ui.leagueCards.dataset.bound) {
    ui.leagueCards.dataset.bound = '1';
    ui.leagueCards.addEventListener('click', (event) => {
      const card = event.target.closest('.league-card');
      if (!card) return;
      const leagueId = card.dataset.league || card.dataset.fallbackLeague;
      if (!leagueId) return;
      selectedLeagueId = leagueId;
      if (ui.leagueSelect) ui.leagueSelect.value = leagueId;
      if (ui.teamFilter) ui.teamFilter.value = '';
      updateFilterClearState();
      scheduleTeamPickerRender(true);
    });
  }

  if (ui.btnLogin) {
    ui.btnLogin.addEventListener('click', handleLogin);
  }

  if (ui.managerNameInput) {
    ui.managerNameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleLogin();
      }
    });
    ui.managerNameInput.addEventListener('input', () => {
      const name = ui.managerNameInput.value.trim();
      renderLoginSaveSlots(name ? sanitizeProfileId(name) : null);
    });
  }

  if (ui.loginQuick) {
    ui.loginQuick.addEventListener('change', () => {
      localStorage.setItem(LOGIN_QUICK_KEY, ui.loginQuick.checked ? '1' : '0');
    });
  }

  if (ui.btnLoginLoadSave) {
    ui.btnLoginLoadSave.addEventListener('click', handleLoginLoadSave);
  }

  if (ui.btnLoginDeleteSave) {
    ui.btnLoginDeleteSave.addEventListener('click', handleLoginDeleteSave);
  }

  ui.loginOverlay.addEventListener('click', (event) => {
    if (event.target === ui.loginOverlay) {
      showStartScreen();
    }
  });

  ui.btnMenu.addEventListener('click', () => {
    openOverlay(ui.menuOverlay);
    renderMusicPlaylist();
  });

  ui.menuOverlay.addEventListener('click', (event) => {
    if (event.target === ui.menuOverlay) {
      closeOverlay(ui.menuOverlay);
    }
  });

  ui.rosterTable.addEventListener('click', handleRosterAction);
  ui.freeAgents.addEventListener('click', handleMarketAction);
  ui.draft.addEventListener('click', handleMarketAction);

  ui.formationOptions.addEventListener('change', handleTacticsChange);
  ui.strategyOptions.addEventListener('change', handleTacticsChange);

  ui.btnSimNext.addEventListener('click', handleSimNext);
  ui.btnSimWeek.addEventListener('click', handleSimWeek);
  ui.btnAdvanceSeason.addEventListener('click', () => {
    if (gameState.phase !== 'offseason') return;
    handleEndSeason();
    renderAll();
  });
  ui.btnSave.addEventListener('click', () => saveGame(true));
  if (ui.btnLoad) ui.btnLoad.addEventListener('click', () => {
    ensureDefaultProfile();
    const chosen = ui.saveSlot ? ui.saveSlot.value : activeSaveId;
    const loaded = chosen ? loadSaveFromSlotValue(chosen) : loadLatestSave();
    if (loaded) {
      applyLoadedState(loaded);
    } else if (hasAnySavedCareers()) {
      buildProfileList();
      openLoginOverlay();
    } else {
      alert('Nenhum save encontrado.');
    }
  });
  if (ui.btnNew) ui.btnNew.addEventListener('click', () => {
    if (!activeProfileId) {
      buildProfileList();
      openLoginOverlay();
      return;
    }
    openTeamSelection();
  });
  if (ui.btnSwitchSave) ui.btnSwitchSave.addEventListener('click', () => {
    openStartLoad();
  });
  if (ui.btnStart) {
    ui.btnStart.addEventListener('click', startNewGame);
  }

  window.__bmEventsWired = true;

  ui.btnMenuSave.addEventListener('click', () => {
    saveGame(true);
    closeOverlay(ui.menuOverlay);
  });

  ui.btnMenuLoad.addEventListener('click', () => {
    buildProfileList();
    closeOverlay(ui.menuOverlay);
    openLoginOverlay();
  });

  ui.btnMenuNew.addEventListener('click', () => {
    closeOverlay(ui.menuOverlay);
    openTeamSelection();
  });

  ui.btnMenuLogout.addEventListener('click', () => {
    activeProfileId = null;
    activeProfileName = null;
    activeSaveId = null;
    gameState = null;
    resetTeamTheme();
    setProfileInfo();
    closeOverlay(ui.menuOverlay);
    buildProfileList();
    showStartScreen();
  });

  ui.btnCreateFranchise.addEventListener('click', handleCreateFranchise);
  if (ui.btnDeleteFranchise) {
    ui.btnDeleteFranchise.addEventListener('click', handleDeleteFranchise);
  }

  ui.btnApplyLanguage.addEventListener('click', () => {
    if (typeof setLanguage === 'function') {
      setLanguage(ui.languageSelect.value || 'pt');
    }
    if (gameState && gameState.settings) {
      gameState.settings.language = typeof getLanguage === 'function' ? getLanguage() : 'pt';
    }
    applyTranslations();
    renderAll();
  });

  if (ui.fanTolerance) {
    ui.fanTolerance.addEventListener('input', handleFanToleranceInput);
  }

  if (ui.compactMode) {
    ui.compactMode.addEventListener('change', () => {
      if (!gameState || !gameState.settings) return;
      gameState.settings.compactMode = ui.compactMode.checked;
      applyCompactMode();
    });
  }

  if (ui.performanceMode) {
    ui.performanceMode.addEventListener('change', () => {
      if (!gameState || !gameState.settings) return;
      gameState.settings.performanceMode = ui.performanceMode.checked;
      applyPerformanceMode();
      logMessage(ui.performanceMode.checked ? 'msg_performance_on' : 'msg_performance_off');
      renderActiveView(activeViewId);
    });
  }

  if (ui.musicToggle) {
    ui.musicToggle.addEventListener('change', () => {
      if (!gameState || !gameState.settings) return;
      clearPreview(false);
      gameState.settings.musicOn = ui.musicToggle.checked;
      refreshAudioUI();
      applyAudioPlayback();
    });
  }

  if (ui.sfxToggle) {
    ui.sfxToggle.addEventListener('change', () => {
      if (!gameState || !gameState.settings) return;
      gameState.settings.sfxOn = ui.sfxToggle.checked;
      refreshAudioUI();
    });
  }

  if (ui.ambientToggle) {
    ui.ambientToggle.addEventListener('change', () => {
      if (!gameState || !gameState.settings) return;
      gameState.settings.ambientOn = ui.ambientToggle.checked;
      refreshAudioUI();
      applyAudioPlayback();
    });
  }

  if (ui.musicVolume) {
    ui.musicVolume.addEventListener('input', () => {
      if (!gameState || !gameState.settings) return;
      const value = parseFloat(ui.musicVolume.value);
      gameState.settings.musicVolume = Number.isNaN(value) ? 0.35 : value;
      if (typeof setMusicVolume === 'function') {
        setMusicVolume(gameState.settings.musicVolume);
      }
    });
  }

  if (ui.sfxVolume) {
    ui.sfxVolume.addEventListener('input', () => {
      if (!gameState || !gameState.settings) return;
      const value = parseFloat(ui.sfxVolume.value);
      gameState.settings.sfxVolume = Number.isNaN(value) ? 0.6 : value;
      if (typeof setSfxVolume === 'function') {
        setSfxVolume(gameState.settings.sfxVolume);
      }
    });
  }

  if (ui.ambientVolume) {
    ui.ambientVolume.addEventListener('input', () => {
      if (!gameState || !gameState.settings) return;
      const value = parseFloat(ui.ambientVolume.value);
      gameState.settings.ambientVolume = Number.isNaN(value) ? 0.2 : value;
      if (typeof setAmbientVolume === 'function') {
        setAmbientVolume(gameState.settings.ambientVolume);
      }
    });
  }

  if (ui.musicTrack) {
    ui.musicTrack.addEventListener('change', () => {
      if (!gameState || !gameState.settings) return;
      clearPreview(false);
      const value = parseInt(ui.musicTrack.value, 10);
      gameState.settings.musicTrack = Number.isNaN(value) ? 0 : value;
      if (gameState.settings.musicOn) {
        if (typeof startMusicTrack === 'function') {
          startMusicTrack(gameState.settings.musicTrack);
        }
      }
    });
  }

  compactMedia.addEventListener('change', () => {
    if (getCompactPreference() === null) {
      applyCompactMode();
    }
  });

  document.addEventListener('click', () => {
    if (!gameState || !gameState.settings) return;
    if (!gameState.settings.musicOn && !gameState.settings.sfxOn) return;
    if (typeof ensureAudioContext === 'function') {
      ensureAudioContext();
    }
  });

  if (ui.btnLiveClose) {
    ui.btnLiveClose.addEventListener('click', closeLiveOverlay);
  }

  if (ui.btnLiveTv) {
    ui.btnLiveTv.addEventListener('click', () => {
      setTvMode(!(AppLive && AppLive.getTvModeEnabled ? AppLive.getTvModeEnabled() : false));
    });
  }

  if (ui.liveSpeedControls) {
    ui.liveSpeedControls.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-speed]');
      if (!btn || !btn.dataset.speed) return;
      if (AppLive && typeof AppLive.setLiveSpeed === 'function') {
        AppLive.setLiveSpeed(btn.dataset.speed);
      }
    });
    if (AppLive && typeof AppLive.setLiveSpeed === 'function') {
      AppLive.setLiveSpeed(1);
    }
  }

  if (ui.btnHotseatAdd) {
    ui.btnHotseatAdd.addEventListener('click', handleHotseatAdd);
  }

  if (ui.hotseatList) {
    ui.hotseatList.addEventListener('click', (event) => {
      const target = event.target;
      if (!target || target.dataset.action !== 'hotseat-remove') return;
      const index = parseInt(target.dataset.index, 10);
      if (Number.isNaN(index)) return;
      handleHotseatRemove(index);
    });
  }

  if (ui.btnHotseatContinue) {
    ui.btnHotseatContinue.addEventListener('click', applyHotseatSwitch);
  }

  if (ui.btnSaveSlotLoad) {
    ui.btnSaveSlotLoad.addEventListener('click', handleSaveSlotLoad);
  }

  if (ui.btnSaveSlotNew) {
    ui.btnSaveSlotNew.addEventListener('click', handleSaveSlotNew);
  }

  if (ui.btnSaveExport) {
    ui.btnSaveExport.addEventListener('click', handleSaveExport);
  }

  if (ui.btnSaveImport) {
    ui.btnSaveImport.addEventListener('click', handleSaveImport);
  }

  if (ui.btnSaveBackup) {
    ui.btnSaveBackup.addEventListener('click', handleSaveBackup);
  }

  if (ui.btnSaveDelete) {
    ui.btnSaveDelete.addEventListener('click', handleSaveDelete);
  }

  if (ui.btnRunTests) {
    ui.btnRunTests.addEventListener('click', handleRunTests);
  }

  if (ui.saveImportFile) {
    ui.saveImportFile.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) handleSaveImportFile(file);
      event.target.value = '';
    });
  }

  if (ui.saveSlot) {
    ui.saveSlot.addEventListener('change', () => {
      const value = ui.saveSlot.value;
      if (!value) return;
      previewThemeFromSaveValue(value);
      if (value === QUICK_SAVE_ID) {
        activeSaveId = QUICK_SAVE_ID;
        return;
      }
      if (value.includes('::')) {
        const parts = value.split('::');
        const profileId = parts[0];
        const saveId = parts[1];
        if (profileId && profileId !== activeProfileId) {
          activeProfileId = profileId;
          activeProfileName = getProfileNameById(profileId);
          setProfileInfo();
        }
        if (saveId) activeSaveId = saveId;
        return;
      }
      activeSaveId = value || activeSaveId;
    });
  }

  if (ui.loginSaveSlot) {
    ui.loginSaveSlot.addEventListener('change', () => {
      const value = ui.loginSaveSlot.value;
      if (!value) return;
      previewThemeFromSaveValue(value);
    });
  }

  if (ui.btnLiveSkip) {
    ui.btnLiveSkip.addEventListener('click', skipLiveLog);
  }

  if (ui.btnAutoLineup) {
    ui.btnAutoLineup.addEventListener('click', handleAutoLineup);
  }

  ui.btnGenerateDraft.addEventListener('click', () => {
    if (gameState.phase !== 'offseason') {
      logMessage('msg_draft_offseason');
      renderAll();
      return;
    }
    gameState.market.draftPool = createDraftPool(60, gameState.league ? gameState.league.id : null);
    startDraft();
    logMessage('msg_draft_generated');
    renderAll();
  });

  ui.btnSimDraft.addEventListener('click', () => {
    if (gameState.phase !== 'offseason') {
      logMessage('msg_draft_offseason');
      renderAll();
      return;
    }
    if (!gameState.draftState) startDraft();
    simulateFullDraft();
    renderAll();
  });

  document.addEventListener('click', (event) => {
    if (event.target && event.target.id === 'btn-apply-training') {
      handleTraining();
    }
    if (event.target && event.target.id === 'btn-offer') {
      handleOffer();
    }
    if (event.target && event.target.id === 'btn-extend') {
      handleExtensionOffer();
    }
    if (event.target && event.target.id === 'btn-trade') {
      handleTrade();
    }
    if (event.target && event.target.dataset.action === 'upgrade') {
      handleFacilityUpgrade(event.target.dataset.facility);
    }
    if (event.target && event.target.dataset.action === 'staff-upgrade') {
      handleStaffUpgrade(event.target.dataset.staff);
    }
    if (event.target && event.target.dataset.action === 'gm-upgrade') {
      handleSkillUpgrade(event.target.dataset.skill);
    }
    if (event.target && event.target.id === 'btn-sponsor-sign') {
      handleSponsorSign();
    }
    if (event.target && event.target.dataset.action === 'trade-suggest') {
      const teamId = event.target.dataset.team;
      const ownId = event.target.dataset.own;
      const targetId = event.target.dataset.target;
      const cash = parseFloat(event.target.dataset.cash || '0');
      const success = executeTrade([ownId], teamId, [targetId], cash, [], []);
      if (success) renderAll();
    }
    if (event.target && event.target.dataset.action === 'trade-accept') {
      const offerId = event.target.dataset.id;
      const offerIndex = gameState.tradeInbox.findIndex((o) => o.id === offerId);
      if (offerIndex >= 0) {
        const offer = gameState.tradeInbox[offerIndex];
        const success = executeTrade(
          offer.requestedIds,
          offer.fromTeamId,
          offer.offeredIds,
          offer.cash,
          offer.requestedPickIds || [],
          offer.offeredPickIds || []
        );
        gameState.tradeInbox.splice(offerIndex, 1);
        if (success) renderAll();
      }
    }
    if (event.target && event.target.dataset.action === 'trade-decline') {
      const offerId = event.target.dataset.id;
      const offerIndex = gameState.tradeInbox.findIndex((o) => o.id === offerId);
      if (offerIndex >= 0) {
        gameState.tradeInbox.splice(offerIndex, 1);
        renderAll();
      }
    }
    const previewBtn = event.target && event.target.closest
      ? event.target.closest('button[data-action="preview-track"]')
      : null;
    if (previewBtn && previewBtn.dataset.track) {
      const index = parseInt(previewBtn.dataset.track, 10);
      if (!Number.isNaN(index)) handlePreviewTrack(index);
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target && event.target.id === 'training-filter') {
      if (!gameState) return;
      gameState.trainingFilter = event.target.value || 'all';
      renderAll();
    }
    if (event.target && event.target.id === 'training-sort') {
      if (!gameState) return;
      gameState.trainingSort = event.target.value || 'progress';
      renderAll();
    }
    if (event.target && event.target.id === 'ext-player') {
      handleExtensionChange();
    }
  });

  const runDiagnostics = () => {
    const issues = [];
    if (!gameState) {
      issues.push('Sem jogo carregado.');
    } else {
      if (!Array.isArray(gameState.teams) || !gameState.teams.length) {
        issues.push('Times ausentes ou vazios.');
      }
      if (!Array.isArray(gameState.schedule) || !gameState.schedule.length) {
        issues.push('Calendario ausente.');
      }
      const rosterIssues = gameState.teams.filter((team) => !team.roster || team.roster.length < 8 || team.roster.length > 15);
      if (rosterIssues.length) {
        issues.push(`Rosters fora do limite: ${rosterIssues.map((t) => t.name).join(', ')}`);
      }
      if (!gameState.league || !gameState.league.id) {
        issues.push('Liga nao definida.');
      }
      if (!gameState.userTeamId) {
        issues.push('Time do usuario nao definido.');
      }
    }
    return { ok: issues.length === 0, issues };
  };

  window.runDiagnostics = runDiagnostics;
  window.getGameState = () => gameState;
  window.GameSimDeps = {
    getState: () => gameState,
    getTeamById,
    computeTeamOvr,
    applyTacticModifiers,
    updateFanFeedback,
    updateMoraleAfterGame,
    applyFatigueAndInjury,
    buildLiveNarrative,
    ensureRotation
  };
  window.runSimulationSmokeTest = () => {
    if (!gameState) return { ok: false, error: 'Sem jogo carregado.' };
    const snapshot = JSON.stringify(gameState);
    try {
      const day = getCurrentDay();
      simulateDay(day, []);
    } catch (err) {
      gameState = JSON.parse(snapshot);
      normalizeLoadedState();
      return { ok: false, error: err ? err.message : 'Erro desconhecido' };
    }
    gameState = JSON.parse(snapshot);
    normalizeLoadedState();
    return { ok: true };
  };

  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;
    const key = event.key;
    const liveOpen = ui.liveOverlay && !ui.liveOverlay.classList.contains('hidden');
    if (key === 'Escape') {
      if (liveOpen && isSimulating && ui.btnLiveSkip) {
        ui.btnLiveSkip.click();
        return;
      }
      if (ui.menuOverlay && !ui.menuOverlay.classList.contains('hidden')) {
        closeOverlay(ui.menuOverlay);
        return;
      }
      if (ui.liveOverlay && !ui.liveOverlay.classList.contains('hidden')) {
        closeLiveOverlay();
        return;
      }
      if (ui.overlay && !ui.overlay.classList.contains('hidden')) {
        closeOverlay(ui.overlay);
        if (!gameState) showStartScreen();
        return;
      }
      if (ui.loginOverlay && !ui.loginOverlay.classList.contains('hidden')) {
        closeOverlay(ui.loginOverlay);
        showStartScreen();
        return;
      }
    }
    if (liveOpen) {
      if (key.toLowerCase() === 't') {
        setTvMode(!(AppLive && AppLive.getTvModeEnabled ? AppLive.getTvModeEnabled() : false));
      }
      if (isSimulating && key.toLowerCase() === 's' && ui.btnLiveSkip) {
        ui.btnLiveSkip.click();
      }
    }
  });

  const fallbackTopbarActions = (event) => {
    const target = event.target.closest ? event.target.closest('button') : null;
    if (!target) return;
    if (target.id === 'btn-save') {
      event.preventDefault();
      saveGame(true);
      return;
    }
    if (target.id === 'btn-load') {
      event.preventDefault();
      ensureDefaultProfile();
      const chosen = ui.saveSlot ? ui.saveSlot.value : activeSaveId;
      const loaded = chosen ? loadSaveFromSlotValue(chosen) : loadLatestSave();
      if (applyLoadedState(loaded)) return;
      if (hasAnySavedCareers()) {
        buildProfileList();
        openLoginOverlay();
        return;
      }
      alert('Nenhum save encontrado.');
      return;
    }
  };

  document.addEventListener('click', fallbackTopbarActions, true);

  const ensureOverlayState = () => {
    const overlays = [
      ui.startScreen,
      ui.overlay,
      ui.loginOverlay,
      ui.menuOverlay,
      ui.liveOverlay,
      ui.hotseatOverlay
    ].filter(Boolean);
    const anyOpen = overlays.some((el) => !el.classList.contains('hidden'));
    document.body.classList.toggle('overlay-open', anyOpen);
  };

  const autoSaveOnHide = () => {
    try {
      if (gameState) saveGame(true);
    } catch (err) {
      // no-op
    }
  };

  window.addEventListener('beforeunload', autoSaveOnHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') autoSaveOnHide();
  });

  setInterval(ensureOverlayState, 1000);

  window.addEventListener('load', hideSplashScreen);
  window.hideSplashScreen = hideSplashScreen;

  boot();

  window.__bmAppReady = true;
})();
