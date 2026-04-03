// Theme and logo helpers (loaded before app.js).

(() => {
const { clamp } = window.AppUtils || {};

const getUI = () => (typeof window.getUI === 'function' ? window.getUI() : null);

const getTeamLogoText = (city, nickname) => {
  const cityLetter = city ? city.trim()[0] || '' : '';
  const nickLetter = nickname ? nickname.trim()[0] || '' : '';
  return `${cityLetter}${nickLetter}`.toUpperCase();
};

const buildTeamLogoHTML = (text, colors, small = false) => {
  const klass = small ? 'team-logo small' : 'team-logo';
  return `<div class="${klass}" style="--team-primary: ${colors[0]}; --team-secondary: ${colors[1]};">${text}</div>`;
};

const normalizeTeamColors = (colors) => {
  if (!colors) return { primary: '#4cc3ff', secondary: '#ffb347' };
  if (Array.isArray(colors)) {
    return {
      primary: colors[0] || '#4cc3ff',
      secondary: colors[1] || '#ffb347'
    };
  }
  return {
    primary: colors.primary || '#4cc3ff',
    secondary: colors.secondary || '#ffb347'
  };
};

const isHexColor = (value) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);

const hexToRgba = (hex, alpha) => {
  if (!isHexColor(hex)) return `rgba(76, 195, 255, ${alpha})`;
  const value = hex.replace('#', '');
  const expanded = value.length === 3
    ? value.split('').map((c) => c + c).join('')
    : value;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const shadeHex = (hex, percent) => {
  if (!isHexColor(hex)) return hex;
  const value = hex.replace('#', '');
  const expanded = value.length === 3
    ? value.split('').map((c) => c + c).join('')
    : value;
  const num = parseInt(expanded, 16);
  const amt = Math.round(2.55 * percent);
  const r = clamp((num >> 16) + amt, 0, 255);
  const g = clamp(((num >> 8) & 0x00ff) + amt, 0, 255);
  const b = clamp((num & 0x0000ff) + amt, 0, 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

const updateTeamIndicator = (team) => {
  const ui = getUI();
  if (!ui || !ui.teamIndicator) return;
  if (!team) {
    ui.teamIndicator.classList.add('hidden');
    ui.teamIndicator.innerHTML = '';
    return;
  }
  const colors = normalizeTeamColors(team.colors);
  const logoText = getTeamLogoText(team.city, team.nickname);
  ui.teamIndicator.classList.remove('hidden');
  ui.teamIndicator.innerHTML = `
    ${buildTeamLogoHTML(logoText, [colors.primary, colors.secondary], true)}
    <span>${team.city} ${team.nickname}</span>
  `;
};

const applyTeamTheme = (colors, team) => {
  const palette = normalizeTeamColors(colors);
  const root = document.documentElement;
  root.style.setProperty('--team-primary', palette.primary);
  root.style.setProperty('--team-secondary', palette.secondary);
  root.style.setProperty('--team-primary-soft', hexToRgba(palette.primary, 0.2));
  root.style.setProperty('--team-secondary-soft', hexToRgba(palette.secondary, 0.18));
  root.style.setProperty('--primary', palette.primary);
  root.style.setProperty('--primary-dark', shadeHex(palette.primary, -18));
  root.style.setProperty('--accent', palette.secondary);
  updateTeamIndicator(team || null);
};

const resetTeamTheme = () => {
  const root = document.documentElement;
  root.style.setProperty('--team-primary', '#4cc3ff');
  root.style.setProperty('--team-secondary', '#ffb347');
  root.style.setProperty('--team-primary-soft', 'rgba(76, 195, 255, 0.2)');
  root.style.setProperty('--team-secondary-soft', 'rgba(255, 179, 71, 0.18)');
  root.style.setProperty('--primary', '#4cc3ff');
  root.style.setProperty('--primary-dark', '#2491c7');
  root.style.setProperty('--accent', '#ffb347');
  updateTeamIndicator(null);
};

const applyThemeFromTeam = (team) => {
  if (!team) return;
  applyTeamTheme(team.colors, team);
};

window.Theme = {
  getTeamLogoText,
  buildTeamLogoHTML,
  applyTeamTheme,
  resetTeamTheme,
  applyThemeFromTeam
};
})();
