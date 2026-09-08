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

  const spotifyPlayers = Array.from(document.querySelectorAll('[data-spotify-player]'));

  if (spotifyPlayers.length) {
    const formatAudioTime = (milliseconds) => {
      if (!Number.isFinite(milliseconds) || milliseconds < 0) return '–:––';
      const totalSeconds = Math.floor(milliseconds / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = String(totalSeconds % 60).padStart(2, '0');
      return `${minutes}:${seconds}`;
    };

    const formatListenLength = (milliseconds) => {
      const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
      const totalSeconds = Math.max(1, Math.floor(milliseconds / 1000));
      const formatNumber = (value) => (value < 10 ? numberWords[value] : String(value));

      if (totalSeconds < 60) return `${formatNumber(totalSeconds)}-second listen`;
      const roundedMinutes = Math.max(1, Math.round(totalSeconds / 60));
      return `${formatNumber(roundedMinutes)}-minute listen`;
    };

    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      spotifyPlayers.forEach((player) => {
        const engine = player.querySelector('[data-spotify-engine]');
        const toggle = player.querySelector('[data-spotify-toggle]');
        const progress = player.querySelector('[data-spotify-progress]');
        const current = player.querySelector('[data-spotify-current]');
        const duration = player.querySelector('[data-spotify-duration]');
        const listenLength = player.querySelector('[data-spotify-listen-length]');
        const status = player.querySelector('[data-spotify-status]');
        const skipButtons = Array.from(player.querySelectorAll('[data-spotify-skip]'));
        if (!engine || !toggle || !progress) return;

        IFrameAPI.createController(engine, {
          uri: player.dataset.spotifyUri,
          width: 1,
          height: 1,
        }, (controller) => {
          let durationMs = 0;
          let positionMs = 0;
          let isPlaying = false;
          let isScrubbing = false;
          let pendingSeek = null;
          let pendingPlayback = null;

          const renderPlaybackState = () => {
            toggle.setAttribute('aria-label', isPlaying ? 'Pause audio' : 'Play audio');
            player.classList.toggle('is-playing', isPlaying);
          };

          const finishPendingSeek = () => {
            pendingSeek = null;
            player.classList.remove('is-seeking');
            player.removeAttribute('aria-busy');
          };

          const renderTimeline = () => {
            if (durationMs <= 0) return;
            const boundedPosition = Math.max(0, Math.min(positionMs, durationMs));
            progress.disabled = false;
            skipButtons.forEach((button) => { button.disabled = false; });
            progress.max = String(durationMs);
            progress.value = String(boundedPosition);
            progress.style.setProperty('--audio-progress', `${(boundedPosition / durationMs) * 100}%`);
            progress.setAttribute('aria-valuetext', `${formatAudioTime(boundedPosition)} of ${formatAudioTime(durationMs)}`);
            current.textContent = formatAudioTime(boundedPosition);
            current.setAttribute('datetime', `PT${Math.floor(boundedPosition / 1000)}S`);
            duration.textContent = formatAudioTime(durationMs);
            if (listenLength) {
              listenLength.textContent = formatListenLength(durationMs);
              listenLength.hidden = false;
            }
          };

          const seekTo = (targetMs) => {
            if (durationMs <= 0) return;
            const wasPlaying = isPlaying;
            positionMs = Math.max(0, Math.min(targetMs, durationMs));
            pendingSeek = {
              targetMs: positionMs,
              expiresAt: Date.now() + 2500,
            };
            player.classList.add('is-seeking');
            player.setAttribute('aria-busy', 'true');
            renderTimeline();

            if (positionMs === 0 && typeof controller.restart === 'function') {
              controller.restart();
              if (!wasPlaying) {
                window.setTimeout(() => controller.pause(), 80);
              }
              return;
            }

            controller.seek(Math.round(positionMs / 1000));
          };

          controller.addListener('ready', () => {
            toggle.disabled = false;
            status.textContent = 'Audio ready.';
          });

          controller.addListener('playback_update', (event) => {
            const playback = event.data || {};
            durationMs = Number(playback.duration) || durationMs;
            const reportedPosition = Number(playback.position) || 0;
            if (!isScrubbing) {
              if (pendingSeek) {
                const hasReachedTarget = Math.abs(reportedPosition - pendingSeek.targetMs) <= 2000;
                const hasTimedOut = Date.now() >= pendingSeek.expiresAt;
                if (hasReachedTarget || hasTimedOut) {
                  positionMs = reportedPosition;
                  finishPendingSeek();
                }
              } else {
                positionMs = reportedPosition;
              }
            }
            const reportedIsPlaying = playback.isPaused === false;
            if (pendingPlayback) {
              const hasReachedRequestedState = reportedIsPlaying === pendingPlayback.targetIsPlaying;
              const hasTimedOut = Date.now() >= pendingPlayback.expiresAt;
              if (hasReachedRequestedState || hasTimedOut) {
                isPlaying = reportedIsPlaying;
                pendingPlayback = null;
                status.textContent = isPlaying ? 'Audio playing.' : 'Audio paused.';
              }
            } else {
              isPlaying = reportedIsPlaying;
            }

            renderPlaybackState();

            renderTimeline();
          });

          toggle.addEventListener('click', () => {
            isPlaying = !isPlaying;
            pendingPlayback = {
              targetIsPlaying: isPlaying,
              expiresAt: Date.now() + 2500,
            };
            status.textContent = isPlaying ? 'Starting audio.' : 'Pausing audio.';
            renderPlaybackState();
            controller.togglePlay();
          });

          progress.addEventListener('input', () => {
            isScrubbing = true;
            positionMs = Number(progress.value);
            renderTimeline();
          });

          progress.addEventListener('change', () => {
            const targetMs = Number(progress.value);
            isScrubbing = false;
            seekTo(targetMs);
          });

          skipButtons.forEach((button) => {
            button.addEventListener('click', () => {
              const offsetMs = Number(button.dataset.spotifySkip) * 1000;
              if (!Number.isFinite(offsetMs)) return;
              seekTo(positionMs + offsetMs);
            });
          });
        });
      });
    };

    const spotifyApi = document.querySelector('[data-spotify-iframe-api]');
    spotifyApi?.addEventListener('error', () => {
      spotifyPlayers.forEach((player) => {
        const status = player.querySelector('[data-spotify-status]');
        if (status) status.textContent = 'The audio player could not load. Please reload the page.';
      });
    }, { once: true });
  }

  const reporting = document.querySelector('[data-reporting-browser]');

  if (reporting) {
    let cards = Array.from(reporting.querySelectorAll('[data-clip-card]'));
    const buttons = Array.from(reporting.querySelectorAll('[data-filter-kind]'));
    const search = reporting.querySelector('[data-reporting-search]');
    const count = reporting.querySelector('[data-reporting-count]');
    const grid = reporting.querySelector('[data-clip-grid]');
    const cardTemplate = reporting.querySelector('[data-reporting-cards]');
    const empty = reporting.querySelector('[data-reporting-empty]');
    const loadMore = reporting.querySelector('[data-load-more]');
    const clear = reporting.querySelector('[data-clear-filters]');
    const advancedFilters = Array.from(reporting.querySelectorAll('[data-advanced-filters]'));
    const params = new URLSearchParams(window.location.search);
    const searchIndex = new Map();
    const originalOrder = new Map();
    const sourceLabels = new Map(
      buttons
        .filter((button) => button.dataset.filterKind === 'source')
        .map((button) => [button.dataset.filterValue, button.textContent.trim()])
    );
    const sourceLabelFallbacks = new Map([
      ['npr', 'NPR'],
      ['stanford-journalism', 'Stanford Journalism'],
      ['cnn', 'CNN'],
      ['medpage-today', 'MedPage Today'],
      ['abc-news', 'ABC News']
    ]);
    const topicLabels = new Map(
      buttons
        .filter((button) => button.dataset.filterKind === 'topic')
        .map((button) => [button.dataset.filterValue, button.textContent.trim()])
    );
    let searchIndexPromise;
    let allCardsLoaded = !cardTemplate;

    const state = {
      collection: params.get('view') || (params.toString() ? 'all' : 'featured'),
      source: params.get('outlet') || 'all',
      topic: params.get('topic') || 'all',
      query: params.get('q') || '',
      extra: 0
    };

    const normalize = (value) => (value || '').toLowerCase().trim();

    function registerCards() {
      cards = Array.from(reporting.querySelectorAll('[data-clip-card]'));
      cards.forEach((card, index) => {
        originalOrder.set(card, Number(card.dataset.order || index));
      });
    }

    function loadAllCards() {
      if (allCardsLoaded || !cardTemplate) return;
      grid.appendChild(cardTemplate.content.cloneNode(true));
      allCardsLoaded = true;
      registerCards();
    }

    function hydrateCardImage(card) {
      const image = card.querySelector('img[data-src]');
      if (!image) return;
      image.src = image.dataset.src;
      image.removeAttribute('data-src');
    }

    registerCards();

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
      let topicDescriptor = '';
      if (state.collection === 'featured') {
        descriptors.push('featured');
      } else {
        if (state.source !== 'all') descriptors.push(sourceLabels.get(state.source) || sourceLabelFallbacks.get(state.source) || state.source);
        if (state.topic !== 'all') topicDescriptor = (topicLabels.get(state.topic) || state.topic).toLowerCase();
      }

      const noun = total === 1 ? 'story' : 'stories';
      let describedStories;
      if (topicDescriptor.endsWith(' stories')) {
        const topicPhrase = total === 1 && topicDescriptor === 'profiles and human stories'
          ? 'profile or human story'
          : topicDescriptor;
        describedStories = [...descriptors, topicPhrase].join(' ');
      } else {
        if (topicDescriptor) descriptors.push(topicDescriptor);
        describedStories = `${descriptors.length ? `${descriptors.join(' ')} ` : ''}${noun}`;
      }
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
      if (state.collection === 'all' || query) loadAllCards();
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
      matches.slice(0, limit).forEach((card) => {
        card.hidden = false;
        hydrateCardImage(card);
      });

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
    const recaptchaSiteKey = '6LdU-iorAAAAANTATiiq-Iv3yMk8T5AgUun7cXlt';
    const iframe = document.getElementById('hidden_iframe');
    const tokenField = document.getElementById('recaptchaResponse');
    const status = document.querySelector('[data-form-status]');
    const success = document.querySelector('[data-newsletter-success]');
    const reset = document.querySelector('[data-newsletter-reset]');
    let submitted = false;
    let recaptchaPromise;

    function loadRecaptcha() {
      if (window.grecaptcha) return Promise.resolve(window.grecaptcha);
      if (recaptchaPromise) return recaptchaPromise;

      recaptchaPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
        script.async = true;
        script.defer = true;
        script.addEventListener('load', () => resolve(window.grecaptcha), { once: true });
        script.addEventListener('error', reject, { once: true });
        document.head.appendChild(script);
      });
      return recaptchaPromise;
    }

    newsletterForm.addEventListener('focusin', () => {
      loadRecaptcha().catch(() => {});
    }, { once: true });

    newsletterForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!newsletterForm.reportValidity()) return;
      status.textContent = 'Submitting…';

      const submitForm = (token = '') => {
        tokenField.value = token;
        submitted = true;
        newsletterForm.submit();
      };

      loadRecaptcha()
        .then((grecaptcha) => {
          grecaptcha.ready(() => {
            grecaptcha.execute(recaptchaSiteKey, { action: 'newsletter' })
              .then(submitForm)
              .catch(() => {
                status.textContent = 'Please try again.';
              });
          });
        })
        .catch(() => {
          status.textContent = 'Please try again.';
        });
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
