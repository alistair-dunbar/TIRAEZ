# Template preview media

**Status (16 Nov 2026): no sample, preview or demo media is approved. None is shown anywhere.**

The site is built so approved media can be added without changing the catalogue or the pages.

## Adding an approved preview

1. Put the files in `media/previews/`: `<name>.jpg` (the poster, required) and optionally `<name>.mp4`.
2. In the template's file in `catalog/templates/`, set:

   ```json
   "preview": { "asset": "<name>", "approved": true }
   ```

3. Restart the server.

Both are needed: a file without `"approved": true`, or `"approved": true` without a file, shows nothing,
and the server refuses to serve any file under `/media/previews/` that isn't approved.

## Where it appears

- Catalogue entries and the landing page's template list: the poster above the template name
  (`previewMedia()` in `app/public/js/views/parts.js`), lazy-loaded.
- The template page: the same component under the description.

Video previews are not autoplayed; the poster is shown until someone chooses to play.

## What doesn't count as preview media

Customers' own photos and their own generated videos are always shown to them; they are not
samples and need no approval.
