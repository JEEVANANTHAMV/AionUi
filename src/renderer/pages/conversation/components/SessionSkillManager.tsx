/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Modal, List, Checkbox, Input, Spin, Empty, Typography, Message } from '@arco-design/web-react';
import { Search, Lightning } from '@icon-park/react';
import { useTranslation } from 'react-i18next';
import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';

interface SessionSkillManagerProps {
  visible: boolean;
  onCancel: () => void;
  conversation: TChatConversation | undefined;
}

const SessionSkillManager: React.FC<SessionSkillManagerProps> = ({ visible, onCancel, conversation }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [enabledSkills, setEnabledSkills] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (visible && conversation) {
      void loadSkills();
      setEnabledSkills((conversation.extra as any).enabledSkills || []);
    }
  }, [visible, conversation]);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const result = await ipcBridge.fs.listAvailableSkills.invoke();
      setAllSkills(result || []);
    } catch (error) {
      console.error('Failed to load skills:', error);
      Message.error(t('conversation.skills.load_error', { defaultValue: 'Failed to load skills library' }));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSkill = async (skillName: string, checked: boolean) => {
    if (!conversation) return;

    const newEnabledSkills = checked ? [...enabledSkills, skillName] : enabledSkills.filter((s) => s !== skillName);

    setEnabledSkills(newEnabledSkills);
    setUpdating(true);

    try {
      await ipcBridge.conversation.update.invoke({
        id: conversation.id,
        updates: { extra: { ...conversation.extra, enabledSkills: newEnabledSkills } } as any,
      });
      // The agent will refresh on next message if it detects the change
    } catch (error) {
      console.error('Failed to update skills:', error);
      Message.error(t('conversation.skills.update_error', { defaultValue: 'Failed to update skills' }));
    } finally {
      setUpdating(false);
    }
  };

  const filteredSkills = allSkills.filter(
    (skill) =>
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal
      title={t('conversation.skills.manage_title', { defaultValue: 'Manage Session Skills' })}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      className='w-[90vw] md:w-[500px]'
    >
      <div className='flex flex-col gap-16px'>
        <Typography.Text type='secondary' className='text-12px'>
          {t('conversation.skills.manage_desc', {
            defaultValue:
              'Enable or disable specialized skills for this conversation. Changes take effect on your next message.',
          })}
        </Typography.Text>

        <Input
          prefix={<Search />}
          placeholder={t('common.search', { defaultValue: 'Search...' })}
          value={searchQuery}
          onChange={setSearchQuery}
          allowClear
        />

        <Spin loading={loading || updating}>
          <div className='max-h-400px overflow-y-auto'>
            {filteredSkills.length === 0 ? (
              <Empty />
            ) : (
              <List
                dataSource={filteredSkills}
                render={(skill) => (
                  <List.Item key={skill.name} className='px-8px!'>
                    <div className='flex items-center gap-12px w-full'>
                      <Checkbox
                        checked={enabledSkills.includes(skill.name)}
                        onChange={(checked) => handleToggleSkill(skill.name, checked)}
                      />
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center gap-8px'>
                          <Typography.Text bold className='truncate'>
                            {skill.name}
                          </Typography.Text>
                          {skill.source === 'builtin' && (
                            <span className='text-10px px-4px py-1px bg-fill-2 text-t-tertiary rounded'>
                              {t('common.builtin', { defaultValue: 'Built-in' })}
                            </span>
                          )}
                        </div>
                        <Typography.Text
                          type='secondary'
                          className='text-12px block truncate'
                          title={skill.description}
                        >
                          {skill.description}
                        </Typography.Text>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </div>
        </Spin>
      </div>
    </Modal>
  );
};

export default SessionSkillManager;
