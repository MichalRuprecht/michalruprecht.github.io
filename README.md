# michalruprecht.com

This repository builds Michal Ruprecht’s journalism and ceramics portfolio with Jekyll and GitHub Pages.

## The few files that control most of the site

- `index.html` — homepage biography, contact information, newsletter form, and the data-driven reporting grid
- `_data/portfolio.yml` — featured clip numbers, topic groups, outlet filters, and fellowship/support names
- `assets/css/portfolio.css` — the homepage, navigation, footer, clip cards, and ceramics design
- `assets/js/portfolio.js` — mobile navigation, clip filtering/search, and the newsletter form
- `_layouts/portfolio.html` — shared shell for the homepage and ceramics portfolio
- `_layouts/clip.html` — individual article/clip pages
- `_includes/site-header.html` and `_includes/site-footer.html` — navigation and footer used across the site
- `pages/ceramics.html` — ceramics portfolio content
- `pages/md_file.html` — clip-file generator
- `pages/email_generator.html` — source-email generator
- `pages/newsletter_extract.html` — newsletter tool redirect; leave unchanged unless the external tool’s address changes

Every published clip remains in `pages/clips/`. The story text in those files is publication copy and should not be rewritten. See `PUBLISHING.md` for the publishing checklist.

The former `/pages/clips` index now redirects to the reporting section of the homepage, so there is only one portfolio grid to maintain.
