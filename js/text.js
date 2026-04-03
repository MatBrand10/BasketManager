(() => {
  let currentLanguage = 'pt';

  const formatMoney = (value) => `R$ ${value.toFixed(1)} mi`;

  const t = (key, vars = {}) => {
    const dict = (typeof I18N !== 'undefined' && I18N[currentLanguage]) ? I18N[currentLanguage] : (I18N ? I18N.pt : {});
    let text = (dict && dict[key]) || (I18N && I18N.pt ? I18N.pt[key] : null) || key;
    Object.keys(vars).forEach((k) => {
      text = text.replace(new RegExp(`{${k}}`, 'g'), vars[k]);
    });
    return text;
  };

  const getDeps = () => window.AppTextDeps || {};

  const logMessage = (key, vars = {}) => {
    const deps = getDeps();
    if (typeof deps.addMessage === 'function') {
      deps.addMessage(t(key, vars));
    }
  };

  const applyTranslations = () => {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });
    const ui = window.AppUI || {};
    const deps = getDeps();
    if (ui.btnLiveTv && typeof deps.getTvModeEnabled === 'function') {
      ui.btnLiveTv.textContent = deps.getTvModeEnabled() ? t('btn_live_tv_exit') : t('btn_live_tv');
    }
  };

  const getLanguage = () => currentLanguage;
  const setLanguage = (lang) => {
    currentLanguage = lang || 'pt';
  };

  window.AppText = {
    t,
    formatMoney,
    logMessage,
    applyTranslations,
    getLanguage,
    setLanguage
  };

  window.t = t;
})();
