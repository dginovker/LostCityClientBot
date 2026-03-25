# LostCityClientBot Rules

## Testing is mandatory

Never ship a script without testing it in the actual game client via Chrome MCP. If Chrome MCP is disconnected, fix the connection first. Do not commit untested code. Every script must be verified working E2E before being pushed.

## Build process

- Build with: `bun bundle.ts dev`
- Run server with: `node serve.cjs`
- Test at: `http://localhost:8080`
- The `out/` directory is gitignored; use `git add -f` for `out/client.js` and `out/index.html`
- GitHub Pages serves from the `gh-pages` branch (root level `client.js` and `index.html`)
