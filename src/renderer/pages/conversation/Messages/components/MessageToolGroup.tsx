/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IMessageToolGroup } from '@/common/chat/chatLib';
import { iconColors } from '@/renderer/styles/colors';
import { jsonrepair } from 'jsonrepair';
import { Alert, Button, Checkbox, Image, Input, Message, Radio, Switch, Tag, Tooltip } from '@arco-design/web-react';
import { Copy, Download, LoadingOne } from '@icon-park/react';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FileChangesPanel from '@/renderer/components/base/FileChangesPanel';
import { useDiffPreviewHandlers } from '@/renderer/hooks/file/useDiffPreviewHandlers';
import { parseDiff } from '@/renderer/utils/file/diffUtils';
import MessageFileChanges from '../codex/MessageFileChanges';
import CollapsibleContent from '@renderer/components/chat/CollapsibleContent';
import LocalImageView from '@renderer/components/media/LocalImageView';
import MarkdownView from '@renderer/components/Markdown';
import { ToolConfirmationOutcome } from '@renderer/utils/common';
import { ImagePreviewContext } from '../MessageList';
import { COLLAPSE_CONFIG, TEXT_CONFIG } from '../constants';
import type { ImageGenerationResult, WriteFileResult } from '../types';

const CODE_STYLE = { marginTop: 4, marginBottom: 4 };

// Alert 组件样式常量 Alert component style constant
// 顶部对齐图标与内容，避免多行文本时图标垂直居中
const ALERT_CLASSES =
  '!items-start !rd-8px !px-8px [&_.arco-alert-icon]:flex [&_.arco-alert-icon]:items-start [&_.arco-alert-content-wrapper]:flex [&_.arco-alert-content-wrapper]:items-start [&_.arco-alert-content-wrapper]:w-full [&_.arco-alert-content]:flex-1';

// CollapsibleContent 高度常量 CollapsibleContent height constants
const RESULT_MAX_HEIGHT = COLLAPSE_CONFIG.MAX_HEIGHT;

// Helper to parse questions for ask_user tool
const parseAskUserQuestions = (details: any, description?: string) => {
  let questions: any[] = [];
  const extractQuestionsFromObj = (obj: any) => {
    if (Array.isArray(obj)) return obj;
    if (obj && Array.isArray(obj.questions)) return obj.questions;
    return null;
  };

  // 1. Try to use details.questions directly if it's already an array
  if (details?.questions && Array.isArray(details.questions)) {
    questions = details.questions;
  }
  // 2. Try to parse details.questions if it's a string
  else if (typeof details?.questions === 'string') {
    try {
      const repaired = jsonrepair(details.questions);
      const parsed = JSON.parse(repaired);
      const extracted = extractQuestionsFromObj(parsed);
      if (extracted) questions = extracted;
    } catch (e) {
      console.warn('Failed to parse details.questions string:', e);
    }
  }
  // 3. Fallback to description if we still have no questions
  if (questions.length === 0 && description) {
    try {
      let jsonStr = description;
      const startBrace = jsonStr.indexOf('{');
      const endBrace = jsonStr.lastIndexOf('}');
      const startBracket = jsonStr.indexOf('[');
      const endBracket = jsonStr.lastIndexOf(']');

      if (
        startBrace !== -1 &&
        endBrace !== -1 &&
        endBrace > startBrace &&
        (startBracket === -1 || startBrace < startBracket)
      ) {
        jsonStr = jsonStr.substring(startBrace, endBrace + 1);
      } else if (startBracket !== -1 && endBracket !== -1 && endBracket > startBracket) {
        jsonStr = jsonStr.substring(startBracket, endBracket + 1);
      }

      if (jsonStr.trim()) {
        const repaired = jsonrepair(jsonStr);
        const parsed = JSON.parse(repaired);
        const extracted = extractQuestionsFromObj(parsed);
        if (extracted) questions = extracted;
      }
    } catch (e) {
      console.warn('Failed to parse ask_user description:', e);
    }
  }

  if (questions.length === 0 && description) {
    questions = [
      {
        question: description,
        type: 'text',
        header: 'Question',
      },
    ];
  }
  return questions;
};

