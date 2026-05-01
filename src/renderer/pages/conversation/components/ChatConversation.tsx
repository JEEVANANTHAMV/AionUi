/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IProvider, TChatConversation, TProviderWithModel } from '@/common/config/storage';
import { uuid } from '@/common/utils';
import addChatIcon from '@/renderer/assets/icons/add-chat.svg';
import { CronJobManager } from '@/renderer/pages/cron';
import { usePresetAssistantInfo, resolveAssistantConfigId } from '@/renderer/hooks/agent/usePresetAssistantInfo';
import { iconColors } from '@/renderer/styles/colors';
import { Button, Popover, Menu, Tooltip, Typography } from '@arco-design/web-react';
import { History, Plus, Magic } from '@icon-park/react';
import React, { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { emitter } from '@/renderer/utils/emitter';
import AcpChat from '../platforms/acp/AcpChat';
import ChatLayout from './ChatLayout';
import ChatSider from './ChatSider';
import NanobotChat from '../platforms/nanobot/NanobotChat';
import OpenClawChat from '../platforms/openclaw/OpenClawChat';
import RemoteChat from '../platforms/remote/RemoteChat';
import GeminiChat from '../platforms/gemini/GeminiChat';
import AcpModelSelector from '@/renderer/components/agent/AcpModelSelector';
import GeminiModelSelector from '../platforms/gemini/GeminiModelSelector';
import { useGeminiModelSelection } from '../platforms/gemini/useGeminiModelSelection';
import ForjinnrsChat from '../platforms/forjinnrs/ForjinnrsChat';
import ForjinnrsModelSelector from '../platforms/forjinnrs/ForjinnrsModelSelector';
import { useForjinnrsModelSelection } from '../platforms/forjinnrs/useForjinnrsModelSelection';
import { usePreviewContext } from '../Preview';
import StarOfficeMonitorCard from '../platforms/openclaw/StarOfficeMonitorCard.tsx';
import ConversationSkillsIndicator from './ConversationSkillsIndicator';
import SkillRuleGenerator from './SkillRuleGenerator';

/** Check whether a specific skill is loaded for the conversation */
const hasLoadedSkill = (conversation: TChatConversation | undefined, skillName: string): boolean => {
  const loadedSkills = (conversation?.extra as { loadedSkills?: Array<{ name: string }> })?.loadedSkills;
  return loadedSkills?.some((s) => s.name === skillName) ?? false;
};

const _AssociatedConversation: React.FC<{ conversation: TChatConversation }> = ({ conversation }) => {
  const { id: conversation_id } = conversation;
  const { t } = useTranslation();
  const { data } = useSWR(['getAssociateConversation', conversation_id], () =>
    ipcBridge.conversation.getAssociateConversation.invoke({ conversation_id })
  );
  const navigate = useNavigate();

  // Sort by modifyTime descending
  const list = useMemo(() => {
    if (!data?.length) return [];
    return [...data].sort((a, b) => (b.modifyTime || 0) - (a.modifyTime || 0));
  }, [data]);

  if (!list.length || (list.length === 1 && list[0].id === conversation_id)) return null;

  return (
    <Popover
      position='br'
      trigger='click'
      content={
        <div className='w-280px flex flex-col bg-1 overflow-hidden rd-8px'>
          <div className='px-12px py-10px b-b-1 b-solid b-[var(--border-base)] flex items-center justify-between bg-2'>
            <span className='text-12px font-bold color-[var(--text-secondary)]'>
              {t('conversation.history.sessions', 'Workspace Sessions')}
            </span>
            <span className='text-11px color-[var(--text-tertiary)]'>
              {list.length} {t('common.items', 'items')}
            </span>
          </div>
          <div className='max-h-400px overflow-y-auto py-4px'>
            {list.map((item) => {
              const isActive = item.id === conversation_id;
              const date = item.modifyTime ? new Date(item.modifyTime).toLocaleString() : '';
              return (
                <div
                  key={item.id}
                  className={`group relative px-12px py-10px cursor-pointer transition-colors flex flex-col gap-2px ${isActive ? 'bg-[var(--primary-1)]' : 'hover:bg-[var(--bg-3)]'}`}
                  onClick={() => {
                    if (!isActive) navigate(`/conversation/${item.id}`);
                  }}
                >
                  <div className='flex items-center justify-between gap-8px'>
                    <Typography.Ellipsis
                      className={`text-13px font-medium truncate ${isActive ? 'color-[var(--color-primary)]' : 'color-[var(--text-primary)]'}`}
                    >
                      {item.name || 'Untitled Session'}
                    </Typography.Ellipsis>
                    {isActive && <div className='w-6px h-6px rd-full bg-[var(--color-primary)] shrink-0' />}
                  </div>
                  <div className='text-11px color-[var(--text-tertiary)]'>{date}</div>
                </div>
              );
            })}
          </div>
        </div>
      }
    >
      <Button size='mini' icon={<History theme='outline' size='16' fill={iconColors.secondary} strokeWidth={3} />} />
    </Popover>
  );
};

const _AddNewConversation: React.FC<{ conversation: TChatConversation }> = ({ conversation }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isCreatingRef = useRef(false);
  if (!conversation.extra?.workspace) return null;
  return (
    <Tooltip content={t('conversation.workspace.createNewConversation')}>
      <Button
        size='mini'
        icon={<Plus theme='outline' size='14' fill={iconColors.primary} strokeWidth={3} />}
        onClick={async () => {
          if (isCreatingRef.current) return;
          isCreatingRef.current = true;
          try {
            const id = uuid();
            // Fetch latest conversation from DB to ensure sessionMode is current
            const latest = await ipcBridge.conversation.get.invoke({ id: conversation.id }).catch((): null => null);
            const source = latest || conversation;
            await ipcBridge.conversation.createWithConversation.invoke({
              conversation: {
                ...source,
                id,
                createTime: Date.now(),
                modifyTime: Date.now(),
                // Clear ACP session fields to prevent new conversation from inheriting old session context
                extra:
                  source.type === 'acp'
                    ? { ...source.extra, acpSessionId: undefined, acpSessionUpdatedAt: undefined }
                    : source.extra,
              } as TChatConversation,
            });
            void navigate(`/conversation/${id}`);
            emitter.emit('chat.history.refresh');
          } catch (error) {
            console.error('Failed to create conversation:', error);
          } finally {
            isCreatingRef.current = false;
          }
        }}
      />
    </Tooltip>
  );
};

// 仅抽取 Gemini 会话，确保包含模型信息
// Narrow to Gemini conversations so model field is always available
type GeminiConversation = Extract<TChatConversation, { type: 'gemini' }>;

const GeminiConversationPanel: React.FC<{
  conversation: GeminiConversation;
  sliderTitle: React.ReactNode;
  hideSendBox?: boolean;
}> = ({ conversation, sliderTitle, hideSendBox }) => {
  const { t } = useTranslation();
  // Save model selection to conversation via IPC
  const onSelectModel = useCallback(
    async (_provider: IProvider, modelName: string) => {
      const selected = { ..._provider, useModel: modelName } as TProviderWithModel;
      const ok = await ipcBridge.conversation.update.invoke({ id: conversation.id, updates: { model: selected } });
      return Boolean(ok);
    },
    [conversation.id]
  );

  // Share model selection state between header and send box
  const modelSelection = useGeminiModelSelection({ initialModel: conversation.model, onSelectModel });
  const workspaceEnabled = Boolean(conversation.extra?.workspace);

  // 使用统一的 Hook 获取预设助手信息 / Use unified hook for preset assistant info
  const { info: presetAssistantInfo } = usePresetAssistantInfo(conversation);
  const geminiAssistantId = resolveAssistantConfigId(conversation) ?? undefined;

  const chatLayoutProps = {
    title: conversation.name,
    siderTitle: sliderTitle,
    sider: <ChatSider conversation={conversation} />,
    headerLeft: <GeminiModelSelector selection={modelSelection} />,
    headerExtra: (
      <div className='flex items-center gap-8px'>
        <ConversationSkillsIndicator conversation={conversation} />
        <Button
          type='secondary'
          size='mini'
          icon={<Magic />}
          onClick={() => {
            // Trigger the generate modal in SkillRuleGenerator via event or ref
            emitter.emit('skill.generator.open', { type: 'library_skill' });
          }}
        >
          {t('conversation.skills.create', { defaultValue: 'Create Skill' })}
        </Button>
        <SkillRuleGenerator conversationId={conversation.id} workspace={conversation.extra?.workspace} />
        <CronJobManager
          conversationId={conversation.id}
          cronJobId={conversation.extra?.cronJobId as string | undefined}
          hasCronSkill={hasLoadedSkill(conversation, 'cron')}
        />
      </div>
    ),
    workspaceEnabled,
    backend: 'gemini' as const,
    presetAssistant: presetAssistantInfo ? { ...presetAssistantInfo, id: geminiAssistantId } : undefined,
  };

  return (
    <ChatLayout {...chatLayoutProps} conversationId={conversation.id} workspacePath={conversation.extra.workspace}>
      <GeminiChat
        conversation_id={conversation.id}
        workspace={conversation.extra.workspace}
        modelSelection={modelSelection}
        cronJobId={conversation.extra?.cronJobId as string | undefined}
        hideSendBox={hideSendBox}
        sessionMode={conversation.extra?.sessionMode}
      />
    </ChatLayout>
  );
};

type ForjinnrsConversation = Extract<TChatConversation, { type: 'forjinnrs' }>;

const ForjinnrsConversationPanel: React.FC<{ conversation: ForjinnrsConversation; sliderTitle: React.ReactNode }> = ({
  conversation,
  sliderTitle,
}) => {
  const { t } = useTranslation();
  const onSelectModel = useCallback(
    async (_provider: IProvider, modelName: string) => {
      const selected = { ..._provider, useModel: modelName } as TProviderWithModel;
      // Kill running agent on model switch — will be rebuilt with new model on next message
      await ipcBridge.conversation.stop.invoke({ conversation_id: conversation.id });
      const ok = await ipcBridge.conversation.update.invoke({ id: conversation.id, updates: { model: selected } });
      return Boolean(ok);
    },
    [conversation.id]
  );

  const modelSelection = useForjinnrsModelSelection({
    initialModel: conversation.model,
    onSelectModel,
  });
  const workspaceEnabled = Boolean(conversation.extra?.workspace);
  const { info: presetAssistantInfo } = usePresetAssistantInfo(conversation);
  const forjinnrsAssistantId = resolveAssistantConfigId(conversation) ?? undefined;

  const chatLayoutProps = {
    title: conversation.name,
    siderTitle: sliderTitle,
    sider: <ChatSider conversation={conversation} />,
    headerLeft: <ForjinnrsModelSelector selection={modelSelection} />,
    headerExtra: (
      <div className='flex items-center gap-8px'>
        <ConversationSkillsIndicator conversation={conversation} />
        <Button
          type='secondary'
          size='mini'
          icon={<Magic />}
          onClick={() => {
            emitter.emit('skill.generator.open', { type: 'library_skill' });
          }}
        >
          {t('conversation.skills.create', { defaultValue: 'Create Skill' })}
        </Button>
        <SkillRuleGenerator conversationId={conversation.id} workspace={conversation.extra?.workspace} />
        <CronJobManager
          conversationId={conversation.id}
          cronJobId={conversation.extra?.cronJobId as string | undefined}
          hasCronSkill={hasLoadedSkill(conversation, 'cron')}
        />
      </div>
    ),
    workspaceEnabled,
    backend: 'forjinnrs' as const,
    presetAssistant: presetAssistantInfo ? { ...presetAssistantInfo, id: forjinnrsAssistantId } : undefined,
  };

  return (
    <ChatLayout {...chatLayoutProps} conversationId={conversation.id}>
      <ForjinnrsChat
        conversation_id={conversation.id}
        workspace={conversation.extra.workspace}
        modelSelection={modelSelection}
        sessionMode={conversation.extra?.sessionMode}
      />
    </ChatLayout>
  );
};

const ChatConversation: React.FC<{
  conversation?: TChatConversation;
  hideSendBox?: boolean;
}> = ({ conversation, hideSendBox }) => {
  const { t } = useTranslation();
  const { openPreview } = usePreviewContext();
  const workspaceEnabled = Boolean(conversation?.extra?.workspace);

  const isGeminiConversation = conversation?.type === 'gemini';
  const isForjinnrsConversation = conversation?.type === 'forjinnrs';

  // 使用统一的 Hook 获取预设助手信息（ACP/Codex 会话）
  // Use unified hook for preset assistant info (ACP/Codex conversations)
  const acpConversation = isGeminiConversation || isForjinnrsConversation ? undefined : conversation;
  const { info: presetAssistantInfo, isLoading: isLoadingPreset } = usePresetAssistantInfo(acpConversation);
  const acpAssistantId = acpConversation ? (resolveAssistantConfigId(acpConversation) ?? undefined) : undefined;

  const conversationAgentName = (conversation?.extra as { agentName?: string } | undefined)?.agentName;
  const assistantDisplayName = presetAssistantInfo?.name || conversationAgentName;

  const conversationNode = useMemo(() => {
    if (!conversation || isGeminiConversation || isForjinnrsConversation) return null;
    switch (conversation.type) {
      case 'acp':
        return (
          <AcpChat
            key={conversation.id}
            conversation_id={conversation.id}
            workspace={conversation.extra?.workspace}
            backend={conversation.extra?.backend || 'claude'}
            sessionMode={conversation.extra?.sessionMode}
            cachedConfigOptions={conversation.extra?.cachedConfigOptions}
            agentName={assistantDisplayName}
            cronJobId={(conversation.extra as { cronJobId?: string })?.cronJobId}
            hideSendBox={hideSendBox}
          ></AcpChat>
        );
      case 'codex': // Legacy: codex now uses ACP protocol
        return (
          <AcpChat
            key={conversation.id}
            conversation_id={conversation.id}
            workspace={conversation.extra?.workspace}
            backend='codex'
            agentName={assistantDisplayName}
            cachedConfigOptions={
              (
                conversation.extra as {
                  cachedConfigOptions?: import('@/common/types/acpTypes').AcpSessionConfigOption[];
                }
              )?.cachedConfigOptions
            }
            hideSendBox={hideSendBox}
          />
        );
      case 'openclaw-gateway':
        return (
          <OpenClawChat
            key={conversation.id}
            conversation_id={conversation.id}
            workspace={conversation.extra?.workspace}
            cronJobId={(conversation.extra as { cronJobId?: string })?.cronJobId}
          />
        );
      case 'nanobot':
        return (
          <NanobotChat
            key={conversation.id}
            conversation_id={conversation.id}
            workspace={conversation.extra?.workspace}
            cronJobId={(conversation.extra as { cronJobId?: string })?.cronJobId}
          />
        );
      case 'remote':
        return (
          <RemoteChat
            key={conversation.id}
            conversation_id={conversation.id}
            workspace={conversation.extra?.workspace}
            cronJobId={(conversation.extra as { cronJobId?: string })?.cronJobId}
          />
        );
      default:
        return null;
    }
  }, [conversation, isGeminiConversation, isForjinnrsConversation, assistantDisplayName, hideSendBox]);

  const sliderTitle = useMemo(() => {
    if (!conversation) return null;
    return (
      <div className='flex items-center justify-between w-full'>
        <span className='text-16px font-bold text-t-primary truncate pr-8px'>{t('conversation.workspace.title')}</span>
        <div className='flex items-center gap-4px shrink-0'>
          <_AssociatedConversation conversation={conversation} />
          <_AddNewConversation conversation={conversation} />
        </div>
      </div>
    );
  }, [t, conversation]);

  // For ACP/Codex conversations, use AcpModelSelector that can show/switch models.
  // For other non-Gemini conversations, show disabled GeminiModelSelector.
  // NOTE: This must be placed before the Gemini early return to maintain consistent hook order.
  const modelSelector = useMemo(() => {
    if (!conversation || isGeminiConversation || isForjinnrsConversation) return undefined;
    if (conversation.type === 'acp') {
      const extra = conversation.extra as { backend?: string; currentModelId?: string };
      return (
        <AcpModelSelector
          conversationId={conversation.id}
          backend={extra.backend}
          initialModelId={extra.currentModelId}
        />
      );
    }
    if (conversation.type === 'codex') {
      return <AcpModelSelector conversationId={conversation.id} />;
    }
    return <GeminiModelSelector disabled={true} />;
  }, [conversation, isGeminiConversation, isForjinnrsConversation]);

  if (conversation && conversation.type === 'forjinnrs') {
    return <ForjinnrsConversationPanel key={conversation.id} conversation={conversation} sliderTitle={sliderTitle} />;
  }

  if (conversation && conversation.type === 'gemini') {
    // Gemini 会话独立渲染，带右上角模型选择
    // Render Gemini layout with dedicated top-right model selector
    return (
      <GeminiConversationPanel
        key={conversation.id}
        conversation={conversation}
        sliderTitle={sliderTitle}
        hideSendBox={hideSendBox}
      />
    );
  }

  // 如果有预设助手信息，使用预设助手的 logo 和名称；加载中时不进入 fallback；否则使用 backend 的 logo
  // If preset assistant info exists, use preset logo/name; while loading, avoid fallback; otherwise use backend logo
  const chatLayoutProps = presetAssistantInfo
    ? {
        presetAssistant: { ...presetAssistantInfo, id: acpAssistantId },
      }
    : isLoadingPreset
      ? {} // Still loading custom agents — avoid showing backend logo prematurely
      : {
          backend:
            conversation?.type === 'acp'
              ? conversation?.extra?.backend
              : conversation?.type === 'forjinnrs'
                ? 'forjinnrs'
                : conversation?.type === 'codex'
                  ? 'codex'
                  : conversation?.type === 'openclaw-gateway'
                    ? 'openclaw-gateway'
                    : conversation?.type === 'nanobot'
                      ? 'nanobot'
                      : conversation?.type === 'remote'
                        ? 'remote'
                        : undefined,
          agentName: conversationAgentName,
        };

  const headerExtraNode = (
    <div className='flex items-center gap-8px'>
      {conversation?.type === 'openclaw-gateway' && (
        <div className='shrink-0'>
          <StarOfficeMonitorCard
            conversationId={conversation.id}
            onOpenUrl={(url, metadata) => {
              openPreview(url, 'url', metadata);
            }}
          />
        </div>
      )}
      <ConversationSkillsIndicator conversation={conversation} />
      {conversation && (
        <Button
          type='secondary'
          size='mini'
          icon={<Magic />}
          onClick={() => {
            emitter.emit('skill.generator.open', { type: 'library_skill' });
          }}
        >
          {t('conversation.skills.create', { defaultValue: 'Create Skill' })}
        </Button>
      )}
      {conversation && (
        <div className='shrink-0'>
          <SkillRuleGenerator conversationId={conversation.id} workspace={conversation.extra?.workspace} />
        </div>
      )}
      {conversation && (
        <div className='shrink-0'>
          <CronJobManager
            conversationId={conversation.id}
            cronJobId={conversation.extra?.cronJobId as string | undefined}
            hasCronSkill={hasLoadedSkill(conversation, 'cron')}
          />
        </div>
      )}
    </div>
  );

  return (
    <ChatLayout
      title={conversation?.name}
      {...chatLayoutProps}
      headerLeft={modelSelector}
      headerExtra={headerExtraNode}
      siderTitle={sliderTitle}
      sider={<ChatSider conversation={conversation} />}
      workspaceEnabled={workspaceEnabled}
      workspacePath={conversation?.extra?.workspace}
      conversationId={conversation?.id}
    >
      {conversationNode}
    </ChatLayout>
  );
};

export default ChatConversation;
