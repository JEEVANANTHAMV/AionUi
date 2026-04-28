/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tools Panel - Shows default and custom tools
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Button,
  Badge,
  Switch,
  Tabs,
  Table,
  Tag,
  Message,
  Modal,
  Form,
  Input,
  Select,
  Collapse,
  Tooltip,
  Space,
} from '@arco-design/web-react';
import {
  FolderOpen,
  Code,
  Terminal,
  Gift,
  Link,
  Browser,
  Analysis,
  User,
  Peoples,
  Checklist,
  Tool,
  Plus,
  Edit,
  Delete,
  Play,
  Info,
} from '@icon-park/react';
import { extendedTools } from '@/common/adapter/ipcBridge';
import type { ExtendedToolDefinition, CustomToolConfig, BuiltinToolConfig } from '@/common/types/extendedTools';
import {
  DEFAULT_BUILTIN_TOOLS,
  ExtendedToolCategory,
  ToolSource,
  TOOL_CATEGORY_METADATA,
} from '@/common/types/extendedTools';
import styles from './ToolsPanel.module.css';

const { TabPane } = Tabs;
const { Option } = Select;

const categoryIcons: Record<ExtendedToolCategory, React.ReactNode> = {
  [ExtendedToolCategory.FILE_OPERATIONS]: <FolderOpen theme='outline' size='16' />,
  [ExtendedToolCategory.CODE_OPERATIONS]: <Code theme='outline' size='16' />,
  [ExtendedToolCategory.TERMINAL]: <Terminal theme='outline' size='16' />,
  [ExtendedToolCategory.BROWSER]: <Browser theme='outline' size='16' />,
  [ExtendedToolCategory.GIT]: <Gift theme='outline' size='16' />,
  [ExtendedToolCategory.WEB]: <Link theme='outline' size='16' />,
  [ExtendedToolCategory.ANALYSIS]: <Analysis theme='outline' size='16' />,
  [ExtendedToolCategory.AGENT_MANAGEMENT]: <User theme='outline' size='16' />,
  [ExtendedToolCategory.CUSTOM]: <Tool theme='outline' size='16' />,
  [ExtendedToolCategory.MCP]: <Tool theme='outline' size='16' />,
};

