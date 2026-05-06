# UI Hotfix Completion Plan

**Objective:** Complete the UI hotfix for Quick Scout and Popup UI (`frolicking-herding-marshmallow.md`) that was left uncommitted in the working tree from the previous session.

## Implementation Steps

1. **Smoke Test:** Run `pnpm build && pnpm dev` to build the extension.
2. **Visual Verification:** Request the user to load the unpacked extension from `.output/chrome-mv3` into Chrome, test the Quick Scout button on Amazon and non-Amazon pages, and confirm they are happy with the visual changes and error handling.
3. **Commit Changes:** Once visuals are approved, commit the working tree changes with the message: `feat(popup): wire shadcn/ui + tailwind v4, fix silent Quick Scout handler`.
4. **Update Handoff:** Append the new commit hash to the Obsidian handoff document.
5. **Hold Push:** Do NOT push to origin without explicit user approval.
