/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn.com)
 * SPDX-License-Identifier: Apache-2.0
 */

// Re-export from canonical location in common/types
export type {
  DetectedAgentKind,
  DetectedAgent,
  AcpDetectedAgent,
  GeminiDetectedAgent,
  RemoteDetectedAgent,
  ForjinnrsDetectedAgent,
  NanobotDetectedAgent,
  OpenClawDetectedAgent,
  RemoteAgentProtocol,
  RemoteAgentAuthType,
} from '@/common/types/detectedAgent';

export { isAgentKind } from '@/common/types/detectedAgent';
