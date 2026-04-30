/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Dropdown, Menu, Message, Tooltip } from '@arco-design/web-react';
import { FolderOpen, UploadOne } from '@icon-park/react';
import { useConversationContextSafe } from '@/renderer/hooks/context/ConversationContext';
import { isElectronDesktop } from '@/renderer/utils/platform';
import { FileService } from '@/renderer/services/FileService';
import type { FileMetadata } from '@/renderer/services/FileService';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface FileAttachButtonProps {
  /** Open server/host file browser (existing ipcBridge.dialog.showOpen behavior) */
  openFileSelector: () => void;
  /** Callback when local device files are selected via browser file picker */
  onLocalFilesAdded?: (files: FileMetadata[]) => void;
}

/**
 * Unified file-attach button for SendBox.
 *
 * - **Electron desktop**: Simple "+" button → opens native OS file dialog (same as before).
 * - **WebUI (desktop/mobile browser)**: "+" button with dropdown → choose between
 *   host machine files (server-side directory browser) or local device files (browser file picker).
 */
const FileAttachButton: React.FC<FileAttachButtonProps> = ({ openFileSelector, onLocalFilesAdded }) => {
  const conversationContext = useConversationContextSafe();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleLocalFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0 || !onLocalFilesAdded) return;
      setUploading(true);
      try {
        const processed = await FileService.processDroppedFiles(fileList, conversationContext?.conversationId);
        if (processed.length > 0) {
          onLocalFilesAdded(processed);
        }
      } catch (err) {
        Message.error(t('common.fileAttach.failed'));
      } finally {
        setUploading(false);
      }
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [conversationContext?.conversationId, onLocalFilesAdded, t]
  );

  const folderIcon = <FolderOpen theme='outline' size='20' strokeWidth={1.75} />;
  const uploadIcon = <UploadOne theme='outline' size='16' strokeWidth={1.75} />;

  // Electron desktop: simple button with tooltip, no dropdown needed
  if (isElectronDesktop()) {
    return (
      <Tooltip content={t('common.fileAttach.browseFiles', { defaultValue: 'Browse files' })} position='top' mini>
        <Button
          type='secondary'
          shape='circle'
          icon={folderIcon}
          onClick={openFileSelector}
          className='file-attach-btn'
        />
      </Tooltip>
    );
  }

  // WebUI: dropdown with two options
  const dropdownMenu = (
    <Menu
      onClickMenuItem={(key) => {
        if (key === 'host') openFileSelector();
        if (key === 'device') fileInputRef.current?.click();
      }}
    >
      <Menu.Item key='host'>
        <span className='flex items-center gap-8px'>
          <FolderOpen theme='outline' size='16' strokeWidth={1.75} />
          {t('common.fileAttach.hostFiles')}
        </span>
      </Menu.Item>
      <Menu.Item key='device'>
        <span className='flex items-center gap-8px'>
          <UploadOne theme='outline' size='16' strokeWidth={1.75} />
          {t('common.fileAttach.myDevice')}
        </span>
      </Menu.Item>
    </Menu>
  );

  return (
    <>
      <Dropdown droplist={dropdownMenu} trigger='click' position='top'>
        <Tooltip
          content={t('common.fileAttach.chooseSource', { defaultValue: 'Choose file source' })}
          position='top'
          mini
        >
          <Button
            type='secondary'
            shape='circle'
            icon={folderIcon}
            loading={uploading}
            disabled={uploading}
            className='file-attach-btn'
          />
        </Tooltip>
      </Dropdown>
      <input ref={fileInputRef} type='file' multiple style={{ display: 'none' }} onChange={handleLocalFileChange} />
    </>
  );
};

export default FileAttachButton;
