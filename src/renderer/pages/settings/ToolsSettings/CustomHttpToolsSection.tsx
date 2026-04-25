import React, { useState, useCallback } from 'react';
import { Button, Table, Switch, Space, Popconfirm, Message, Tooltip } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Delete, Api } from '@icon-park/react';
import { useCustomHttpTools } from '@/renderer/hooks/tools/useCustomHttpTools';
import AddHttpToolModal from '../components/AddHttpToolModal';
import type { ICustomHttpTool } from '@/common/config/storage';

const CustomHttpToolsSection: React.FC = () => {
  const { t } = useTranslation();
  const { tools, addTool, updateTool, deleteTool, toggleTool } = useCustomHttpTools();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTool, setEditingTool] = useState<ICustomHttpTool | undefined>();

  const handleAdd = useCallback(() => {
    setEditingTool(undefined);
    setIsModalVisible(true);
  }, []);

  const handleEdit = useCallback((tool: ICustomHttpTool) => {
    setEditingTool(tool);
    setIsModalVisible(true);
  }, []);

  const handleSubmit = useCallback(async (data: Omit<ICustomHttpTool, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingTool) {
        await updateTool(editingTool.id, data);
        Message.success(t('settings.customToolUpdateSuccess') || 'Tool updated successfully');
      } else {
        await addTool(data);
        Message.success(t('settings.customToolAddSuccess') || 'Tool added successfully');
      }
      setIsModalVisible(false);
    } catch (error) {
      Message.error(t('settings.customToolSaveFailed') || 'Failed to save tool');
    }
  }, [editingTool, addTool, updateTool, t]);

  const columns = [
    {
      title: t('settings.customToolName') || 'Name',
      dataIndex: 'name',
      render: (name: string, record: ICustomHttpTool) => (
        <Space size={4}>
          <Api size={14} className="text-blue-600" />
          <span className="font-medium text-sm">{name}</span>
        </Space>
      )
    },
    {
      title: t('settings.customToolDescription') || 'Description',
      dataIndex: 'description',
      render: (desc: string) => (
        <Tooltip content={desc}>
          <div className="text-xs text-t-secondary line-clamp-1 max-w-[200px]">{desc}</div>
        </Tooltip>
      )
    },
    {
      title: t('settings.customToolEndpoint') || 'Endpoint',
      render: (_: any, record: ICustomHttpTool) => (
        <div className="text-xs font-mono">
          <span className="bg-fill-3 px-1 rounded mr-1 text-[10px]">{record.method}</span>
          <span className="text-t-tertiary">{record.url}</span>
        </div>
      )
    },
    {
      title: t('common.enabled') || 'Enabled',
      dataIndex: 'enabled',
      width: 80,
      render: (enabled: boolean, record: ICustomHttpTool) => (
        <Switch
          size="small"
          checked={enabled}
          onChange={(checked) => toggleTool(record.id, checked)}
        />
      )
    },
    {
      title: t('common.operations') || 'Operations',
      width: 100,
      render: (_: any, record: ICustomHttpTool) => (
        <Space>
          <Button
            type="text"
            size="mini"
            icon={<Edit />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title={t('settings.customToolDeleteConfirm') || 'Are you sure you want to delete this tool?'}
            onOk={() => deleteTool(record.id)}
          >
            <Button
              type="text"
              size="mini"
              status="danger"
              icon={<Delete />}
            />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-16px">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-4px">
          <span className="text-14px text-t-primary">{t('settings.customHttpTools') || 'Custom HTTP Tools'}</span>
          <span className="text-12px text-t-secondary">
            {t('settings.customHttpToolsDesc') || 'Define custom HTTP endpoints that the AI can call as tools.'}
          </span>
        </div>
        <Button type="outline" icon={<Plus />} shape="round" onClick={handleAdd}>
          {t('settings.addTool') || 'Add Tool'}
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        data={tools}
        pagination={false}
        className="border border-border-2 rounded-lg overflow-hidden"
        noDataElement={
          <div className="py-24px text-center text-t-tertiary text-13px">
            {t('settings.noCustomTools') || 'No custom tools defined yet.'}
          </div>
        }
      />

      <AddHttpToolModal
        visible={isModalVisible}
        tool={editingTool}
        onCancel={() => setIsModalVisible(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default CustomHttpToolsSection;
