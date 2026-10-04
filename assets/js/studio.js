(function () {
  'use strict';
  var container = document.getElementById('motion-studio');
  if (!container) return;
  var sceneURL = new URL('studio/scene.js', document.currentScript.src).href;
  var shell = document.getElementById('studio-shell');
  var toggle = document.getElementById('studio-toggle');
  var panel = document.getElementById('studio-panel');
  var canvas = document.getElementById('studio-canvas');
  var stage = document.getElementById('studio-stage');
  var loading = document.getElementById('studio-loading');
  var fallback = document.getElementById('studio-fallback');
  var card = document.getElementById('studio-book-card');
  var cardContent = document.getElementById('studio-card-content');
  var cardEyebrow = document.getElementById('studio-card-eyebrow');
  var hover = document.getElementById('studio-hover');
  var themeButton = document.getElementById('studio-theme');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var open = false;
  var visible = true;
  var studio = null;
  var pending = null;
  var keyboardAction = false;
  var failed = false;
  var foldAnimation = null;

  var publications = Array.from(document.querySelectorAll('[data-studio-publication]')).map(function (element, index) {
    return {
      index: index, title: element.dataset.title, venue: element.dataset.venue,
      description: element.dataset.description, href: element.dataset.href
    };
  });
  var newsSource = document.getElementById('studio-news-data');
  var news = Array.from(newsSource.children).map(function (item) {
    return { date: item.dataset.newsDate, text: item.querySelector('.studio-news-copy').textContent.trim() };
  });

  function status(message) { document.getElementById('studio-status').textContent = message; }
  function syncActivity() { if (studio) studio.setActive(open && visible && !document.hidden); }
  function syncTheme() {
    var theme = window.siteTheme.get();
    var label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    themeButton.setAttribute('aria-label', label);
    themeButton.title = label;
    if (studio) studio.setTheme(theme);
  }
  function closeCard(restoreFocus) {
    var hadFocus = card.contains(document.activeElement);
    card.hidden = true;
    if (studio) studio.closeBooks();
    if (restoreFocus || hadFocus) canvas.focus({ preventScroll: true });
  }
  function navigateTo(href) {
    var target = document.getElementById(href.slice(1));
    closeCard(false);
    if (!target) return;
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    history.replaceState(null, '', href);
  }
  function addLink(parent, label, href, local) {
    var link = document.createElement('a');
    link.textContent = label;
    link.href = href;
    if (local) link.addEventListener('click', function (event) { event.preventDefault(); navigateTo(href); });
    parent.appendChild(link);
    return link;
  }
  function runAction(name, event) {
    if (!studio) return;
    keyboardAction = event ? event.detail === 0 : false;
    closeCard(false);
    studio.setPaused(false);
    studio.interact(name);
  }
  function showReading(name) {
    cardContent.replaceChildren();
    cardContent.scrollTop = 0;
    if (name === 'books') {
      cardEyebrow.textContent = 'Publications · ' + publications.length + ' books';
      var list = document.createElement('ol');
      list.className = 'studio-book-list';
      publications.forEach(function (publication, index) {
        var row = document.createElement('li');
        var button = document.createElement('button');
        button.type = 'button';
        button.dataset.publicationIndex = String(index);
        var number = document.createElement('span');
        number.className = 'studio-book-number';
        number.textContent = String(index + 1).padStart(2, '0');
        var title = document.createElement('span');
        title.textContent = publication.title;
        button.append(number, title);
        button.addEventListener('click', function (event) { runAction('publication:' + index, event); });
        row.appendChild(button);
        list.appendChild(row);
      });
      cardContent.appendChild(list);
      if (!publications.length) cardContent.textContent = 'New publications will appear here.';
    } else if (name === 'news') {
      cardEyebrow.textContent = 'The latest news';
      var headlines = newsSource.cloneNode(true);
      headlines.removeAttribute('id');
      headlines.className = 'studio-news-list';
      cardContent.appendChild(headlines);
      addLink(cardContent, 'View all news ↗', '#news', true).className = 'studio-news-link';
    } else {
      var publication = publications[Number(name.split(':')[1])];
      if (!publication) return;
      cardEyebrow.textContent = publication.venue + ' · Publication ' + (publication.index + 1);
      var title = document.createElement('p');
      title.className = 'studio-publication-title';
      title.textContent = publication.title;
      var venue = document.createElement('p');
      venue.className = 'studio-publication-venue';
      venue.textContent = publication.description;
      var links = document.createElement('div');
      links.className = 'studio-card-links';
      addLink(links, 'View publication ↗', publication.href, true).id = 'studio-publication-link';
      cardContent.append(title, venue, links);
    }
    card.dataset.reading = name;
    card.hidden = false;
    if (keyboardAction) cardContent.querySelector('button, a')?.focus({ preventScroll: true });
  }
  function showFailure(error) {
    failed = true;
    loading.hidden = true;
    fallback.hidden = false;
    canvas.hidden = true;
    card.hidden = true;
    stage.setAttribute('aria-busy', 'false');
    status('The 3D study is unavailable. Theme and publication controls are still available.');
    if (studio) { studio.dispose(); studio = null; }
    console.warn('Interactive study could not start:', error);
  }
  function ensureStudio() {
    if (studio || pending || failed) return pending;
    stage.setAttribute('aria-busy', 'true');
    loading.hidden = false;
    fallback.hidden = true;
    canvas.hidden = false;
    pending = import(sceneURL).then(function (module) {
      studio = module.createStudio(canvas, {
        onStatus: status,
        onInteraction: function (name) {
          if (name === 'lamp') window.siteTheme.toggle();
          else if (name === 'books' || name === 'news' || /^publication:\d+$/.test(name)) showReading(name);
        },
        onExit: function () {
          status('3D Interaction closed. Open it to explore again.');
          setOpen(false, true);
          toggle.focus({ preventScroll: true });
        },
        onBooksClose: function () { card.hidden = true; },
        onUserAction: function () { keyboardAction = false; },
        onHover: function (target) {
          hover.hidden = !target;
          if (target) {
            hover.textContent = target.label;
            var width = hover.offsetWidth;
            var height = hover.offsetHeight;
            var top = target.y - height - 10;
            if (top < 8) top = target.y + 12;
            hover.style.left = Math.max(8, Math.min(stage.clientWidth - width - 8, target.x + 12)) + 'px';
            hover.style.top = Math.max(8, Math.min(stage.clientHeight - height - 8, top)) + 'px';
          }
        },
        onError: function (error) { window.setTimeout(function () { showFailure(error); }, 0); }
      }, { publications: publications, news: news });
      loading.hidden = true;
      stage.setAttribute('aria-busy', 'false');
      container.dataset.ready = 'true';
      studio.setPaused(reducedMotion.matches);
      syncTheme();
      syncActivity();
    }).catch(showFailure).finally(function () { pending = null; });
    return pending;
  }
  function measurePanel() {
    // Keep the canvas at its final width while the surrounding frame folds.
    panel.style.width = Math.max(0, shell.clientWidth - 2) + 'px';
    if (!panel.hidden) container.style.setProperty('--studio-expanded-height', (panel.scrollHeight + 2) + 'px');
  }
  function setOpen(value, animate) {
    var previousRect = container.getBoundingClientRect();
    if (foldAnimation) { foldAnimation.cancel(); foldAnimation = null; }
    open = value;
    if (value && studio) studio.resetExit();
    if (!value) {
      closeCard(false);
      if (panel.contains(document.activeElement) || document.activeElement === themeButton) toggle.focus({ preventScroll: true });
    }
    panel.hidden = false;
    panel.inert = !value;
    panel.setAttribute('aria-hidden', String(!value));
    measurePanel();
    container.dataset.open = String(value);
    toggle.setAttribute('aria-expanded', String(value));
    var label = value ? 'Collapse 3D Interaction' : 'Open 3D Interaction';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    themeButton.hidden = !value;
    var targetRect = container.getBoundingClientRect();
    if (animate && !reducedMotion.matches && container.animate) {
      var animation = container.animate([
        { width: previousRect.width + 'px', height: previousRect.height + 'px', borderRadius: value ? '22px' : '12px' },
        { width: targetRect.width + 'px', height: targetRect.height + 'px', borderRadius: value ? '12px' : '22px' }
      ], { duration: 380, easing: 'cubic-bezier(.22,.8,.28,1)' });
      foldAnimation = animation;
      animation.onfinish = function () {
        if (foldAnimation !== animation) return;
        foldAnimation = null;
        panel.hidden = !open;
      };
    } else panel.hidden = !value;
    if (value && visible) ensureStudio();
    syncActivity();
  }

  toggle.addEventListener('click', function () { setOpen(!open, true); });
  themeButton.addEventListener('click', function () { window.siteTheme.toggle(); });
  document.getElementById('studio-card-close').addEventListener('click', function () { closeCard(true); });
  document.getElementById('studio-retry').addEventListener('click', function () { failed = false; ensureStudio(); });
  container.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !card.hidden) { closeCard(true); event.preventDefault(); }
  });
  window.addEventListener('site-theme-change', syncTheme);
  document.addEventListener('visibilitychange', syncActivity);
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && open) ensureStudio();
      syncActivity();
    });
    observer.observe(shell);
  }
  var sizeObserver = new ResizeObserver(measurePanel);
  sizeObserver.observe(shell);
  reducedMotion.addEventListener('change', function (event) {
    if (studio) studio.setPaused(event.matches);
    if (event.matches && foldAnimation) { foldAnimation.finish(); }
  });
  syncTheme();
  setOpen(open, false);
}());
