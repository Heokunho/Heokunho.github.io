(function () {
  'use strict';

  var storageKey = 'kunho-theme';
  var root = document.documentElement;
  var media = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var preference = null;

  function valid(theme) {
    return theme === 'light' || theme === 'dark';
  }

  function systemTheme() {
    return media && media.matches ? 'dark' : 'light';
  }

  try {
    var stored = window.localStorage.getItem(storageKey);
    if (valid(stored)) preference = stored;
  } catch (error) {
    // Private browsing and blocked storage still allow an in-memory choice.
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    window.dispatchEvent(new CustomEvent('site-theme-change', {
      detail: { theme: theme }
    }));
  }

  window.siteTheme = {
    get: function () {
      return root.getAttribute('data-theme') || systemTheme();
    },
    set: function (theme) {
      if (!valid(theme)) return;
      preference = theme;
      try {
        window.localStorage.setItem(storageKey, theme);
      } catch (error) {
        // Retain this choice until the page is closed even without storage.
      }
      apply(theme);
    },
    toggle: function () {
      window.siteTheme.set(window.siteTheme.get() === 'light' ? 'dark' : 'light');
    }
  };

  apply(preference || systemTheme());

  function onSystemChange() {
    if (!preference) apply(systemTheme());
  }

  if (media) {
    if (media.addEventListener) media.addEventListener('change', onSystemChange);
    else if (media.addListener) media.addListener(onSystemChange);
  }

  // Keep a second open tab in sync, including a removed stored preference.
  window.addEventListener('storage', function (event) {
    if (event.key !== storageKey && event.key !== null) return;
    preference = valid(event.newValue) ? event.newValue : null;
    apply(preference || systemTheme());
  });
}());
