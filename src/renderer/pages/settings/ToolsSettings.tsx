/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import ToolsPanel from '@renderer/components/settings/SettingsModal/contents/ToolsPanel';

const ToolsSettings: React.FC = () => {
  return (
    <SettingsPageWrapper>
      <ToolsPanel />
    </SettingsPageWrapper>
  );
};

export default ToolsSettings;
