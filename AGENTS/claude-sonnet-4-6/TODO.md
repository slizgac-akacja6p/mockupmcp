# TODO — MockupMCP

## Immediate

- [x] Phase C: M23 Approval Redesign (PR #30 merged to develop)
- [x] Merge PR #22 (`develop` → `main`) — covers M16 through M24
- [x] Merge PR #23 (`feature/m18-design-styles` → `develop`) — M18 styles
- [x] Update project `CLAUDE.md` stats (M18-M24 complete)

- [ ] Docker rebuild + push (in progress)
      ```
      docker build -t mockupmcp:latest .
      docker stop mockupmcp && docker rm mockupmcp
      docker run -d --name mockupmcp -v /Users/maciejgajda/mockups:/data \
        -p 3100:3100 -p 3200:3200 -e MCP_TRANSPORT=http mockupmcp:latest
      docker push mggs/mockupmcp:latest
      ```

- [ ] Plan next phase — post-roadmap (user feedback, new features?)

## Backlog

- [ ] `DEFAULT_STYLE` env var documentation — update to list all 19 valid values
- [ ] Tag git releases: v0.5.0 (M18), v0.6.0 (M19-M24)
- [ ] Docker Hub push: `docker push mggs/mockupmcp:latest` after rebuild
- [ ] E2E test run after Docker rebuild to verify M19-M24 integration
- [ ] Verify slate style dark/light in live preview (manual QA)
- [ ] Add `color_scheme` field to `mockup_add_screen` / `mockup_generate_screen` tool docs
