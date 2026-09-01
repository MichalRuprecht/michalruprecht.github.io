# Publishing a new clip

The clip generator remains the simplest safe workflow while this website is hosted only on GitHub Pages.

1. Open `https://michalruprecht.com/pages/md_file.html`.
2. Fill in the story information. Enter one or more topics, separated by commas. Check **Audio**, **Podcast**, **Video**, or **Photo story** for any multimedia elements. These format choices do not replace the subject topic: a Global health story can also be Audio, for example. Check **Feature on homepage** only for a story that should appear in the default featured view.
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

## Making one story box larger

Open `_data/portfolio.yml` and replace the clip number under `large_ids` with the story you want to emphasize. For example:

```yaml
large_ids:
  - "116"
```

The site enlarges at most one story in the current results. When that larger card is visible, the first view shows five stories; when all cards are the same size, it shows six.

## Adding topics to a Markdown file

The homepage creates its Topic buttons directly from the clip files. To give a story more than one topic, use a list in that story's Markdown header:

```yaml
categories:
  - Global health
  - Inequity & structural discrimination
audio: true
```

This example appears under Global health, Inequity & structural discrimination, and Multimedia. You do not need to add the story number or topic to `_data/portfolio.yml`.

Older files that use a single line such as `category: Global health` will continue to work.

Audio, video, podcast, and photo-story clips are placed in the Multimedia filter automatically. Their cards use the single label **Multimedia** so that labels such as “Video” are not repeated when they already appear in a headline.

## About a login-based editor

GitHub Pages is a static host, so it cannot safely validate a password or keep a GitHub access token secret. Do not add a password or personal access token to HTML or JavaScript in this public repository.

A true browser-based editor is possible as a later project by adding a CMS and a small authentication service. That would add another service to maintain, so the current generator-and-upload workflow is the safer low-maintenance option for occasional publishing.
