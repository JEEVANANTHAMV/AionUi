import React, { useState, useEffect } from 'react';
import {
  Button,
  Modal,
  Radio,
  Message,
  Dropdown,
  Menu,
  List,
  Spin,
  Empty,
  Typography,
  Input,
} from '@arco-design/web-react';
import { Magic, FolderOpen, Lightning } from '@icon-park/react';
import { useTranslation } from 'react-i18next';
import { ipcBridge } from '@/common';
import { emitter } from '@/renderer/utils/emitter';
import { ConfigStorage } from '@/common/config/storage';
import { uuid } from '@/common/utils';
import type { TMessage } from '@/common/chat/chatLib';
import type { IDirOrFile } from '@/common/adapter/ipcBridge';
import type { AcpBackendConfig } from '@/common/types/acpTypes';

interface SkillRuleGeneratorProps {
  conversationId: string;
  workspace?: string;
}

const LoadRuleModal: React.FC<{
  visible: boolean;
  onCancel: () => void;
  workspace?: string;
  conversationId: string;
}> = ({ visible, onCancel, workspace, conversationId }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'workspace' | 'library'>('workspace');
  const [loading, setLoading] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<IDirOrFile[]>([]);
  const [librarySkills, setLibrarySkills] = useState<any[]>([]);
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    if (visible) {
      if (activeTab === 'workspace' && workspace) {
        void loadWorkspaceFiles();
      } else if (activeTab === 'library') {
        void loadLibrarySkills();
      }
    }
  }, [visible, activeTab, workspace]);

  const loadWorkspaceFiles = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const result = await ipcBridge.fs.getFilesByDir.invoke({ dir: workspace, root: workspace });
      const flattenFiles = (nodes: IDirOrFile[]): IDirOrFile[] => {
        let acc: IDirOrFile[] = [];
        for (const node of nodes) {
          if (node.isFile) {
            if (/\.(json|md|py|txt)$/i.test(node.name)) {
              acc.push(node);
            }
          } else if (node.children) {
            acc = acc.concat(flattenFiles(node.children));
          }
        }
        return acc;
      };

      const flatList = result && result.length > 0 && result[0].children ? flattenFiles(result[0].children) : [];
      flatList.sort((a, b) => a.name.localeCompare(b.name));
      setWorkspaceFiles(flatList);
    } catch (error) {
      console.error('Failed to load workspace files:', error);
      Message.error(t('conversation.skill_generator.load_error'));
    } finally {
      setLoading(false);
    }
  };

  const loadLibrarySkills = async () => {
    setLoading(true);
    try {
      const result = await ipcBridge.fs.listAvailableSkills.invoke();
      setLibrarySkills(result || []);
    } catch (error) {
      console.error('Failed to load library skills:', error);
      Message.error(
        t('conversation.skill_generator.load_library_error', { defaultValue: 'Failed to load skills library' })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInjectWorkspaceFile = async (file: IDirOrFile) => {
    setLoadingAction(true);
    try {
      const content = await ipcBridge.fs.readFile.invoke({ path: file.fullPath });
      const prompt = `
System Instruction: The user has explicitly loaded the following rule/skill from the workspace. Please internalize and apply it to our conversation immediately.

Filename: ${file.name}

Content:
\`\`\`
${content}
\`\`\`

Please acknowledge receiving this rule/skill and confirm you will apply it.
      `.trim();

      await ipcBridge.conversation.sendMessage.invoke({
        input: prompt,
        msg_id: uuid(),
        conversation_id: conversationId,
      });

      Message.success(t('conversation.skill_generator.rule_loaded'));
      onCancel();
    } catch (error) {
      console.error('Failed to read file:', error);
      Message.error(t('conversation.skill_generator.read_error'));
    } finally {
      setLoadingAction(false);
    }
  };

  const handleInjectLibrarySkill = async (skill: any) => {
    setLoadingAction(true);
    try {
      const content = await ipcBridge.fs.readFile.invoke({ path: skill.location });
      const prompt = `
System Instruction: The user has explicitly injected the skill "${skill.name}" from their library. Please internalize and apply the following SKILL.md definition to our conversation immediately.

Skill Name: ${skill.name}
Description: ${skill.description}

SKILL.md Content:
\`\`\`markdown
${content}
\`\`\`

Please acknowledge receiving this skill and confirm you will apply its instructions.
      `.trim();

      await ipcBridge.conversation.sendMessage.invoke({
        input: prompt,
        msg_id: uuid(),
        conversation_id: conversationId,
      });

      // Update conversation's loaded skills if possible
      const conversation = await ipcBridge.conversation.get.invoke({ id: conversationId });
      if (conversation) {
        const extra = conversation.extra || {};
        const loadedSkills = (extra as any).loadedSkills || [];
        if (!loadedSkills.some((s: any) => s.name === skill.name)) {
          const newSkills = [...loadedSkills, { name: skill.name, description: skill.description }];
          await ipcBridge.conversation.update.invoke({
            id: conversationId,
            updates: { extra: { ...extra, loadedSkills: newSkills } },
          });
        }
      }

      Message.success(
        t('conversation.skill_generator.skill_injected', { defaultValue: 'Skill injected successfully' })
      );
      onCancel();
    } catch (error) {
      console.error('Failed to inject library skill:', error);
      Message.error(t('conversation.skill_generator.inject_error', { defaultValue: 'Failed to inject skill' }));
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <Modal
      title={t('conversation.skill_generator.load_title')}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      className='w-[90vw] md:w-[600px]'
    >
      <Radio.Group type='button' value={activeTab} onChange={setActiveTab} style={{ marginBottom: 16, width: '100%' }}>
        <Radio value='workspace' style={{ flex: 1, textAlign: 'center' }}>
          {t('conversation.skill_generator.tab_workspace', { defaultValue: 'Workspace' })}
        </Radio>
        <Radio value='library' style={{ flex: 1, textAlign: 'center' }}>
          {t('conversation.skill_generator.tab_library', { defaultValue: 'Skills Library' })}
        </Radio>
      </Radio.Group>

      <Spin loading={loading} style={{ display: 'block', minHeight: 200 }}>
        {activeTab === 'workspace' ? (
          workspaceFiles.length === 0 ? (
            <Empty description={t('conversation.skill_generator.no_files')} />
          ) : (
            <List
              dataSource={workspaceFiles}
              render={(file, index) => (
                <List.Item
                  key={index}
                  style={{ cursor: 'pointer', padding: '12px' }}
                  onClick={() => handleInjectWorkspaceFile(file)}
                  className='hover:bg-[var(--color-fill-2)] rounded transition-colors'
                >
                  <div className='flex items-center gap-3 w-full'>
                    <div className='bg-[var(--color-primary-light-1)] p-2 rounded'>
                      {file.name.endsWith('.py') ? (
                        <Lightning size={18} fill='var(--color-primary-6)' />
                      ) : (
                        <FolderOpen size={18} fill='var(--color-primary-6)' />
                      )}
                    </div>
                    <div className='flex-1 overflow-hidden'>
                      <Typography.Text bold>{file.name}</Typography.Text>
                      <div className='text-[var(--color-text-3)] text-xs truncate'>
                        {file.relativePath || file.name}
                      </div>
                    </div>
                    {loadingAction && <Spin size={16} />}
                  </div>
                </List.Item>
              )}
            />
          )
        ) : librarySkills.length === 0 ? (
          <Empty
            description={t('conversation.skill_generator.no_library_skills', {
              defaultValue: 'No skills found in library',
            })}
          />
        ) : (
          <List
            dataSource={librarySkills}
            render={(skill, index) => (
              <List.Item
                key={index}
                style={{ cursor: 'pointer', padding: '12px' }}
                onClick={() => handleInjectLibrarySkill(skill)}
                className='hover:bg-[var(--color-fill-2)] rounded transition-colors'
              >
                <div className='flex items-center gap-3 w-full'>
                  <div className='bg-[var(--color-primary-light-1)] p-2 rounded'>
                    <Lightning size={18} fill='var(--color-primary-6)' />
                  </div>
                  <div className='flex-1 overflow-hidden'>
                    <div className='flex items-center gap-2'>
                      <Typography.Text bold>{skill.name}</Typography.Text>
                      <span className='text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-fill-3)] text-[var(--color-text-3)] uppercase'>
                        {skill.source}
                      </span>
                    </div>
                    <div className='text-[var(--color-text-3)] text-xs truncate'>{skill.description}</div>
                  </div>
                  {loadingAction && <Spin size={16} />}
                </div>
              </List.Item>
            )}
          />
        )}
      </Spin>
    </Modal>
  );
};

const SkillRuleGenerator: React.FC<SkillRuleGeneratorProps> = ({ conversationId, workspace }) => {
  const { t } = useTranslation();
  const [generateVisible, setGenerateVisible] = useState(false);
  const [loadVisible, setLoadVisible] = useState(false);
  const [type, setType] = useState<'skill' | 'rule' | 'library_skill'>('skill');
  const [presetName, setPresetName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleOpen = (data?: { type?: 'skill' | 'rule' | 'library_skill' }) => {
      if (data?.type) setType(data.type);
      setGenerateVisible(true);
    };
    emitter.on('skill.generator.open', handleOpen);
    return () => {
      emitter.off('skill.generator.open', handleOpen);
    };
  }, []);

  const handleGenerate = async () => {
    if (!workspace) {
      Message.error(t('conversation.skill_generator.no_workspace', { defaultValue: 'No workspace available' }));
      return;
    }

    if (!presetName.trim()) {
      Message.warning(
        t('conversation.skill_generator.name_required', { defaultValue: 'Please enter a name for the preset' })
      );
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch conversation history
      const pageSize = 50;
      const MAX_CHARS = 30000;

      const messages = await ipcBridge.database.getConversationMessages.invoke({
        conversation_id: conversationId,
        pageSize: pageSize,
      });

      if (!messages || messages.length === 0) {
        Message.warning(
          t('conversation.skill_generator.no_history', { defaultValue: 'No conversation history found' })
        );
        setLoading(false);
        return;
      }

      let historyText = messages
        .map((msg: TMessage) => {
          if (msg.type === 'text') {
            const role = msg.position === 'right' ? 'User' : 'Assistant';
            return `${role}: ${msg.content.content}`;
          }
          return null;
        })
        .filter(Boolean)
        .join('\n\n');

      if (historyText.length > MAX_CHARS) {
        historyText = '...[History Truncated]...\n' + historyText.slice(-MAX_CHARS);
      }

      // 2. Construct prompt
      const finalName = presetName.trim();
      let typeLabel = '';
      let requirements = '';
      if (type === 'skill') {
        typeLabel = 'Python script (Skill)';
        requirements = `- Create a reusable Python script. Save it as a .py file in the workspace (e.g., skill_${finalName.toLowerCase().replace(/\s+/g, '_')}.py).
- Use the 'write_file' tool to save the file directly.`;
      } else if (type === 'rule') {
        typeLabel = 'Rule file (JSON/Markdown)';
        requirements = `- Create a structured rule definition (JSON or Markdown). Save it as a .json or .md file in the workspace (e.g., rule_${finalName.toLowerCase().replace(/\s+/g, '_')}.json).
- Use the 'write_file' tool to save the file directly.`;
      } else if (type === 'library_skill') {
        typeLabel = 'SKILL.md (Skill Library)';
        requirements = `- Create a standardized SKILL.md file with YAML front matter.
- The front matter MUST include:
  ---
  name: ${finalName}
  description: A brief description of this skill's purpose.
  ---
- The rest of the file should contain detailed instructions for the agent on how to perform the tasks identified in the history.
- Do NOT use tools to save this file yourself. Just output the content.`;
      }

      const prompt = `
Based on the following conversation history, please generate a ${typeLabel} for a specialized agent named "${finalName}".

Context:
${historyText}

Requirements:
${requirements}
- VERY IMPORTANT: Additionally, output the EXACT content of the generated rule/skill between ---PRESET_BEGIN--- and ---PRESET_END--- tags so I can register it as a global preset.
- After finishing, reply with a brief confirmation.
      `.trim();

      const msg_id = uuid();
      let capturedContent = '';

      // Listen for the response to capture preset content
      const removeListener = ipcBridge.conversation.responseStream.on((msg) => {
        if (msg.conversation_id === conversationId && msg.msg_id === msg_id) {
          if (msg.type === 'content') {
            capturedContent += msg.data as string;
          } else if (msg.type === 'finish') {
            // Extract content between tags
            const match = capturedContent.match(/---PRESET_BEGIN---([\s\S]*?)---PRESET_END---/);
            if (match && match[1]) {
              if (type === 'library_skill') {
                void saveLibrarySkill(finalName, match[1].trim());
              } else {
                void registerPreset(finalName, match[1].trim());
              }
            }
            removeListener();
          }
        }
      });

      // 3. Send prompt to the agent
      await ipcBridge.conversation.sendMessage.invoke({
        input: prompt,
        msg_id: msg_id,
        conversation_id: conversationId,
      });

      setGenerateVisible(false);
      setPresetName('');
      Message.success(t('conversation.skill_generator.request_sent', { defaultValue: 'Request sent to agent' }));
    } catch (error) {
      console.error('Failed to generate skill/rule:', error);
      Message.error(t('conversation.skill_generator.failed', { defaultValue: 'Failed to generate' }));
    } finally {
      setLoading(false);
    }
  };

  const saveLibrarySkill = async (name: string, content: string) => {
    try {
      const result = await ipcBridge.fs.saveLibrarySkill.invoke({ name, content });
      if (result.success) {
        Message.success(
          t('conversation.skill_generator.skill_saved_to_library', {
            defaultValue: 'Skill saved to library successfully!',
          })
        );
        // Refresh library list if modal is open
        if (loadVisible) {
          await ipcBridge.fs.listAvailableSkills.invoke();
        }
      } else {
        Message.error(result.msg || 'Failed to save skill');
      }
    } catch (error) {
      console.error('Failed to save library skill:', error);
      Message.error('Failed to save library skill');
    }
  };

  const registerPreset = async (name: string, content: string) => {
    try {
      const customAgents = ((await ConfigStorage.get('assistants')) ?? []) as AcpBackendConfig[];
      const presetAgent: AcpBackendConfig = {
        id: uuid(),
        name,
        enabled: true,
        isPreset: true,
        context: content,
      };
      customAgents.push(presetAgent);
      await ConfigStorage.set('assistants', customAgents);
      await ipcBridge.acpConversation.refreshCustomAgents.invoke();
      Message.success(
        t('conversation.skill_generator.preset_registered', { defaultValue: 'Agent preset registered successfully!' })
      );
    } catch (error) {
      console.error('Failed to register preset:', error);
    }
  };

  const menu = (
    <Menu>
      <Menu.Item key='generate' onClick={() => setGenerateVisible(true)}>
        <div className='flex items-center gap-2'>
          <Magic />
          {t('conversation.skill_generator.menu_generate', { defaultValue: 'Generate from History' })}
        </div>
      </Menu.Item>
      <Menu.Item key='load' onClick={() => setLoadVisible(true)}>
        <div className='flex items-center gap-2'>
          <FolderOpen />
          {t('conversation.skill_generator.menu_load', { defaultValue: 'Load Rule/Skill' })}
        </div>
      </Menu.Item>
    </Menu>
  );

  return (
    <>
      <Dropdown droplist={menu} trigger='click' position='br'>
        <Button
          type='text'
          icon={<Magic />}
          style={{ color: 'var(--color-text-2)' }}
          aria-label={t('conversation.skill_generator.title', { defaultValue: 'Skill & Rules' })}
        />
      </Dropdown>

      {/* Generate Modal */}
      <Modal
        title={t('conversation.skill_generator.title', { defaultValue: 'Generate Skill/Rule' })}
        visible={generateVisible}
        onOk={handleGenerate}
        onCancel={() => setGenerateVisible(false)}
        okText={t('conversation.skill_generator.generate', { defaultValue: 'Generate' })}
        confirmLoading={loading}
        className='w-[90vw] md:w-[500px]'
      >
        <div style={{ marginBottom: 16 }}>
          <div className='mb-4'>
            <Typography.Text>
              {t('conversation.skill_generator.name_label', { defaultValue: 'Agent Name:' })}
            </Typography.Text>
            <Input
              className='mt-2'
              placeholder={t('conversation.skill_generator.name_placeholder', {
                defaultValue: 'e.g. Excel Translator',
              })}
              value={presetName}
              onChange={setPresetName}
            />
          </div>
          <p>
            {t('conversation.skill_generator.description', {
              defaultValue: 'Analyze conversation history to generate:',
            })}
          </p>
        </div>
        <Radio.Group value={type} onChange={setType} direction='vertical' className='flex flex-col gap-2'>
          <Radio value='library_skill'>
            {t('conversation.skill_generator.type_library_skill', { defaultValue: 'Skill Library (SKILL.md)' })}
          </Radio>
          <Radio value='skill'>
            {t('conversation.skill_generator.type_skill', { defaultValue: 'Skill script (Python)' })}
          </Radio>
          <Radio value='rule'>
            {t('conversation.skill_generator.type_rule', { defaultValue: 'Rule file (JSON/MD)' })}
          </Radio>
        </Radio.Group>
      </Modal>

      {/* Load Modal */}
      <LoadRuleModal
        visible={loadVisible}
        onCancel={() => setLoadVisible(false)}
        workspace={workspace}
        conversationId={conversationId}
      />
    </>
  );
};

export default SkillRuleGenerator;
