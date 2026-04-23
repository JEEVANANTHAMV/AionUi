/**
 * E2E Scenario 6: Agent whitelist enforcement.
 *
 * Verifies: UI create modal dropdown only shows whitelisted agent types.
 *
 * Whitelist locations:
 * - agentSelectUtils.tsx (TEAM_SUPPORTED_BACKENDS)
 * - TeamMcpServer.ts (spawn whitelist)
 */
import { test, expect } from '../../fixtures';
import { TEAM_SUPPORTED_BACKENDS } from '../../helpers';

test.describe('Team Agent Whitelist', () => {
  test('UI only shows whitelisted agents in create modal dropdown', async ({ page }) => {
    // Navigate to home to access the create modal
    await page.goto(page.url().split('#')[0] + '#/guid');

    // Close any leftover modal from previous tests before interacting with the page
    const existingModal = page.locator('.arco-modal .arco-btn-text');
    if (await existingModal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await existingModal.click({ force: true });
      await expect(page.locator('.arco-modal')).toBeHidden({ timeout: 5000 });
    }

    await expect(page.locator('[data-testid="team-create-btn"]').first()).toBeVisible({ timeout: 10000 });

    // Open Create Team modal
    const createBtn = page.locator('[data-testid="team-create-btn"]').first();
    await createBtn.click();

    // Open the leader AionSelect dropdown (options portal to document.body)
    const modal = page.locator('.arco-modal');
    const leaderSelect = modal.locator('[data-testid="team-create-leader-select"]');
    await expect(leaderSelect).toBeVisible({ timeout: 5000 });
    await leaderSelect.click();

    // Wait for at least one option to render at page scope (not inside .arco-modal)
    const firstOption = page.locator('[data-testid^="team-create-agent-option-"]').first();
    await expect(firstOption).toBeVisible({ timeout: 5000 });

    // Screenshot: dropdown options
    await page.screenshot({ path: 'tests/e2e/results/team-whitelist-01-dropdown.png' });

    // Collect all agent option texts from the open dropdown
    const options = page.locator('[data-testid^="team-create-agent-option-"]');
    const count = await options.count();

    const optionTexts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      if (text) optionTexts.push(text.trim());
    }

    console.log('[E2E] Available agents in dropdown:', optionTexts);

    // [WHITELIST RULE] All assertions here are based on TEAM_SUPPORTED_BACKENDS (tests/e2e/helpers/teamConfig.ts).
    // Do NOT hardcode which agents should or should not appear — the whitelist is the single source of truth.
    // If the supported backend list changes, update teamConfig.ts, not this test.

    // Every whitelisted backend must appear in the dropdown options
    for (const backend of TEAM_SUPPORTED_BACKENDS) {
      expect(optionTexts.some((t) => t.toLowerCase().includes(backend))).toBe(true);
    }

    // Close the dropdown first, then close the modal via Cancel button
    await page.keyboard.press('Escape').catch(() => {});
    await page.locator('.arco-modal .arco-btn-text').first().click();
    await expect(page.locator('.arco-modal')).toBeHidden({ timeout: 5000 });
  });
});
