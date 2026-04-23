/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Forjinn-Desk 基础组件库统一导出 / Forjinn-Desk base components unified exports
 *
 * 提供所有基础组件和类型的统一导出入口
 * Provides unified export entry for all base components and types
 */

// ==================== 组件导出 / Component Exports ====================

export { default as ForjinnModal } from './ForjinnModal';
export { default as ForjinnCollapse } from './ForjinnCollapse';
export { default as ForjinnSelect } from './ForjinnSelect';
export { default as ForjinnScrollArea } from './ForjinnScrollArea';
export { default as ForjinnSteps } from './ForjinnSteps';

// ==================== 类型导出 / Type Exports ====================

// ForjinnModal 类型 / ForjinnModal types
export type {
  ModalSize,
  ModalHeaderConfig,
  ModalFooterConfig,
  ModalContentStyleConfig,
  ForjinnModalProps,
} from './ForjinnModal';
export { MODAL_SIZES } from './ForjinnModal';

// ForjinnCollapse 类型 / ForjinnCollapse types
export type { ForjinnCollapseProps, ForjinnCollapseItemProps } from './ForjinnCollapse';

// ForjinnSelect 类型 / ForjinnSelect types
export type { ForjinnSelectProps } from './ForjinnSelect';

// ForjinnSteps 类型 / ForjinnSteps types
export type { ForjinnStepsProps } from './ForjinnSteps';