const BuiltinToolsTab: React.FC = () => {
  const { t } = useTranslation();
  const [tools, setTools] = useState<ExtendedToolDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTools = useCallback(async () => {
    try {
      const result = await extendedTools.getAllTools.invoke();
      if (result.success && result.data) {
        const builtinTools = result.data.filter((tool: ExtendedToolDefinition) => tool.source === ToolSource.BUILTIN);
        setTools(builtinTools);
      }
    } catch (error) {
      Message.error(t('tools.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchTools();
  }, [fetchTools]);

  const handleToggle = async (toolId: string, enabled: boolean) => {
    try {
      const result = await extendedTools.toggleTool.invoke({ toolId, enabled });
      if (result.success) {
        Message.success(enabled ? t('tools.enabled') : t('tools.disabled'));
        await fetchTools();
      }
    } catch (error) {
      Message.error(t('tools.toggleFailed'));
    }
  };

  const groupedTools = useMemo(() => {
    const groups: Record<ExtendedToolCategory, ExtendedToolDefinition[]> = {
      [ExtendedToolCategory.FILE_OPERATIONS]: [],
      [ExtendedToolCategory.CODE_OPERATIONS]: [],
      [ExtendedToolCategory.TERMINAL]: [],
      [ExtendedToolCategory.BROWSER]: [],
      [ExtendedToolCategory.GIT]: [],
      [ExtendedToolCategory.WEB]: [],
      [ExtendedToolCategory.ANALYSIS]: [],
      [ExtendedToolCategory.AGENT_MANAGEMENT]: [],
      [ExtendedToolCategory.CUSTOM]: [],
      [ExtendedToolCategory.MCP]: [],
    };

    for (const tool of tools) {
      if (groups[tool.category]) {
        groups[tool.category].push(tool);
      }
    }

    return groups;
  }, [tools]);

  if (loading) {
    return <div className={styles.loading}>{t('common.loading')}</div>;
  }

  return (
    <div className={styles.builtinContainer}>
      {Object.entries(groupedTools)
        .filter(([, tools]) => tools.length > 0)
        .map(([category, categoryTools]) => (
          <Collapse key={category} defaultActiveKey={[category]}>
            <Collapse.Item
              header={
                <div className={styles.categoryHeader}>
                  {categoryIcons[category as ExtendedToolCategory]}
                  <span className={styles.categoryName}>
                    {t(TOOL_CATEGORY_METADATA[category as ExtendedToolCategory]?.labelKey || category)}
                  </span>
                  <Badge count={categoryTools.length} style={{ marginLeft: 8 }} />
                </div>
              }
              name={category}
            >
              <div className={styles.toolsList}>
                {categoryTools.map((tool) => (
                  <Card key={tool.id} className={styles.toolCard} size='small'>
                    <div className={styles.toolRow}>
                      <div className={styles.toolInfo}>
                        <span className={styles.toolName}>{tool.name}</span>
                        <span className={styles.toolDescription}>{tool.descriptionKey}</span>
                      </div>
                      <Switch checked={tool.isEnabled} onChange={(checked) => handleToggle(tool.id, checked)} />
                    </div>
                  </Card>
                ))}
              </div>
            </Collapse.Item>
          </Collapse>
        ))}
    </div>
  );
};

interface CustomToolFormData {
  name: string;
  description: string;
  language: 'javascript' | 'typescript' | 'python';
  code: string;
}

const CustomToolsTab: React.FC = () => {
  const { t } = useTranslation();
  const [tools, setTools] = useState<CustomToolConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTool, setEditingTool] = useState<CustomToolConfig | null>(null);
  const [form] = Form.useForm();

  const fetchTools = useCallback(async () => {
    try {
      const result = await extendedTools.getRegistryState.invoke();
      if (result.success && result.data) {
        setTools(result.data.customTools);
      }
    } catch (error) {
      Message.error(t('tools.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchTools();
  }, [fetchTools]);

  const handleAdd = () => {
    setEditingTool(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (tool: CustomToolConfig) => {
    setEditingTool(tool);
    form.setFieldsValue({
      name: tool.name,
      description: tool.description,
      language: tool.language,
      code: tool.code,
    });
    setModalVisible(true);
  };

  const handleDelete = async (tool: CustomToolConfig) => {
    Modal.confirm({
      title: t('tools.deleteConfirmTitle'),
      content: t('tools.deleteConfirmContent', { name: tool.name }),
      onOk: async () => {
        try {
          const result = await extendedTools.deleteCustomTool.invoke(tool.id);
          if (result.success) {
            Message.success(t('tools.deleteSuccess'));
            await fetchTools();
          }
        } catch (error) {
          Message.error(t('tools.deleteFailed'));
        }
      },
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validate();

      if (editingTool) {
        const result = await extendedTools.updateCustomTool.invoke({
          id: editingTool.id,
          updates: values,
        });
        if (result.success) {
          Message.success(t('tools.updateSuccess'));
        }
      } else {
        const result = await extendedTools.createCustomTool.invoke({
          ...values,
          schema: {}, // Will be auto-generated from code
          enabled: true,
        });
        if (result.success) {
          Message.success(t('tools.createSuccess'));
        }
      }

      setModalVisible(false);
      await fetchTools();
    } catch (error) {
      Message.error(t('tools.saveFailed'));
    }
  };

  const columns = [
    {
      title: t('tools.name'),
      dataIndex: 'name',
    },
    {
      title: t('tools.description'),
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: t('tools.language'),
      dataIndex: 'language',
      render: (lang: string) => <Tag color={lang === 'python' ? 'blue' : 'green'}>{lang}</Tag>,
    },
    {
      title: t('tools.statusLabel'),
      dataIndex: 'enabled',
      render: (enabled: boolean) => (
        <Badge status={enabled ? 'success' : 'default'} text={enabled ? t('tools.enabled') : t('tools.disabled')} />
      ),
    },
    {
      title: t('tools.actionsLabel'),
      render: (_: unknown, record: CustomToolConfig) => (
        <Space>
          <Button type='text' icon={<Edit theme='outline' size='16' />} onClick={() => handleEdit(record)} />
          <Button
            type='text'
            icon={<Delete theme='outline' size='16' />}
            status='danger'
            onClick={() => handleDelete(record)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.customContainer}>
      <div className={styles.customHeader}>
        <Button type='primary' icon={<Plus theme='outline' size='16' />} onClick={handleAdd}>
          {t('tools.addCustomTool')}
        </Button>
      </div>

      <Table columns={columns} data={tools} loading={loading} rowKey='id' pagination={{ pageSize: 10 }} />

      <Modal
        title={editingTool ? t('tools.editTool') : t('tools.addTool')}
        visible={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        style={{ width: 700 }}
      >
        <Form form={form} layout='vertical'>
          <Form.Item label={t('tools.name')} field='name' rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item label={t('tools.description')} field='description' rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item
            label={t('tools.language')}
            field='language'
            rules={[{ required: true }]}
            initialValue='javascript'
          >
            <Select>
              <Option value='javascript'>JavaScript</Option>
              <Option value='typescript'>TypeScript</Option>
              <Option value='python'>Python</Option>
            </Select>
          </Form.Item>

          <Form.Item label={t('tools.code')} field='code' rules={[{ required: true }]}>
            <Input.TextArea rows={10} placeholder={t('tools.codePlaceholder')} style={{ fontFamily: 'monospace' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const ToolsPanel: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('tools.title')}</h2>
        <p className={styles.subtitle}>{t('tools.subtitle')}</p>
      </div>

      <Tabs type='card'>
        <TabPane key='builtin' title={t('tools.builtinTab')}>
          <BuiltinToolsTab />
        </TabPane>
        <TabPane key='custom' title={t('tools.customTab')}>
          <CustomToolsTab />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default ToolsPanel;
