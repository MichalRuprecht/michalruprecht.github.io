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

  const siteHeader = document.querySelector('.site-header');

  if (siteHeader) {
    let lastScrollY = window.scrollY;
    let directionStartY = window.scrollY;
    let direction = 0;
    let ticking = false;

    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const menuIsOpen = navToggle && navToggle.getAttribute('aria-expanded') === 'true';
        const delta = currentScrollY - lastScrollY;
        const nextDirection = delta > 0 ? 1 : delta < 0 ? -1 : direction;

        if (nextDirection !== direction) {
          direction = nextDirection;
          directionStartY = currentScrollY;
        }

        if (currentScrollY < 120 || menuIsOpen) {
          siteHeader.classList.remove('is-hidden');
        } else if (direction === 1 && currentScrollY > 260 && currentScrollY - directionStartY > 90) {
          siteHeader.classList.add('is-hidden');
        } else if (direction === -1 && directionStartY - currentScrollY > 35) {
          siteHeader.classList.remove('is-hidden');
        }

        lastScrollY = Math.max(currentScrollY, 0);
        ticking = false;
      });
    }, { passive: true });
  }

  const reporting = document.querySelector('[data-reporting-browser]');

  if (reporting) {
    const cards = Array.from(reporting.querySelectorAll('[data-clip-card]'));
    const buttons = Array.from(reporting.querySelectorAll('[data-filter-kind]'));
    const search = reporting.querySelector('[data-reporting-search]');
    const count = reporting.querySelector('[data-reporting-count]');
    const grid = reporting.querySelector('[data-clip-grid]');
    const empty = reporting.querySelector('[data-reporting-empty]');
    const loadMore = reporting.querySelector('[data-load-more]');
    const clear = reporting.querySelector('[data-clear-filters]');
    const advancedFilters = Array.from(reporting.querySelectorAll('[data-advanced-filters]'));
    const params = new URLSearchParams(window.location.search);
    const searchIndex = new Map();
    const originalOrder = new Map(cards.map((card, index) => [card, index]));
    const sourceLabels = new Map(
      buttons
        .filter((button) => button.dataset.filterKind === 'source')
        .map((button) => [button.dataset.filterValue, button.textContent.trim()])
    );
    const topicLabels = new Map(
      buttons
        .filter((button) => button.dataset.filterKind === 'topic')
        .map((button) => [button.dataset.filterValue, button.textContent.trim()])
    );
    let searchIndexPromise;

    const state = {
      collection: params.get('view') || (params.toString() ? 'all' : 'featured'),
      source: params.get('outlet') || 'all',
      topic: params.get('topic') || 'all',
      query: params.get('q') || '',
      extra: 0
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

    function occurrences(text, term) {
      if (!term) return 0;
      let total = 0;
      let fromIndex = 0;
      while ((fromIndex = text.indexOf(term, fromIndex)) !== -1) {
        total += 1;
        fromIndex += term.length;
      }
      return total;
    }

    function searchText(card) {
      return `${normalize(card.dataset.search)} ${searchIndex.get(card.dataset.clipId) || ''}`;
    }

    function relevance(card, query, terms) {
      const title = normalize(card.dataset.title);
      const body = searchIndex.get(card.dataset.clipId) || '';
      const basic = normalize(card.dataset.search);
      let score = 0;

      score += occurrences(title, query) * 1000;
      score += occurrences(body, query) * 45;
      terms.forEach((term) => {
        score += occurrences(title, term) * 180;
        score += occurrences(basic, term) * 25;
        score += occurrences(body, term) * 5;
      });
      return score;
    }

    function resultLabel(total, visibleCount, query) {
      const descriptors = [];
      if (state.collection === 'featured') {
        descriptors.push('featured');
      } else {
        if (state.source !== 'all') descriptors.push(sourceLabels.get(state.source) || state.source);
        if (state.topic !== 'all') descriptors.push((topicLabels.get(state.topic) || state.topic).toLowerCase());
      }

      const noun = total === 1 ? 'story' : 'stories';
      const describedStories = `${descriptors.length ? `${descriptors.join(' ')} ` : ''}${noun}`;
      const apNumber = (number) => {
        const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
        return number < 10 ? words[number] : String(number);
      };
      const quantity = visibleCount < total
        ? `${apNumber(visibleCount)} of ${apNumber(total)}`
        : apNumber(total);
      const related = query ? ` related to “${state.query}”` : '';
      return `Showing ${quantity} ${describedStories}${related}`;
    }

    function render({ updateHistory = true } = {}) {
      const query = normalize(state.query);
      const terms = query.split(/\s+/).filter(Boolean);
      const showAdvancedFilters = state.collection === 'all';
      advancedFilters.forEach((group) => { group.hidden = !showAdvancedFilters; });

      const matches = cards.filter((card) => {
        const collectionMatch = state.collection === 'all' || card.dataset.featured === 'true';
        const sourceMatch = state.source === 'all' || card.dataset.source.includes(state.source);
        const topics = card.dataset.topics.split(/\s+/).filter(Boolean);
        const topicMatch = state.topic === 'all' || topics.includes(state.topic);
        const searchableText = searchText(card);
        const searchMatch = !query || terms.every((term) => searchableText.includes(term));
        return collectionMatch && sourceMatch && topicMatch && searchMatch;
      });

      if (query) {
        matches.sort((a, b) => {
          const scoreDifference = relevance(b, query, terms) - relevance(a, query, terms);
          return scoreDifference || originalOrder.get(a) - originalOrder.get(b);
        });
      } else if (state.collection === 'featured') {
        matches.sort((a, b) => Number(a.dataset.featuredRank) - Number(b.dataset.featuredRank));
      } else {
        matches.sort((a, b) => originalOrder.get(a) - originalOrder.get(b));
      }

      matches.forEach((card) => grid.appendChild(card));

      cards.forEach((card) => {
        card.hidden = true;
        card.classList.remove('is-large');
      });

      const largeCard = matches.slice(0, 6).find((card) => card.dataset.large === 'true');
      if (largeCard) largeCard.classList.add('is-large');
      const initialLimit = largeCard ? 5 : 6;
      const limit = initialLimit + state.extra;
      matches.slice(0, limit).forEach((card) => { card.hidden = false; });

      const visibleCount = Math.min(matches.length, limit);
      count.textContent = resultLabel(matches.length, visibleCount, query);
      empty.hidden = matches.length !== 0;
      loadMore.hidden = matches.length <= limit;

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
        state.extra = 0;
        render();
      });
    });

    if (search) {
      search.value = state.query;
      search.addEventListener('focus', loadSearchIndex, { once: true });
      search.addEventListener('input', async () => {
        state.query = search.value.trim();
        if (state.query) state.collection = 'all';
        state.extra = 0;
        render();
        if (state.query) {
          const currentQuery = state.query;
          await loadSearchIndex();
          if (state.query === currentQuery) render({ updateHistory: false });
        }
      });
    }

    loadMore.addEventListener('click', () => {
      state.extra += 6;
      render({ updateHistory: false });
    });

    clear.addEventListener('click', () => {
      state.collection = 'featured';
      state.source = 'all';
      state.topic = 'all';
      state.query = '';
      state.extra = 0;
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
