/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import OfflineMcpPanel from '@renderer/components/settings/SettingsModal/contents/OfflineMcpPanel';

const McpSettings: React.FC = () => {
  return (
    <SettingsPageWrapper>
      <OfflineMcpPanel />
    </SettingsPageWrapper>
  );
};

export default McpSettings;
