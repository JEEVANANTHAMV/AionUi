/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import AttachedAgentsPanel from '@renderer/components/settings/SettingsModal/contents/AttachedAgentsPanel';

const AttachedAgentsSettings: React.FC = () => {
  return (
    <SettingsPageWrapper>
      <AttachedAgentsPanel />
    </SettingsPageWrapper>
  );
};

export default AttachedAgentsSettings;
