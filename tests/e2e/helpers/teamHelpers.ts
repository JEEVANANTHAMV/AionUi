import type { Page } from '@playwright/test';
import { invokeBridge } from './bridge';
import { TEAM_SUPPORTED_BACKENDS } from './teamConfig';

type TeamAgent = {
  slot_id: string;
  conversation_id: string;
  role: string;
  agent_type: string;
  agent_name: string;
  conversation_type: string;
  status: string;
};

type TeamRecord = { id: string; name: string; agents: TeamAgent[] };

function resolveConversationType(backend: string): string {
  if (backend === 'claude' || backend === 'codex') return 'acp';
  if (backend === 'gemini') return 'gemini';
  return backend;
}

/**
 * Create a new team via IPC bridge. Returns the created teamId.
 * Throws if no supported backend is available — callers should skip the test in that case.
 *
 * @param page      Playwright page
 * @param name      Team name
 * @param backend   Leader backend type (defaults to first TEAM_SUPPORTED_BACKENDS entry)
 */
export async function createTeam(page: Page, name: string, backend?: string): Promise<string> {
  if (TEAM_SUPPORTED_BACKENDS.size === 0) {
    throw new Error('No supported team backends available — skip this test');
  }

  const agentType = backend ?? [...TEAM_SUPPORTED_BACKENDS][0];
  const conversationType = resolveConversationType(agentType);

  const result = await invokeBridge<TeamRecord>(page, 'team.create', {
    user_id: 'system_default_user',
    name,
    workspace: '',
    workspace_mode: 'shared',
    agents: [
      {
        slot_id: 'slot-lead',
        conversation_id: '',
        role: 'leader',
        agent_type: agentType,
        agent_name: 'Leader',
        conversation_type: conversationType,
        status: 'pending',
      },
    ],
  });

  return result.id;
}

/**
 * Find-or-create a team by name. Returns teamId.
 * Uses `createTeam` if not found.
 */
export async function ensureTeam(page: Page, name: string, backend?: string): Promise<string> {
  const teams = await invokeBridge<TeamRecord[]>(page, 'team.list', {
    user_id: 'system_default_user',
  });

  const existing = teams.find((t) => t.name === name);
  if (existing) return existing.id;

  return createTeam(page, name, backend);
}

/**
 * Delete a team by id. No-op if team doesn't exist.
 */
export async function deleteTeam(page: Page, id: string): Promise<void> {
  await invokeBridge(page, 'team.remove', { id }).catch(() => {});
}

/**
 * Remove all teams whose name matches `name`. Useful for pre-test cleanup.
 */
export async function cleanupTeamsByName(page: Page, name: string): Promise<void> {
  const teams = await invokeBridge<TeamRecord[]>(page, 'team.list', {
    user_id: 'system_default_user',
  }).catch(() => [] as TeamRecord[]);

  for (const t of teams.filter((t) => t.name === name)) {
    await invokeBridge(page, 'team.remove', { id: t.id }).catch(() => {});
  }
}
