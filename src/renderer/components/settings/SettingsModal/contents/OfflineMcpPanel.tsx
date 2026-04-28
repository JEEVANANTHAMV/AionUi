/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Offline MCP Panel - Shows and manages offline MCP servers
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Button,
  Badge,
  Spin,
  Message,
  Switch,
  Tooltip,
  Modal,
  Form,
  Input,
  Table,
  Tag,
  Space,
  Progress,
} from '@arco-design/web-react';
import {
  Play,
  Pause,
  Reload,
  Download,
  Setting,
  Browser,
  FolderOpen,
  Gift,
  Link,
  FolderClose,
  Search,
  Tool,
} from '@icon-park/react';
import { offlineMcp } from '@/common/adapter/ipcBridge';
import type { OfflineMcpServerConfig, McpServerRuntimeState } from '@/common/types/offlineMcp';
import { DEFAULT_OFFLINE_MCP_BUNDLES, McpBundleStatus, OfflineMcpServerType } from '@/common/types/offlineMcp';
import styles from './OfflineMcpPanel.module.css';

const typeIcons: Record<OfflineMcpServerType, React.ReactNode> = {
  [OfflineMcpServerType.BROWSER]: <Browser theme='outline' size='20' />,
  [OfflineMcpServerType.FILESYSTEM]: <FolderOpen theme='outline' size='20' />,
  [OfflineMcpServerType.GIT]: <Gift theme='outline' size='20' />,
  [OfflineMcpServerType.GITHUB]: <Gift theme='outline' size='20' />,
  [OfflineMcpServerType.SQL]: <FolderClose theme='outline' size='20' />,
  [OfflineMcpServerType.FETCH]: <Link theme='outline' size='20' />,
  [OfflineMcpServerType.BRAVE_SEARCH]: <Search theme='outline' size='20' />,
  [OfflineMcpServerType.MEMORY]: <FolderClose theme='outline' size='20' />,
  [OfflineMcpServerType.PUPPETEER]: <Browser theme='outline' size='20' />,
  [OfflineMcpServerType.PLAYWRIGHT]: <Browser theme='outline' size='20' />,
  [OfflineMcpServerType.CUSTOM]: <Tool theme='outline' size='20' />,
};

const statusColors: Record<McpBundleStatus, 'default' | 'error' | 'warning' | 'success' | 'processing'> = {
  [McpBundleStatus.NOT_INSTALLED]: 'default',
  [McpBundleStatus.DOWNLOADING]: 'processing',
  [McpBundleStatus.INSTALLING]: 'warning',
  [McpBundleStatus.READY]: 'success',
  [McpBundleStatus.ERROR]: 'error',
  [McpBundleStatus.RUNNING]: 'success',
  [McpBundleStatus.STOPPED]: 'default',
};

const statusLabels: Record<McpBundleStatus, string> = {
  [McpBundleStatus.NOT_INSTALLED]: 'Not Installed',
  [McpBundleStatus.DOWNLOADING]: 'Downloading',
  [McpBundleStatus.INSTALLING]: 'Installing',
  [McpBundleStatus.READY]: 'Ready',
  [McpBundleStatus.ERROR]: 'Error',
  [McpBundleStatus.RUNNING]: 'Running',
  [McpBundleStatus.STOPPED]: 'Stopped',
};

interface ServerRow {
  config: OfflineMcpServerConfig;
  state: McpServerRuntimeState;
}

