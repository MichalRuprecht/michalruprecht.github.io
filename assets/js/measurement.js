(() => {
  const sendEvent = (name, parameters = {}) => {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, parameters);
  };

  const reporting = document.querySelector('[data-reporting-browser]');

  if (reporting) {
    let searchTimer;

    reporting.addEventListener('click', (event) => {
      const filter = event.target.closest('[data-filter-kind]');
      if (filter) {
        window.setTimeout(() => {
          sendEvent('reporting_filter', {
            filter_type: filter.dataset.filterKind,
            filter_value: filter.dataset.filterValue,
            visible_results: reporting.querySelectorAll('[data-clip-card]:not([hidden])').length
          });
        }, 0);
        return;
      }

      const storyLink = event.target.closest('[data-clip-card] a');
      if (storyLink) {
        const card = storyLink.closest('[data-clip-card]');
        sendEvent('select_content', {
          content_type: 'reporting',
          item_id: card?.dataset.clipId || '',
          item_name: card?.dataset.title || ''
        });
        return;
      }

      if (event.target.closest('[data-load-more]')) {
        window.setTimeout(() => {
          sendEvent('reporting_load_more', {
            visible_results: reporting.querySelectorAll('[data-clip-card]:not([hidden])').length
          });
        }, 0);
      }
    });

    const search = reporting.querySelector('[data-reporting-search]');
    search?.addEventListener('input', () => {
      window.clearTimeout(searchTimer);
      const searchTerm = search.value.trim();
      if (!searchTerm) return;

      searchTimer = window.setTimeout(() => {
        sendEvent('view_search_results', {
          search_term: searchTerm,
          visible_results: reporting.querySelectorAll('[data-clip-card]:not([hidden])').length
        });
      }, 800);
    });
  }

  const newsletterSuccess = document.querySelector('[data-newsletter-success]');
  if (newsletterSuccess) {
    let recorded = false;
    const recordSignup = () => {
      if (recorded || newsletterSuccess.hidden) return;
      recorded = true;
      sendEvent('sign_up', { method: 'newsletter' });
    };

    new MutationObserver(recordSignup).observe(newsletterSuccess, {
      attributes: true,
      attributeFilter: ['hidden']
    });
    recordSignup();
  }
})();