interface IMessageToolGroupProps {
  message: IMessageToolGroup;
}

const useConfirmationButtons = (
  confirmationDetails: IMessageToolGroupProps['message']['content'][number]['confirmationDetails'],
  t: (key: string, options?: any) => string,
  toolName?: string,
  description?: string
) => {
  return useMemo(() => {
    if (!confirmationDetails) return {};
    let question: string;
    const options: Array<{ label: string; value: ToolConfirmationOutcome; payload?: any }> = [];
    switch (confirmationDetails.type) {
      case 'edit':
        {
          question = t('messages.confirmation.applyChange');
          options.push(
            {
              label: t('messages.confirmation.yesAllowOnce'),
              value: ToolConfirmationOutcome.ProceedOnce,
            },
            {
              label: t('messages.confirmation.yesAllowAlways'),
              value: ToolConfirmationOutcome.ProceedAlways,
            },
            { label: t('messages.confirmation.no'), value: ToolConfirmationOutcome.Cancel }
          );
        }
        break;
      case 'exec':
        {
          question = t('messages.confirmation.allowExecution');
          options.push(
            {
              label: t('messages.confirmation.yesAllowOnce'),
              value: ToolConfirmationOutcome.ProceedOnce,
            },
            {
              label: t('messages.confirmation.yesAllowAlways'),
              value: ToolConfirmationOutcome.ProceedAlways,
            },
            { label: t('messages.confirmation.no'), value: ToolConfirmationOutcome.Cancel }
          );
        }
        break;
      case 'info':
        {
          question = t('messages.confirmation.proceed');
          options.push(
            {
              label: t('messages.confirmation.yesAllowOnce'),
              value: ToolConfirmationOutcome.ProceedOnce,
            },
            {
              label: t('messages.confirmation.yesAllowAlways'),
              value: ToolConfirmationOutcome.ProceedAlways,
            },
            { label: t('messages.confirmation.no'), value: ToolConfirmationOutcome.Cancel }
          );
        }
        break;
      case 'ask_user':
        {
          const questions = parseAskUserQuestions(confirmationDetails, description);
          question = questions[0]?.question || t('messages.confirmation.proceed');

          if (questions.length === 1 && questions[0].type === 'choice' && !questions[0].multiSelect) {
            const q = questions[0];
            q.options?.forEach((opt: any) => {
              const label = typeof opt === 'string' ? opt : opt.label || opt.name;
              options.push({
                label: label,
                value: ToolConfirmationOutcome.ProceedOnce,
                payload: { answers: { '0': label } },
              });
            });
            options.push({ label: t('messages.confirmation.no'), value: ToolConfirmationOutcome.Cancel });
          } else if (questions.length > 0) {
            options.push(
              {
                label: questions.length > 1 ? 'Submit Answers' : 'Submit Answer',
                value: ToolConfirmationOutcome.ProceedOnce,
              },
              { label: t('messages.confirmation.no'), value: ToolConfirmationOutcome.Cancel }
            );
          } else {
            options.push(
              {
                label: t('messages.confirmation.yesAllowOnce'),
                value: ToolConfirmationOutcome.ProceedOnce,
              },
              { label: t('messages.confirmation.no'), value: ToolConfirmationOutcome.Cancel }
            );
          }
        }
        break;
      case 'exit_plan_mode':
        {
          question = t('messages.confirmation.proceed');
          options.push(
            {
              label: t('messages.confirmation.yesAllowOnce'),
              value: ToolConfirmationOutcome.ProceedOnce,
            },
            { label: t('messages.confirmation.no'), value: ToolConfirmationOutcome.Cancel }
          );
        }
        break;
      default: {
        const mcpProps = confirmationDetails as any;

        // Robust check for "undefined" strings that might come from serialized state
        const rawToolName = mcpProps?.toolDisplayName || mcpProps?.toolName || toolName;
        const effectiveToolName =
          rawToolName && String(rawToolName) !== 'undefined' ? String(rawToolName) : 'unknown tool';

        const rawServerName = mcpProps?.serverName;
        const serverName = rawServerName && String(rawServerName) !== 'undefined' ? String(rawServerName) : null;

        if (serverName) {
          question = t('messages.confirmation.allowMCPTool', {
            toolName: effectiveToolName,
            serverName: serverName,
          });
          // Fallback if i18n returns placeholders or "undefined:undefined"
          if (!question || question.includes('{{') || question.includes('undefined:undefined')) {
            question = `Allow execution of tool "${effectiveToolName}" from server "${serverName}"?`;
          }
        } else {
          question = t('messages.confirmation.allowExecution', {
            command: effectiveToolName,
          });
          if (!question || question.includes('{{') || question.includes('undefined:undefined')) {
            question = `Allow execution of tool "${effectiveToolName}"?`;
          }
        }

        options.push(
          {
            label: t('messages.confirmation.yesAllowOnce'),
            value: ToolConfirmationOutcome.ProceedOnce,
          },
          {
            label: t('messages.confirmation.yesAlwaysAllowTool', {
              toolName: effectiveToolName,
              serverName: serverName || 'local',
            }),
            value: ToolConfirmationOutcome.ProceedAlwaysTool,
          }
        );

        if (serverName) {
          options.push({
            label: t('messages.confirmation.yesAlwaysAllowServer', {
              serverName: serverName,
            }),
            value: ToolConfirmationOutcome.ProceedAlwaysServer,
          });
        }

        options.push({ label: t('messages.confirmation.no'), value: ToolConfirmationOutcome.Cancel });
      }
    }
    return {
      question,
      options,
    };
  }, [confirmationDetails, t, toolName, description]);
};