const OfflineMcpPanel: React.FC = () => {
  const { t } = useTranslation();
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [configureModalVisible, setConfigureModalVisible] = useState(false);
  const [selectedServer, setSelectedServer] = useState<OfflineMcpServerConfig | null>(null);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      const [configsResult, statesResult] = await Promise.all([
        offlineMcp.getAllConfigs.invoke(),
        offlineMcp.getAllStates.invoke(),
      ]);

      if (configsResult.success && configsResult.data && statesResult.success && statesResult.data) {
        const statesMap: Record<string, McpServerRuntimeState> = {};
        for (const state of statesResult.data) {
          statesMap[state.id] = state;
        }

        const rows: ServerRow[] = configsResult.data.map((config: OfflineMcpServerConfig) => ({
          config,
          state: statesMap[config.id] || {
            id: config.id,
            status: config.installStatus,
            toolsAvailable: [] as string[],
          },
        }));

        setServers(rows);
      }
    } catch (error) {
      console.error('Failed to fetch MCP servers:', error);
      Message.error(t('offlineMcp.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchData();

    // Refresh every 5 seconds
    const interval = setInterval(() => {
      void fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const handleInstall = async (serverId: string) => {
    setActionLoading((prev) => ({ ...prev, [serverId]: true }));
    try {
      const result = await offlineMcp.ensureBundle.invoke(serverId);
      if (result.success) {
        Message.success(t('offlineMcp.installSuccess'));
        await fetchData();
      } else {
        Message.error(result.msg || t('offlineMcp.installFailed'));
      }
    } catch (error) {
      Message.error(t('offlineMcp.installFailed'));
    } finally {
      setActionLoading((prev) => ({ ...prev, [serverId]: false }));
    }
  };

  const handleStart = async (serverId: string) => {
    setActionLoading((prev) => ({ ...prev, [serverId]: true }));
    try {
      const result = await offlineMcp.startServer.invoke(serverId);
      if (result.success) {
        Message.success(t('offlineMcp.startSuccess'));
        await fetchData();
      } else {
        Message.error(result.msg || t('offlineMcp.startFailed'));
      }
    } catch (error) {
      Message.error(t('offlineMcp.startFailed'));
    } finally {
      setActionLoading((prev) => ({ ...prev, [serverId]: false }));
    }
  };

  const handleStop = async (serverId: string) => {
    setActionLoading((prev) => ({ ...prev, [serverId]: true }));
    try {
      const result = await offlineMcp.stopServer.invoke(serverId);
      if (result.success) {
        Message.success(t('offlineMcp.stopSuccess'));
        await fetchData();
      } else {
        Message.error(result.msg || t('offlineMcp.stopFailed'));
      }
    } catch (error) {
      Message.error(t('offlineMcp.stopFailed'));
    } finally {
      setActionLoading((prev) => ({ ...prev, [serverId]: false }));
    }
  };

  const handleRestart = async (serverId: string) => {
    setActionLoading((prev) => ({ ...prev, [serverId]: true }));
    try {
      const result = await offlineMcp.restartServer.invoke(serverId);
      if (result.success) {
        Message.success(t('offlineMcp.restartSuccess'));
        await fetchData();
      } else {
        Message.error(result.msg || t('offlineMcp.restartFailed'));
      }
    } catch (error) {
      Message.error(t('offlineMcp.restartFailed'));
    } finally {
      setActionLoading((prev) => ({ ...prev, [serverId]: false }));
    }
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      const result = await offlineMcp.updateConfig.invoke({
        serverId: id,
        updates: { enabled },
      });
      if (result.success) {
        Message.success(enabled ? t('offlineMcp.enabled') : t('offlineMcp.disabled'));
        await fetchData();
      }
    } catch (error) {
      Message.error(t('offlineMcp.toggleFailed'));
    }
  };

  const handleToggleAutoStart = async (id: string, autoStart: boolean) => {
    try {
      const result = await offlineMcp.updateConfig.invoke({
        serverId: id,
        updates: { autoStart },
      });
      if (result.success) {
        Message.success(autoStart ? t('offlineMcp.autoStartEnabled') : t('offlineMcp.autoStartDisabled'));
        await fetchData();
      }
    } catch (error) {
      Message.error(t('offlineMcp.toggleFailed'));
    }
  };

  const handleConfigure = (config: OfflineMcpServerConfig) => {
    setSelectedServer(config);
    form.setFieldsValue({
      port: config.port,
      env: config.env ? Object.entries(config.env).map(([key, value]) => ({ key, value })) : [],
    });
    setConfigureModalVisible(true);
  };

  const handleSaveConfig = async () => {
    if (!selectedServer) return;

    try {
      const values = await form.validate();

      const env: Record<string, string> = {};
      if (values.env) {
        for (const item of values.env) {
          if (item.key && item.value) {
            env[item.key] = item.value;
          }
        }
      }

      const result = await offlineMcp.updateConfig.invoke({
        serverId: selectedServer.id,
        updates: { port: values.port, env },
      });

      if (result.success) {
        Message.success(t('offlineMcp.saveSuccess'));
        setConfigureModalVisible(false);
        await fetchData();
      }
    } catch (error) {
      Message.error(t('offlineMcp.saveFailed'));
    }
  };

  const columns = [
    {
      title: t('offlineMcp.type'),
      render: (_: unknown, record: ServerRow) => (
        <div className={styles.typeCell}>
          {typeIcons[record.config.type]}
          <span>{record.config.name}</span>
        </div>
      ),
    },
    {
      title: t('offlineMcp.description'),
      dataIndex: 'config.description',
      render: (desc: string) => <span className={styles.description}>{desc}</span>,
    },
    {
      title: t('offlineMcp.status'),
      render: (_: unknown, record: ServerRow) => (
        <Badge
          status={statusColors[record.state.status]}
          text={t(`offlineMcp.status.${record.state.status}`, { defaultValue: statusLabels[record.state.status] })}
        />
      ),
    },
    {
      title: t('offlineMcp.port'),
      render: (_: unknown, record: ServerRow) => <Tag>{record.config.port || record.state.port || '-'}</Tag>,
    },
    {
      title: t('offlineMcp.enabled'),
      render: (_: unknown, record: ServerRow) => (
        <Switch
          checked={record.config.enabled}
          onChange={(checked) => handleToggleEnabled(record.config.id, checked)}
        />
      ),
    },
    {
      title: t('offlineMcp.autoStart'),
      render: (_: unknown, record: ServerRow) => (
        <Switch
          checked={record.config.autoStart}
          onChange={(checked) => handleToggleAutoStart(record.config.id, checked)}
        />
      ),
    },
    {
      title: t('offlineMcp.actions'),
      render: (_: unknown, record: ServerRow) => {
        const isLoading = actionLoading[record.config.id];
        const canInstall =
          record.state.status === McpBundleStatus.NOT_INSTALLED || record.state.status === McpBundleStatus.ERROR;
        const canStart =
          record.state.status === McpBundleStatus.READY || record.state.status === McpBundleStatus.STOPPED;
        const canStop = record.state.status === McpBundleStatus.RUNNING;

        return (
          <Space>
            {canInstall && (
              <Tooltip content={t('offlineMcp.install')}>
                <Button
                  type='primary'
                  icon={<Download theme='outline' size='16' />}
                  onClick={() => handleInstall(record.config.id)}
                  loading={isLoading}
                />
              </Tooltip>
            )}
            {canStart && (
              <Tooltip content={t('offlineMcp.start')}>
                <Button
                  type='primary'
                  icon={<Play theme='outline' size='16' />}
                  onClick={() => handleStart(record.config.id)}
                  loading={isLoading}
                />
              </Tooltip>
            )}
            {canStop && (
              <Tooltip content={t('offlineMcp.stop')}>
                <Button
                  type='primary'
                  status='danger'
                  icon={<Pause theme='outline' size='16' />}
                  onClick={() => handleStop(record.config.id)}
                  loading={isLoading}
                />
              </Tooltip>
            )}
            {canStop && (
              <Tooltip content={t('offlineMcp.restart')}>
                <Button
                  type='secondary'
                  icon={<Reload theme='outline' size='16' />}
                  onClick={() => handleRestart(record.config.id)}
                  loading={isLoading}
                />
              </Tooltip>
            )}
            <Tooltip content={t('offlineMcp.configure')}>
              <Button
                type='text'
                icon={<Setting theme='outline' size='16' />}
                onClick={() => handleConfigure(record.config)}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spin size={40} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('offlineMcp.title')}</h2>
        <p className={styles.subtitle}>{t('offlineMcp.subtitle')}</p>
      </div>

      <Card>
        <Table columns={columns} data={servers} rowKey={(record) => record.config.id} pagination={false} />
      </Card>

      <div className={styles.info}>
        <h3>{t('offlineMcp.aboutTitle')}</h3>
        <p>{t('offlineMcp.aboutDescription')}</p>
        <ul>
          <li>{t('offlineMcp.aboutPoint1')}</li>
          <li>{t('offlineMcp.aboutPoint2')}</li>
          <li>{t('offlineMcp.aboutPoint3')}</li>
        </ul>
      </div>

      <Modal
        title={t('offlineMcp.configureTitle', { name: selectedServer?.name })}
        visible={configureModalVisible}
        onOk={handleSaveConfig}
        onCancel={() => setConfigureModalVisible(false)}
      >
        <Form form={form} layout='vertical'>
          <Form.Item label={t('offlineMcp.port')} field='port' rules={[{ required: true }]}>
            <Input type='number' />
          </Form.Item>

          <Form.List field='env'>
            {(fields, { add, remove }) => (
              <div>
                {fields.map((field, index) => (
                  <div key={field.key} className={styles.envRow}>
                    <Form.Item
                      field={`env[${index}].key`}
                      label={index === 0 ? t('offlineMcp.envKey') : ''}
                      style={{ flex: 1 }}
                    >
                      <Input placeholder='KEY' />
                    </Form.Item>
                    <Form.Item
                      field={`env[${index}].value`}
                      label={index === 0 ? t('offlineMcp.envValue') : ''}
                      style={{ flex: 1 }}
                    >
                      <Input placeholder='value' />
                    </Form.Item>
                    <Button type='text' status='danger' onClick={() => remove(index)}>
                      {t('common.delete')}
                    </Button>
                  </div>
                ))}
                <Button type='text' onClick={() => add()}>
                  {t('offlineMcp.addEnv')}
                </Button>
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
};

export default OfflineMcpPanel;
