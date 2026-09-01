(() => {
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');

  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!isOpen));
      nav.classList.toggle('is-open', !isOpen);
    });

    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        navToggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      }
    });
  }

  const reporting = document.querySelector('[data-reporting-browser]');

  if (reporting) {
    const cards = Array.from(reporting.querySelectorAll('[data-clip-card]'));
    const buttons = Array.from(reporting.querySelectorAll('[data-filter-kind]'));
    const search = reporting.querySelector('[data-reporting-search]');
    const count = reporting.querySelector('[data-reporting-count]');
    const empty = reporting.querySelector('[data-reporting-empty]');
    const loadMore = reporting.querySelector('[data-load-more]');
    const clear = reporting.querySelector('[data-clear-filters]');
    const advancedFilters = Array.from(reporting.querySelectorAll('[data-advanced-filters]'));
    const params = new URLSearchParams(window.location.search);
    const searchIndex = new Map();
    let searchIndexPromise;

    const state = {
      collection: params.get('view') || (params.toString() ? 'all' : 'featured'),
      source: params.get('outlet') || 'all',
      topic: params.get('topic') || 'all',
      query: params.get('q') || '',
      limit: 18
    };

    const normalize = (value) => (value || '').toLowerCase().trim();

    function loadSearchIndex() {
      if (!searchIndexPromise) {
        searchIndexPromise = fetch('/assets/data/reporting-search.json')
          .then((response) => {
            if (!response.ok) throw new Error('Search index unavailable');
            return response.json();
          })
          .then((items) => {
            items.forEach((item) => searchIndex.set(String(item.id), normalize(item.text)));
          })
          .catch(() => {
            // Headline, outlet, and date search still work if the body index cannot load.
          });
      }
      return searchIndexPromise;
    }

    function setActiveButtons() {
      buttons.forEach((button) => {
        const isActive = state[button.dataset.filterKind] === button.dataset.filterValue;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });
    }

    function updateUrl() {
      const next = new URLSearchParams();
      if (state.collection === 'all') next.set('view', 'all');
      if (state.collection === 'all' && state.source !== 'all') next.set('outlet', state.source);
      if (state.collection === 'all' && state.topic !== 'all') next.set('topic', state.topic);
      if (state.query) next.set('q', state.query);
      const queryString = next.toString();
      const url = `${window.location.pathname}${queryString ? `?${queryString}` : ''}#reporting`;
      window.history.replaceState(null, '', url);
    }

    function render({ updateHistory = true } = {}) {
      const query = normalize(state.query);
      const showAdvancedFilters = state.collection === 'all';
      advancedFilters.forEach((group) => { group.hidden = !showAdvancedFilters; });

      const matches = cards.filter((card) => {
        const collectionMatch = state.collection === 'all' || card.dataset.featured === 'true';
        const sourceMatch = state.source === 'all' || card.dataset.source.includes(state.source);
        const topics = card.dataset.topics.split(/\s+/).filter(Boolean);
        const topicMatch = state.topic === 'all' || topics.includes(state.topic);
        const searchableText = `${normalize(card.dataset.search)} ${searchIndex.get(card.dataset.clipId) || ''}`;
        const searchMatch = !query || searchableText.includes(query);
        return collectionMatch && sourceMatch && topicMatch && searchMatch;
      });

      cards.forEach((card) => { card.hidden = true; });
      matches.slice(0, state.limit).forEach((card) => { card.hidden = false; });

      const visibleCount = Math.min(matches.length, state.limit);
      count.textContent = matches.length === visibleCount
        ? `${matches.length} ${matches.length === 1 ? 'story' : 'stories'}`
        : `Showing ${visibleCount} of ${matches.length} stories`;
      empty.hidden = matches.length !== 0;
      loadMore.hidden = matches.length <= state.limit;

      const isDefault = state.collection === 'featured' && state.source === 'all' && state.topic === 'all' && !state.query;
      clear.hidden = isDefault;
      setActiveButtons();
      if (updateHistory) updateUrl();
    }

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        state[button.dataset.filterKind] = button.dataset.filterValue;
        if (button.dataset.filterKind === 'collection' && state.collection === 'featured') {
          state.source = 'all';
          state.topic = 'all';
        }
        state.limit = 18;
        render();
      });
    });

    if (search) {
      search.value = state.query;
      search.addEventListener('focus', loadSearchIndex, { once: true });
      search.addEventListener('input', async () => {
        state.query = search.value.trim();
        if (state.query) state.collection = 'all';
        state.limit = 18;
        render();
        if (state.query) {
          const currentQuery = state.query;
          await loadSearchIndex();
          if (state.query === currentQuery) render({ updateHistory: false });
        }
      });
    }

    loadMore.addEventListener('click', () => {
      state.limit += 18;
      render({ updateHistory: false });
    });

    clear.addEventListener('click', () => {
      state.collection = 'featured';
      state.source = 'all';
      state.topic = 'all';
      state.query = '';
      state.limit = 18;
      search.value = '';
      render();
    });

    render({ updateHistory: false });
    if (state.query) loadSearchIndex().then(() => render({ updateHistory: false }));
  }

  const newsletterForm = document.querySelector('[data-newsletter-form]');

  if (newsletterForm) {
    const iframe = document.getElementById('hidden_iframe');
    const tokenField = document.getElementById('recaptchaResponse');
    const status = document.querySelector('[data-form-status]');
    const success = document.querySelector('[data-newsletter-success]');
    const reset = document.querySelector('[data-newsletter-reset]');
    let submitted = false;

    newsletterForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!newsletterForm.reportValidity()) return;
      status.textContent = 'Submitting…';

      const submitForm = (token = '') => {
        tokenField.value = token;
        submitted = true;
        newsletterForm.submit();
      };

      if (window.grecaptcha) {
        window.grecaptcha.ready(() => {
          window.grecaptcha.execute('6LdU-iorAAAAANTATiiq-Iv3yMk8T5AgUun7cXlt', { action: 'newsletter' })
            .then(submitForm)
            .catch(() => {
              status.textContent = 'Please try again.';
            });
        });
      } else {
        submitForm();
      }
    });

    iframe.addEventListener('load', () => {
      if (!submitted) return;
      newsletterForm.hidden = true;
      success.hidden = false;
      status.textContent = '';
    });

    reset.addEventListener('click', () => {
      newsletterForm.reset();
      newsletterForm.hidden = false;
      success.hidden = true;
      submitted = false;
      newsletterForm.querySelector('input[type="email"]').focus();
    });
  }
})();
