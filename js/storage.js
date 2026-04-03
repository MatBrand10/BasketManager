(() => {
  const STORAGE_KEY = 'gm-pro-basketball-save-v1';
  const PROFILE_LIST_KEY = 'gm-pro-basketball-profiles';
  const SAVE_LIST_KEY = 'gm-pro-basketball-saves';
  const BACKUP_KEY_PREFIX = 'gm-pro-basketball-backups';
  const MAX_BACKUPS = 5;

  let lastError = null;

  const setLastError = (err) => {
    lastError = err;
  };

  const storage = (() => {
    try {
      if (typeof window !== 'undefined' && window.electronStorage) return window.electronStorage;
    } catch (err) {
      // ignore
    }
    return localStorage;
  })();

  const safeGetItem = (key) => {
    try {
      return storage.getItem(key);
    } catch (err) {
      setLastError(err);
      return null;
    }
  };

  const safeRemoveItem = (key) => {
    try {
      storage.removeItem(key);
      return true;
    } catch (err) {
      setLastError(err);
      return false;
    }
  };

  const safeParse = (raw, fallback) => {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch (err) {
      return fallback;
    }
  };

  const createId = () => Math.random().toString(36).slice(2, 10);

  const getProfileKey = (profileId, saveId) => `${STORAGE_KEY}:${profileId}:${saveId}`;

  const loadProfiles = () => safeParse(safeGetItem(PROFILE_LIST_KEY), []);

  const safeSetItem = (key, value) => {
    try {
      storage.setItem(key, value);
      return true;
    } catch (err) {
      setLastError(err);
      return false;
    }
  };

  const saveProfiles = (profiles) => safeSetItem(PROFILE_LIST_KEY, JSON.stringify(profiles));

  const loadSavesMeta = () => safeParse(safeGetItem(SAVE_LIST_KEY), []);

  const saveSavesMeta = (items) => safeSetItem(SAVE_LIST_KEY, JSON.stringify(items));

  const listSaves = (profileId) => {
    const items = loadSavesMeta().filter((item) => item.profileId === profileId);
    return items.sort((a, b) => (b.lastSave || 0) - (a.lastSave || 0));
  };

  const upsertSaveMeta = (profileId, saveId, state, name) => {
    const items = loadSavesMeta();
    const team = state && state.userTeamId ? state.teams.find((t) => t.id === state.userTeamId) : null;
    const entry = {
      id: saveId,
      profileId,
      name: name || (state ? state.saveName : undefined),
      team: team ? team.name : undefined,
      league: state && state.league ? state.league.name : undefined,
      season: state ? state.season : undefined,
      lastSave: Date.now()
    };
    const index = items.findIndex((item) => item.id === saveId && item.profileId === profileId);
    if (index >= 0) {
      items[index] = { ...items[index], ...entry };
    } else {
      items.push(entry);
    }
    saveSavesMeta(items);
  };

  const safeStringify = (state) => {
    try {
      return JSON.stringify(state);
    } catch (err) {
      setLastError(err);
      return null;
    }
  };

  const saveState = (profileId, saveId, state) => {
    if (!profileId || !saveId || !state) return false;
    const payload = safeStringify(state);
    if (!payload) return false;
    const ok = safeSetItem(getProfileKey(profileId, saveId), payload);
    if (!ok) return false;
    upsertSaveMeta(profileId, saveId, state);
    return true;
  };

  const loadState = (profileId, saveId) => {
    if (!profileId || !saveId) return null;
    const raw = safeGetItem(getProfileKey(profileId, saveId));
    return safeParse(raw, null);
  };

  const deleteSave = (profileId, saveId) => {
    safeRemoveItem(getProfileKey(profileId, saveId));
    const items = loadSavesMeta().filter((item) => !(item.profileId === profileId && item.id === saveId));
    saveSavesMeta(items);
    deleteBackups(profileId, saveId);
  };

  const getProfileMeta = (profileId) => loadProfiles().find((p) => p.id === profileId);

  const updateProfileMeta = (profileId, meta) => {
    const profiles = loadProfiles();
    const index = profiles.findIndex((p) => p.id === profileId);
    if (index >= 0) {
      profiles[index] = { ...profiles[index], ...meta };
    } else {
      profiles.push({ id: profileId, name: meta.name || profileId, ...meta });
    }
    saveProfiles(profiles);
  };

  const createBackup = (profileId, saveId, state) => {
    if (!profileId || !saveId || !state) return false;
    const key = `${BACKUP_KEY_PREFIX}:${profileId}:${saveId}`;
    const backups = safeParse(safeGetItem(key), []);
    backups.unshift({
      id: createId(),
      date: Date.now(),
      state
    });
    const trimmed = backups.slice(0, MAX_BACKUPS);
    return safeSetItem(key, JSON.stringify(trimmed));
  };

  const listBackups = (profileId, saveId) => {
    if (!profileId || !saveId) return [];
    const key = `${BACKUP_KEY_PREFIX}:${profileId}:${saveId}`;
    return safeParse(safeGetItem(key), []);
  };

  const loadLatestBackup = (profileId, saveId) => {
    const backups = listBackups(profileId, saveId);
    return backups.length ? backups[0].state : null;
  };

  const deleteBackups = (profileId, saveId) => {
    if (!profileId || !saveId) return;
    const key = `${BACKUP_KEY_PREFIX}:${profileId}:${saveId}`;
    safeRemoveItem(key);
  };

  const downloadJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportState = (state) => {
    if (!state) return;
    const name = state.saveName ? state.saveName.replace(/\s+/g, '_') : 'carreira';
    downloadJSON(state, `${name}_T${state.season || 1}.json`);
  };

  const importState = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = safeParse(reader.result, null);
      if (!parsed) {
        reject(new Error('invalid'));
        return;
      }
      resolve(parsed);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

  window.StorageAPI = {
    createId,
    getProfileKey,
    loadProfiles,
    saveProfiles,
    listSaves,
    upsertSaveMeta,
    saveState,
    loadState,
    deleteSave,
    getProfileMeta,
    updateProfileMeta,
    createBackup,
    listBackups,
    loadLatestBackup,
    deleteBackups,
    exportState,
    importState,
    getLastError: () => lastError
  };
})();
