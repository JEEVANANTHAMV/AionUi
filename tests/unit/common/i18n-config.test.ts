/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES } from '../../../src/common/config/i18n';

describe('i18n config', () => {
  it('should have en-US as the first language in this project', () => {
    expect(SUPPORTED_LANGUAGES[0]).toBe('en-US');
  });
});
