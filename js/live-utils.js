// Live simulation text helpers.

const { rand } = window.AppUtils || {};

const getTranslator = () => (typeof window.t === 'function' ? window.t : (key) => key);

const buildHighlightLine = (player, stat) => {
  const t = getTranslator();
  if (!player || !stat) return null;
  const traits = player.traits || [];
  if (stat.assists >= 10 || traits.includes('Playmaker')) {
    return t('live_highlight_playmaker', { name: player.name });
  }
  if (stat.rebounds >= 12 || traits.includes('Reboteiro')) {
    return t('live_highlight_board', { name: player.name });
  }
  if (traits.includes('Sniper') || player.shooting >= 85) {
    return t('live_highlight_sniper', { name: player.name });
  }
  if (traits.includes('Dunker') || player.physical >= 85) {
    return t('live_highlight_dunker', { name: player.name });
  }
  if (traits.includes('Defensor') || player.defense >= 85) {
    return t('live_highlight_defender', { name: player.name });
  }
  return t('live_highlight_default', { name: player.name });
};

const buildLiveLine = (text, meta = {}, speaker = null, tag = null, tagClass = '', highlight = false) => ({
  text,
  meta,
  speaker,
  tag,
  tagClass,
  highlight
});

const getLineText = (line) => (typeof line === 'string' ? line : line && line.text ? line.text : '');

const formatClock = (minutes, seconds) => {
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `${mm}:${ss}`;
};

const formatClockFromSeconds = (seconds) => {
  const safe = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return formatClock(mins, secs);
};

window.LiveUtils = {
  buildHighlightLine,
  buildLiveLine,
  getLineText,
  formatClock,
  formatClockFromSeconds,
  rand
};
