/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageAcpPermission } from '@/common/chat/chatLib';
import { conversation, acpConversation } from '@/common/adapter/ipcBridge';
import { Button, Card, Radio, Typography, Switch, Tooltip } from '@arco-design/web-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface MessageAcpPermissionProps {
  message: IMessageAcpPermission;
}

const MessageAcpPermission: React.FC<MessageAcpPermissionProps> = React.memo(({ message }) => {
  const { options = [], toolCall } = message.content || {};
  const { t } = useTranslation();

  // 基于实际数据生成显示信息
  const getToolInfo = () => {
    if (!toolCall) {
      return {
        title: t('messages.permissionRequest'),
        description: t('messages.agentRequestingPermission'),
        icon: '🔐',
      };
    }

    // 直接使用 toolCall 中的实际数据
    const displayTitle = toolCall.title || toolCall.rawInput?.description || t('messages.permissionRequest');

    // 简单的图标映射
    const kindIcons: Record<string, string> = {
      edit: '✏️',
      read: '📖',
      fetch: '🌐',
      execute: '⚡',
    };

    return {
      title: displayTitle,
      icon: kindIcons[toolCall.kind || 'execute'] || '⚡',
    };
  };
  const { title, icon } = getToolInfo();
  const [selected, setSelected] = useState<string | null>(null);
  const [isResponding, setIsResponding] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);
  const [yoloMode, setYoloMode] = useState(false);

  const handleToggleYolo = async (checked: boolean) => {
    setYoloMode(checked);
    if (checked) {
      try {
        await acpConversation.setMode.invoke({
          conversationId: message.conversation_id,
          mode: 'yolo',
        });

        // Auto-confirm with selected or first available option
        const optionToConfirm = selected || (options && options.length > 0 ? options[0]?.optionId || 'option_0' : null);
        if (optionToConfirm) {
          setSelected(optionToConfirm);
          setTimeout(async () => {
            setIsResponding(true);
            try {
              const invokeData = {
                confirmKey: optionToConfirm,
                msg_id: message.id,
                conversation_id: message.conversation_id,
                callId: toolCall?.toolCallId || message.id,
              };
              const result = await conversation.confirmMessage.invoke(invokeData);
              if (result.success) {
                setHasResponded(true);
              }
            } catch (err) {
              console.error('YOLO auto-confirm failed:', err);
            } finally {
              setIsResponding(false);
            }
          }, 100);
        }
      } catch (error) {
        console.error('Failed to enable YOLO mode:', error);
      }
    } else {
      try {
        await acpConversation.setMode.invoke({
          conversationId: message.conversation_id,
          mode: 'default',
        });
      } catch (error) {
        console.error('Failed to disable YOLO mode:', error);
      }
    }
  };

  const handleConfirm = async () => {
    if (hasResponded || !selected) return;

    setIsResponding(true);
    try {
      const invokeData = {
        confirmKey: selected,
        msg_id: message.id,
        conversation_id: message.conversation_id,
        callId: toolCall?.toolCallId || message.id, // 使用 toolCallId 或 message.id 作为 fallback
      };

      const result = await conversation.confirmMessage.invoke(invokeData);

      if (result.success) {
        setHasResponded(true);
      } else {
        // Handle failure case - could add error display here
        console.error('Failed to confirm permission:', result);
      }
    } catch (error) {
      // Handle error case - could add error logging here
      console.error('Error confirming permission:', error);
    } finally {
      setIsResponding(false);
    }
  };

  if (!toolCall) {
    return null;
  }

  return (
    <Card
      className={`mb-4 transition-all duration-300 ${yoloMode ? 'border border-yellow-500 shadow-md' : ''}`}
      bordered={false}
      style={{ background: 'var(--bg-1)' }}
    >
      <div className='space-y-4'>
        {/* Header with icon, title, and YOLO mode toggle */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-2'>
            <span className='text-2xl'>{icon}</span>
            <Text className='block font-medium'>{title}</Text>
          </div>
          <div className='flex items-center space-x-2 bg-2 p-1 px-2 rounded-full'>
            <Tooltip
              content={
                <div className='p-2 max-w-240px space-y-2 text-xs'>
                  <div className='font-bold text-sm text-yellow-500'>⚠️ YOLO Mode (Full Auto)</div>
                  <div>
                    Turning this on allows the agent to execute all future tool calls automatically without asking for
                    permission.
                  </div>
                  <div className='text-red-400 font-bold'>Precaution:</div>
                  <div className='text-t-secondary'>
                    The agent could run commands, delete files, or consume API credits without your review. Use only on
                    trusted codebases.
                  </div>
                </div>
              }
            >
              <span className='text-t-tertiary cursor-pointer text-sm hover:text-t-primary leading-none'>❔</span>
            </Tooltip>
            <span className='text-xs text-t-secondary select-none'>YOLO Mode</span>
            <Switch
              size='small'
              checked={yoloMode}
              onChange={handleToggleYolo}
              disabled={isResponding || hasResponded}
            />
          </div>
        </div>
        {(toolCall.rawInput?.command || toolCall.title) && (
          <div>
            <Text className='text-xs text-t-secondary mb-1'>{t('messages.command')}</Text>
            <code className='text-xs bg-1 p-2 rounded block text-t-primary break-all'>
              {toolCall.rawInput?.command || toolCall.title}
            </code>
          </div>
        )}
        {!hasResponded && (
          <>
            <div className='mt-10px'>{t('messages.chooseAction')}</div>
            <Radio.Group direction='vertical' size='mini' value={selected} onChange={setSelected}>
              {options && options.length > 0 ? (
                options.map((option, index) => {
                  const optionName = option?.name || `${t('messages.option')} ${index + 1}`;
                  const optionId = option?.optionId || `option_${index}`;
                  return (
                    <Radio key={optionId} value={optionId}>
                      {optionName}
                    </Radio>
                  );
                })
              ) : (
                <Text type='secondary'>{t('messages.noOptionsAvailable')}</Text>
              )}
            </Radio.Group>
            <div className='flex justify-start pl-20px'>
              <Button type='primary' size='mini' disabled={!selected || isResponding} onClick={handleConfirm}>
                {isResponding ? t('messages.processing') : t('messages.confirm')}
              </Button>
            </div>
          </>
        )}

        {hasResponded && (
          <div
            className='mt-10px p-2 rounded-md border'
            style={{ backgroundColor: 'var(--color-success-light-1)', borderColor: 'rgb(var(--success-3))' }}
          >
            <Text className='text-sm' style={{ color: 'rgb(var(--success-6))' }}>
              ✓ {t('messages.responseSentSuccessfully')}
            </Text>
          </div>
        )}
      </div>
    </Card>
  );
});

export default MessageAcpPermission;
