# TODO — MockupMCP

## Immediate

- [ ] Phase C: M23 Approval Redesign
      Depends on M21 (versioning) + M22 (comments) — both DONE.
      Branch: `feature/m23-approval`
      Details: `PM/tasks/M19.md` (or `PM/tasks/M23.md` if separate file exists)

- [ ] Merge PR #22 (`develop` → `main`) — covers M16 through M24

- [ ] Merge PR #23 (`feature/m18-design-styles` → `develop`) — M18 styles

- [ ] Docker rebuild after latest commits (image is stale vs develop HEAD)
      ```
      docker build -t mockupmcp:latest .
      docker stop mockupmcp && docker rm mockupmcp
      docker run -d --name mockupmcp -v /Users/maciejgajda/mockups:/data \
        -p 3100:3100 -p 3200:3200 -e MCP_TRANSPORT=http mockupmcp:latest
      ```

- [ ] Update project `CLAUDE.md` stats:
      - MCP tools: 25 → 34
      - MCP resources: 5 → 6
      - MCP prompts: 3 → 4
      - Styles: 6 → 19
      - Tests: 919 → ~1564

## Backlog

- [ ] `DEFAULT_STYLE` env var documentation — update to list all 19 valid values
- [ ] Tag git releases: v0.5.0 (M18), v0.6.0 (M19-M24)
- [ ] Docker Hub push: `docker push mggs/mockupmcp:latest` after rebuild
- [ ] E2E test run after Docker rebuild to verify M19-M24 integration
- [ ] Verify slate style dark/light in live preview (manual QA)
- [ ] Add `color_scheme` field to `mockup_add_screen` / `mockup_generate_screen` tool docs