const QuestionForm: React.FC<{
  questions: any[];
  answers: Record<string, any>;
  onAnswerChange: (index: string, value: any) => void;
  title?: string;
  isReadOnly?: boolean;
}> = ({ questions, answers, onAnswerChange, title, isReadOnly }) => {
  return (
    <div className='flex flex-col gap-16px p-16px bg-[var(--color-fill-1)] rd-12px mt-8px mb-16px'>
      <div className='font-600 text-[var(--color-text-1)] text-14px flex items-center gap-8px'>
        <div className='flex items-center justify-center w-24px h-24px rd-full bg-[rgba(var(--primary-6),0.1)] text-[rgb(var(--primary-6))]'>
          <span className='i-icon-park-outline:help w-14px h-14px'></span>
        </div>
        {title || 'Questions from Agent'}
      </div>
      <div className='flex flex-col gap-12px'>
        {questions.map((q: any, i: number) => {
          const indexStr = String(i);
          return (
            <div
              key={i}
              className='bg-[var(--color-bg-1)] p-16px rd-8px border border-solid border-[var(--color-border)] shadow-sm transition-all hover:border-[rgb(var(--primary-6))] hover:shadow-md group'
            >
              <div className='font-500 text-[var(--color-text-1)] text-14px leading-relaxed group-hover:text-[rgb(var(--primary-6))] transition-colors'>
                {q.header || q.question}
              </div>
              {q.header && q.question && (
                <div className='text-[var(--color-text-3)] text-12px mt-4px leading-relaxed'>{q.question}</div>
              )}

              <div className='mt-16px'>
                {q.type === 'choice' &&
                  q.options &&
                  (q.multiSelect ? (
                    <Checkbox.Group
                      className='grid grid-cols-1 sm:grid-cols-2 gap-8px w-full'
                      value={answers[indexStr] || []}
                      onChange={(val) => onAnswerChange(indexStr, val)}
                      disabled={isReadOnly}
                    >
                      {q.options.map((opt: any, j: number) => {
                        const label = typeof opt === 'string' ? opt : opt.label || opt.name;
                        const description = typeof opt === 'object' ? opt.description : null;
                        return (
                          <Checkbox
                            key={j}
                            value={label}
                            className='!m-0 p-10px rd-6px bg-[var(--color-fill-1)] hover:bg-[var(--color-fill-3)] transition-colors w-full border border-solid border-transparent hover:border-[var(--color-border-2)] items-start min-w-0'
                          >
                            <div className='flex flex-col ml-4px whitespace-normal break-words w-full'>
                              <span className='text-13px font-500 text-[var(--color-text-2)] leading-normal'>
                                {label}
                              </span>
                              {description && (
                                <span className='text-11px text-[var(--color-text-4)] mt-4px leading-normal'>
                                  {description}
                                </span>
                              )}
                            </div>
                          </Checkbox>
                        );
                      })}
                    </Checkbox.Group>
                  ) : (
                    <Radio.Group
                      className='grid grid-cols-1 sm:grid-cols-2 gap-8px w-full'
                      value={answers[indexStr]}
                      onChange={(val) => onAnswerChange(indexStr, val)}
                      disabled={isReadOnly}
                    >
                      {q.options.map((opt: any, j: number) => {
                        const label = typeof opt === 'string' ? opt : opt.label || opt.name;
                        const description = typeof opt === 'object' ? opt.description : null;
                        return (
                          <Radio
                            key={j}
                            value={label}
                            className='!m-0 p-10px rd-6px bg-[var(--color-fill-1)] hover:bg-[var(--color-fill-3)] transition-colors w-full border border-solid border-transparent hover:border-[var(--color-border-2)] items-start min-w-0'
                          >
                            <div className='flex flex-col ml-4px whitespace-normal break-words w-full'>
                              <span className='text-13px font-500 text-[var(--color-text-2)] leading-normal'>
                                {label}
                              </span>
                              {description && (
                                <span className='text-11px text-[var(--color-text-4)] mt-4px leading-normal'>
                                  {description}
                                </span>
                              )}
                            </div>
                          </Radio>
                        );
                      })}
                    </Radio.Group>
                  ))}

                {q.type === 'text' && (
                  <Input
                    className='w-full !text-13px !bg-[var(--color-fill-1)] !border-transparent hover:!bg-[var(--color-fill-3)] focus:!bg-[var(--color-bg-1)] focus:!border-[rgb(var(--primary-6))] transition-colors !h-36px !px-12px !rd-6px'
                    placeholder={q.placeholder || 'Type your answer...'}
                    value={answers[indexStr] || ''}
                    onChange={(val) => onAnswerChange(indexStr, val)}
                    disabled={isReadOnly}
                    allowClear
                  />
                )}

                {q.type === 'yesno' && (
                  <Radio.Group
                    type='button'
                    className='flex w-full [&>label]:flex-1 [&>label]:text-center'
                    value={answers[indexStr]}
                    onChange={(val) => onAnswerChange(indexStr, val)}
                    disabled={isReadOnly}
                  >
                    <Radio value='yes'>Yes</Radio>
                    <Radio value='no'>No</Radio>
                  </Radio.Group>
                )}

                {isReadOnly && answers[indexStr] && !q.multiSelect && !['choice', 'yesno'].includes(q.type) && (
                  <div className='p-10px bg-[var(--color-fill-2)] rd-6px text-13px font-500 text-[var(--color-text-2)] border border-solid border-[var(--color-border)]'>
                    {answers[indexStr]}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const EditConfirmationDiff: React.FC<{ diff: string; fileName: string; title: string }> = ({
  diff,
  fileName,
  title,
}) => {
  const fileInfo = useMemo(() => parseDiff(diff, fileName), [diff, fileName]);
  const displayName = fileName.split(/[/\\]/).pop() || fileName;
  const { handleFileClick, handleDiffClick } = useDiffPreviewHandlers({
    diffText: diff,
    displayName,
    filePath: fileName,
    title,
  });

  return (
    <FileChangesPanel
      title={title}
      files={[fileInfo]}
      onFileClick={handleFileClick}
      onDiffClick={handleDiffClick}
      defaultExpanded={true}
    />
  );
};

const ConfirmationDetails: React.FC<{
  content: IMessageToolGroupProps['message']['content'][number];
  onConfirm: (outcome: ToolConfirmationOutcome, payload?: any) => void;
  conversationId: string;
}> = ({ content, onConfirm, conversationId }) => {
  const { t } = useTranslation();
  const { confirmationDetails } = content;
  const [yoloMode, setYoloMode] = useState(false);
  if (!confirmationDetails) return;
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const node = useMemo(() => {
    if (!confirmationDetails) return null;
    switch (confirmationDetails.type) {
      case 'edit':
        return null; // Rendered separately below with hooks support
      case 'exec': {
        const bashSnippet = `\`\`\`bash\n${confirmationDetails.command}\n\`\`\``;
        return (
          <div className='w-full max-w-100% min-w-0'>
            <MarkdownView codeStyle={CODE_STYLE}>{bashSnippet}</MarkdownView>
          </div>
        );
      }
      case 'ask_user': {
        const questions = parseAskUserQuestions(confirmationDetails, content.description);
        return (
          <QuestionForm
            questions={questions}
            answers={answers}
            onAnswerChange={(index, val) => setAnswers((prev) => ({ ...prev, [index]: val }))}
            title={(confirmationDetails as any).title}
          />
        );
      }
      case 'exit_plan_mode':
        return <span className='text-t-primary'>{confirmationDetails.title}</span>;
      default:
        return null; // Handle via description rendering in ConfirmationDetails
    }
  }, [confirmationDetails, answers, content.description]);

  const { question = '', options = [] } = useConfirmationButtons(
    confirmationDetails,
    t,
    content.name,
    content.description
  );

  const [isResponding, setIsResponding] = useState(false);

  const isConfirm = content.status === 'Confirming';

  const handleToggleYolo = async (checked: boolean) => {
    setYoloMode(checked);
    if (checked) {
      try {
        await ipcBridge.geminiConversation.setYoloMode.invoke({ conversationId, yoloMode: true });
        // Auto-confirm the first "allow" option
        const allowOptIdx = options.findIndex(
          (opt) =>
            opt.value === ToolConfirmationOutcome.ProceedAlways || opt.value === ToolConfirmationOutcome.ProceedOnce
        );
        if (allowOptIdx !== -1 && isConfirm) {
          setIsResponding(true);
          try {
            onConfirm(options[allowOptIdx].value, options[allowOptIdx].payload);
          } finally {
            setIsResponding(false);
          }
        }
      } catch (error) {
        console.error('Failed to enable YOLO mode:', error);
        setYoloMode(false);
      }
    } else {
      try {
        await ipcBridge.geminiConversation.setYoloMode.invoke({ conversationId, yoloMode: false });
      } catch (error) {
        console.error('Failed to disable YOLO mode:', error);
        setYoloMode(true);
      }
    }
  };

  return (
    <div className='w-full min-w-0'>
      {isConfirm && (
        <div className='flex items-center justify-between mb-4'>
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
            <Switch size='small' checked={yoloMode} onChange={handleToggleYolo} disabled={isResponding} />
          </div>
        </div>
      )}
      {confirmationDetails.type === 'edit' ? (
        <EditConfirmationDiff
          diff={confirmationDetails?.fileDiff || ''}
          fileName={confirmationDetails.fileName}
          title={isConfirm ? confirmationDetails.title || content.name : content.description}
        />
      ) : (
        <>{node}</>
      )}
      {content.status === 'Confirming' && (
        <div className='mt-16px pt-16px border-t border-solid border-[var(--color-border-2)]'>
          {/* Hide redundant question text for Ask User as it's already in the form */}
          {confirmationDetails.type !== 'ask_user' && (
            <div className='mb-12px text-[var(--color-text-1)] font-600 text-14px'>{question}</div>
          )}
          <div className='flex flex-wrap gap-12px justify-start'>
            {options.map((opt, idx) => {
              const isSubmit = opt.value === ToolConfirmationOutcome.ProceedOnce && !opt.payload;
              const isAskUser = confirmationDetails.type === 'ask_user';

              // Validation for Submit button
              const isDisabled =
                isResponding ||
                (isSubmit &&
                  isAskUser &&
                  (() => {
                    const questions = parseAskUserQuestions(confirmationDetails, content.description);
                    if (questions.length > 0) {
                      for (let i = 0; i < questions.length; i++) {
                        if (!answers[i.toString()] && answers[i.toString()] !== 0) return true;
                      }
                    }
                    return false;
                  })());

              return (
                <Button
                  key={idx}
                  type={idx === 0 ? 'primary' : 'secondary'}
                  size='default'
                  className={idx === 0 ? 'min-w-120px' : 'min-w-80px'}
                  disabled={isDisabled}
                   onClick={() => {
                     const mergedAnswers = { ...answers, ...(opt.payload?.answers || {}) };
                     const payload = isAskUser ? { answers: mergedAnswers } : opt.payload;
                     onConfirm(opt.value, payload);
                   }}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ImageDisplay: 图片生成结果展示组件 Image generation result display component
const ImageDisplay: React.FC<{
  imgUrl: string;
  relativePath?: string;
}> = ({ imgUrl, relativePath }) => {
  const { t } = useTranslation();
  const [messageApi, messageContext] = Message.useMessage();
  const [imageUrl, setImageUrl] = useState<string>(imgUrl);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { inPreviewGroup } = useContext(ImagePreviewContext);

  // 如果是本地路径，需要加载为 base64 Load local paths as base64
  React.useEffect(() => {
    if (imgUrl.startsWith('data:') || imgUrl.startsWith('http')) {
      setImageUrl(imgUrl);
      setLoading(false);
    } else {
      setLoading(true);
      setError(false);
      ipcBridge.fs.getImageBase64
        .invoke({ path: imgUrl })
        .then((base64) => {
          setImageUrl(base64);
          setLoading(false);
        })
        .catch((error) => {
          console.error('Failed to load image:', error);
          setError(true);
          setLoading(false);
        });
    }
  }, [imgUrl]);

  // 获取图片 blob（复用逻辑）Get image blob (reusable logic)
  const getImageBlob = useCallback(async (): Promise<Blob> => {
    const response = await fetch(imageUrl);
    return await response.blob();
  }, [imageUrl]);

  const handleCopy = useCallback(async () => {
    try {
      const blob = await getImageBlob();

      // Try using Clipboard API with blob (requires secure context in WebUI)
      if (navigator.clipboard && window.isSecureContext && typeof navigator.clipboard.write === 'function') {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob,
            }),
          ]);
          messageApi.success(t('messages.copySuccess', { defaultValue: 'Copied' }));
          return;
        } catch (clipboardError) {
          console.warn('[ImageDisplay] Clipboard API failed, trying fallback:', clipboardError);
        }
      }

      // Fallback: Use canvas to copy image for browsers/Electron that don't support ClipboardItem with images
      const img = document.createElement('img');
      img.src = imageUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      ctx.drawImage(img, 0, 0);
      canvas.toBlob(async (canvasBlob) => {
        if (!canvasBlob) {
          messageApi.error(t('messages.copyFailed', { defaultValue: 'Failed to copy' }));
          return;
        }
        if (!navigator.clipboard || !window.isSecureContext || typeof navigator.clipboard.write !== 'function') {
          messageApi.error(t('messages.copyFailed', { defaultValue: 'Failed to copy' }));
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': canvasBlob,
            }),
          ]);
          messageApi.success(t('messages.copySuccess', { defaultValue: 'Copied' }));
        } catch (canvasError) {
          console.error('[ImageDisplay] Canvas fallback also failed:', canvasError);
          messageApi.error(t('messages.copyFailed', { defaultValue: 'Failed to copy' }));
        }
      }, 'image/png');
    } catch (error) {
      console.error('Failed to copy image:', error);
      messageApi.error(t('messages.copyFailed', { defaultValue: 'Failed to copy' }));
    }
  }, [getImageBlob, imageUrl, t, messageApi]);

  const handleDownload = useCallback(async () => {
    try {
      const blob = await getImageBlob();
      const fileName = relativePath?.split(/[\\/]/).pop() || 'image.png';

      // 创建下载链接 Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      messageApi.success(t('messages.downloadSuccess', { defaultValue: 'Download successful' }));
    } catch (error) {
      console.error('Failed to download image:', error);
      messageApi.error(t('messages.downloadFailed', { defaultValue: 'Failed to download' }));
    }
  }, [getImageBlob, relativePath, t, messageApi]);

  // 加载状态 Loading state
  if (loading) {
    return (
      <div className='flex items-center gap-8px my-8px'>
        <LoadingOne className='loading' theme='outline' size='14' fill={iconColors.primary} />
        <span className='text-t-secondary text-sm'>{t('common.loading', { defaultValue: 'Loading...' })}</span>
      </div>
    );
  }

  // 错误状态 Error state
  if (error || !imageUrl) {
    return (
      <div className='flex items-center gap-8px my-8px text-t-secondary text-sm'>
        <span>{t('messages.imageLoadFailed', { defaultValue: 'Failed to load image' })}</span>
      </div>
    );
  }

  // 图片元素 Image element
  const imageElement = (
    <Image
      src={imageUrl}
      alt={relativePath || 'Generated image'}
      width={197}
      style={{
        maxHeight: '320px',
        objectFit: 'contain',
        borderRadius: '8px',
        cursor: 'pointer',
      }}
    />
  );

  return (
    <>
      {messageContext}
      <div className='flex flex-col gap-8px my-8px' style={{ maxWidth: '197px' }}>
        {/* 图片预览 Image preview - 如果已在 PreviewGroup 中则直接渲染，否则包裹 PreviewGroup */}
        {inPreviewGroup ? imageElement : <Image.PreviewGroup>{imageElement}</Image.PreviewGroup>}
        {/* 操作按钮 Action buttons */}
        <div className='flex gap-8px'>
          <Tooltip content={t('common.copy', { defaultValue: 'Copy' })}>
            <Button
              type='secondary'
              size='small'
              shape='circle'
              icon={<Copy theme='outline' size='14' fill={iconColors.primary} />}
              onClick={handleCopy}
            />
          </Tooltip>
          <Tooltip content={t('common.download', { defaultValue: 'Download' })}>
            <Button
              type='secondary'
              size='small'
              shape='circle'
              icon={<Download theme='outline' size='14' fill={iconColors.primary} />}
              onClick={handleDownload}
            />
          </Tooltip>
        </div>
      </div>
    </>
  );
};

const ToolResultDisplay: React.FC<{
  content: IMessageToolGroupProps['message']['content'][number];
}> = ({ content }) => {
  const { resultDisplay, name } = content;

  // 图片生成特殊处理 Special handling for image generation
  if (name === 'ImageGeneration' && typeof resultDisplay === 'object') {
    const result = resultDisplay as ImageGenerationResult;
    // 如果有 img_url 才显示图片，否则显示错误信息
    if (result.img_url) {
      return (
        <LocalImageView
          src={result.img_url}
          alt={result.relative_path || result.img_url}
          className='max-w-100% max-h-100%'
        />
      );
    }
    // 如果是错误，继续走下面的 JSON 显示逻辑
  }

  // 将结果转换为字符串 Convert result to string
  const display = typeof resultDisplay === 'string' ? resultDisplay : JSON.stringify(resultDisplay, null, 2);

  // 使用 CollapsibleContent 包装长内容
  // Wrap long content with CollapsibleContent
  return (
    <CollapsibleContent maxHeight={RESULT_MAX_HEIGHT} defaultCollapsed={true} useMask={false}>
      <pre
        className='text-t-primary whitespace-pre-wrap break-words m-0'
        style={{ fontSize: `${TEXT_CONFIG.FONT_SIZE}px`, lineHeight: TEXT_CONFIG.LINE_HEIGHT }}
      >
        {display}
      </pre>
    </CollapsibleContent>
  );
};

const MessageToolGroup: React.FC<IMessageToolGroupProps> = ({ message }) => {
  const { t } = useTranslation();

  // 收集所有 WriteFile 结果用于汇总显示 / Collect all WriteFile results for summary display
  const writeFileResults = useMemo(() => {
    return message.content
      .filter(
        (item) =>
          item.name === 'WriteFile' &&
          item.resultDisplay &&
          typeof item.resultDisplay === 'object' &&
          'fileDiff' in item.resultDisplay
      )
      .map((item) => item.resultDisplay as WriteFileResult);
  }, [message.content]);

  // 找到第一个 WriteFile 的索引 / Find the index of first WriteFile
  const firstWriteFileIndex = useMemo(() => {
    return message.content.findIndex(
      (item) =>
        item.name === 'WriteFile' &&
        item.resultDisplay &&
        typeof item.resultDisplay === 'object' &&
        'fileDiff' in item.resultDisplay
    );
  }, [message.content]);

  return (
    <div>
      {message.content.map((content, index) => {
        const { status, callId, name, description, resultDisplay, confirmationDetails } = content;
        const isLoading = status !== 'Success' && status !== 'Error' && status !== 'Canceled';
        // status === "Confirming" &&
        if (confirmationDetails) {
          return (
            <ConfirmationDetails
              key={callId}
              content={content}
              conversationId={message.conversation_id}
              onConfirm={(outcome, payload) => {
                ipcBridge.geminiConversation.confirmMessage
                  .invoke({
                    confirmKey: outcome,
                    msg_id: message.id,
                    callId: callId,
                    conversation_id: message.conversation_id,
                    payload: payload,
                  })
                  .then(() => {
                    // confirmation sent successfully
                  })
                  .catch((error) => {
                    console.error('Failed to confirm message:', error);
                  });
              }}
            ></ConfirmationDetails>
          );
        }

        // WriteFile 特殊处理：使用 MessageFileChanges 汇总显示 / WriteFile special handling: use MessageFileChanges for summary display
        if (name === 'WriteFile' && typeof resultDisplay !== 'string') {
          if (resultDisplay && typeof resultDisplay === 'object' && 'fileDiff' in resultDisplay) {
            // 只在第一个 WriteFile 位置显示汇总组件 / Only show summary component at first WriteFile position
            if (index === firstWriteFileIndex && writeFileResults.length > 0) {
              return (
                <div className='w-full min-w-0' key={callId}>
                  <MessageFileChanges writeFileChanges={writeFileResults} />
                </div>
              );
            }
            // 跳过其他 WriteFile / Skip other WriteFile
            return null;
          }
        }

        // ImageGeneration 特殊处理：单独展示图片，不用 Alert 包裹 Special handling for ImageGeneration: display image separately without Alert wrapper
        if (name === 'ImageGeneration' && typeof resultDisplay === 'object') {
          const result = resultDisplay as ImageGenerationResult;
          if (result.img_url) {
            return <ImageDisplay key={callId} imgUrl={result.img_url} relativePath={result.relative_path} />;
          }
        }

        // 通用工具调用展示 Generic tool call display
        // 将可展开的长内容放在 Alert 下方，保持 Alert 仅展示头部信息
        return (
          <div key={callId}>
            <Alert
              className={ALERT_CLASSES}
              type={
                status === 'Error'
                  ? 'error'
                  : status === 'Success'
                    ? 'success'
                    : status === 'Canceled'
                      ? 'warning'
                      : 'info'
              }
              icon={
                isLoading && (
                  <LoadingOne theme='outline' size='12' fill={iconColors.primary} className='loading lh-[1] flex' />
                )
              }
              content={
                <div>
                  <Tag className={'mr-4px'}>
                    {name}
                    {status === 'Canceled' ? `(${t('messages.canceledExecution')})` : ''}
                  </Tag>
                </div>
              }
            />

            {(description || resultDisplay || status === 'Error') && (
              <div className='mt-8px'>
                {description && (
                  <div
                    className={`text-12px text-t-secondary mb-2 ${status === 'Error' ? 'whitespace-pre-wrap break-words' : 'truncate'}`}
                  >
                    {name === 'Ask User' || name === 'ask_user'
                       ? (() => {
                           const questions = parseAskUserQuestions(content.confirmationDetails, description);
                           if (questions.length > 0) {
                             return (
                               <QuestionForm
                                 questions={questions}
                                 answers={{}}
                                 onAnswerChange={() => {}}
                                 isReadOnly={true}
                               />
                             );
                           }
                           return description;
                         })()
                       : description}
                  </div>
                )}
                {resultDisplay && (
                  <div>
                    {/* 在 Alert 外展示完整结果 Display full result outside Alert */}
                    {/* ToolResultDisplay 内部已包含 CollapsibleContent，避免嵌套 */}
                    {/* ToolResultDisplay already contains CollapsibleContent internally, avoid nesting */}
                    <ToolResultDisplay content={content} />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MessageToolGroup;
