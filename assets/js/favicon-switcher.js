(function () {
  'use strict';

  // Leave the source links in place for browsers with JavaScript disabled.
  var links = Array.prototype.slice.call(
    document.head.querySelectorAll('link[rel~="icon"][media]')
  );
  var sources = links.map(function (link) {
    return {
      link: link,
      theme: /prefers-color-scheme\s*:\s*dark/.test(link.media) ? 'dark' : 'light'
    };
  });
  var media = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function update() {
    var theme = document.documentElement.getAttribute('data-theme') ||
      (media && media.matches ? 'dark' : 'light');
    sources.forEach(function (source) {
      // The explicit theme takes precedence over the operating system query.
      source.link.media = source.theme === theme ? 'all' : 'not all';
    });
  }

  window.addEventListener('site-theme-change', update);
  if (media) {
    if (media.addEventListener) media.addEventListener('change', update);
    else if (media.addListener) media.addListener(update);
  }
  update();
}());
