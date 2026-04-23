/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getPlatformServices } from '@/common/platform';

/**
 * Returns baseName unchanged in release builds, or baseName + '-dev' in dev builds.
 * When FORJINN_DESK_MULTI_INSTANCE=1, appends '-2' to isolate the second dev instance.
 * Used to isolate symlink and directory names between environments.
 *
 * @example
 * getEnvAwareName('.forjinn-desk')        // release → '.forjinn-desk',        dev → '.forjinn-desk-dev'
 * getEnvAwareName('.forjinn-desk-config') // release → '.forjinn-desk-config', dev → '.forjinn-desk-config-dev'
 * // with FORJINN_DESK_MULTI_INSTANCE=1:  dev → '.forjinn-desk-dev-2'
 */
export function getEnvAwareName(baseName: string): string {
  if (getPlatformServices().paths.isPackaged() === true) return baseName;
  const suffix = process.env.FORJINN_DESK_MULTI_INSTANCE === '1' ? '-dev-2' : '-dev';
  return `${baseName}${suffix}`;
}
