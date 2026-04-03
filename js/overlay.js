(() => {
  const focusTrapMap = new WeakMap();
  let lastFocusedElement = null;

  const getUI = () => window.AppUI || {};

  const getFocusableElements = (container) => (
    [...container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((el) => !el.disabled && el.offsetParent !== null)
  );

  // Keeps overlays above the main UI and disables the tabs/topbar while open.
  const syncOverlayMode = () => {
    const ui = getUI();
    const overlays = [ui.startScreen, ui.overlay, ui.loginOverlay, ui.menuOverlay, ui.liveOverlay, ui.hotseatOverlay];
    const anyOpen = overlays.some((el) => el && !el.classList.contains('hidden'));
    document.body.classList.toggle('overlay-open', anyOpen);
  };

  const enableFocusTrap = (overlay) => {
    if (!overlay || focusTrapMap.has(overlay)) return;
    const handler = (event) => {
      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(overlay);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    overlay.addEventListener('keydown', handler);
    focusTrapMap.set(overlay, handler);
  };

  const disableFocusTrap = (overlay) => {
    const handler = focusTrapMap.get(overlay);
    if (!handler) return;
    overlay.removeEventListener('keydown', handler);
    focusTrapMap.delete(overlay);
  };

  const openOverlay = (overlay) => {
    if (!overlay) return;
    lastFocusedElement = document.activeElement;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-modal', 'true');
    enableFocusTrap(overlay);
    const focusable = getFocusableElements(overlay);
    if (focusable.length) focusable[0].focus();
    syncOverlayMode();
  };

  const closeOverlay = (overlay) => {
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    disableFocusTrap(overlay);
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
    syncOverlayMode();
  };

  window.AppOverlay = {
    syncOverlayMode,
    openOverlay,
    closeOverlay,
    enableFocusTrap,
    disableFocusTrap,
    getFocusableElements
  };
})();
