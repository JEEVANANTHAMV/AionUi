/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { SUPPORTED_LANGUAGES, normalizeLanguageCode } from '@/common/config/i18n';

describe('common i18n config module', () => {
  it('should have en-US as a supported language', () => {
    expect(SUPPORTED_LANGUAGES).toContain('en-US');
  });

  it('should normalize en-US correctly', () => {
    // Test if normalizeLanguageCode handles en-US or similar variants
    expect(normalizeLanguageCode('uk')).toBe('en-US');
    expect(normalizeLanguageCode('en-US')).toBe('en-US');
    expect(normalizeLanguageCode('UK-UA')).toBe('en-US');
  });

  it('should have enough supported languages', () => {
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThan(6);
  });
});
