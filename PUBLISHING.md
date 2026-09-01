# Publishing a new clip

The clip generator remains the simplest safe workflow while this website is hosted only on GitHub Pages.

1. Open `https://michalruprecht.com/pages/md_file.html`.
2. Fill in the story information. Choose one of the suggested categories if it applies. Check **Feature on homepage** only for a story that should appear in the default featured view.
3. Download the generated Markdown file.
4. Use the three GitHub upload links shown by the generator:
   - Markdown → `pages/clips/`
   - Main image → `pages/clips/assets/photo/`
   - PDF, when available → `pages/clips/assets/pdf/`
5. Keep the same number for the Markdown, image, and PDF filenames. The generator calculates the next number.
6. Commit the uploads. GitHub Pages will rebuild the site automatically.

The homepage reads clip metadata directly from `pages/clips/*.md`. There is no second clips list to update.

## Changing the Featured section

For an existing story, open `_data/portfolio.yml` and add or remove its clip number under `featured_ids`. The clip number is the number in its filename or URL—for example, `116` for `pages/clips/116.md`. Featured stories appear newest first.

For a new story, the generator's **Feature on homepage** checkbox adds it to Featured automatically. Leave the box unchecked when a story should appear only under All reporting.

## Categories used by the homepage

- `global health`
- `domestic health`
- `profiles & human stories`
- `inequity & structural discrimination`

Video, podcast, and photo-story clips are placed in the Multimedia filter automatically.

## About a login-based editor

GitHub Pages is a static host, so it cannot safely validate a password or keep a GitHub access token secret. Do not add a password or personal access token to HTML or JavaScript in this public repository.

A true browser-based editor is possible as a later project by adding a CMS and a small authentication service. That would add another service to maintain, so the current generator-and-upload workflow is the safer low-maintenance option for occasional publishing.
