/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import coworkSvg from '@/renderer/assets/icons/cowork.svg';
import beautifulMermaidPng from '@/renderer/assets/logos/assistants/beautiful-mermaid.png';
import wordCreatorPng from '@/renderer/assets/logos/assistants/word-creator.png';
import pptCreatorPng from '@/renderer/assets/logos/assistants/ppt-creator.png';
import game3dPng from '@/renderer/assets/logos/assistants/game-3d.png';
import forjinnColorfulPng from '@/renderer/assets/logos/assistants/forjinn-colorful.png';

/**
 * Map custom avatar identifiers to their resolved image URLs.
 */
export const CUSTOM_AVATAR_IMAGE_MAP: Record<string, string> = {
  'cowork.svg': coworkSvg,
  '\u{1F6E0}\u{FE0F}': coworkSvg,
  forjinnrs: forjinnColorfulPng,
  'beautiful-mermaid': beautifulMermaidPng,
  'word-creator': wordCreatorPng,
  'ppt-creator': pptCreatorPng,
  'game-3d': game3dPng,
};
