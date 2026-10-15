# GitHub Pages deployment

The game is a static site: Three.js, models, images, music and voices are bundled. No server or API keys are needed in production. Relative asset and module URLs support the `/after-hours/` project path.

The `Test and deploy After Hours` workflow runs on pushes to `main` and can also be started from GitHub's Actions tab. It uses Node.js 24 to run the unit tests and complete gameplay simulation, builds `_site`, then publishes that artifact to the `github-pages` environment. A failed test prevents publication.

`npm run build` copies only `index.html`, `style.css`, `src`, `vendor`, and `assets` into `_site`. Developer tools, local dependencies, tests and the local server stay out of the public site. Asset credits and licenses remain bundled.

Repository: https://github.com/thecooldude2486-cell/after-hours

Site: https://thecooldude2486-cell.github.io/after-hours/

For a new repository, enable **Settings → Pages → Source → GitHub Actions** once, then push to `main`. The workflow uses GitHub's built-in deployment token and requires no personal token or repository secrets.

Local preview: `npm start`, then open http://127.0.0.1:4173/. Play using a desktop browser with keyboard, mouse and WebGL support.

Workflow reference: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
