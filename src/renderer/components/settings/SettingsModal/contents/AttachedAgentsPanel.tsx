/**
 * @license
 * Copyright 2025 Forjinn-Desk (forjinn-desk.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Attached Agents Panel - Shows attached agents (OpenCode, Windows-MCP, Browser-Control)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Badge, Spin, Message, Switch, Tooltip, Modal, Form, Input } from '@arco-design/web-react';
import { Code, Windows, Browser, Play, Pause, Setting, Reload } from '@icon-park/react';
import { attachedAgents } from '@/common/adapter/ipcBridge';
import type { AttachedAgentConfig, AttachedAgentState } from '@/common/types/attachedAgents';
import { ATTACHED_AGENT_METADATA, AttachedAgentStatus, AttachedAgentType } from '@/common/types/attachedAgents';
import styles from './AttachedAgentsPanel.module.css';

interface AgentCardProps {
  config: AttachedAgentConfig;
  state: AttachedAgentState;
  onStart: (agentId: string) => Promise<void>;
  onStop: (agentId: string) => Promise<void>;
  onConfigure: (agentId: string) => void;
}

const statusColors: Record<AttachedAgentStatus, 'default' | 'error' | 'warning' | 'success' | 'processing'> = {
  [AttachedAgentStatus.IDLE]: 'default',
  [AttachedAgentStatus.STARTING]: 'processing',
  [AttachedAgentStatus.RUNNING]: 'success',
  [AttachedAgentStatus.BUSY]: 'warning',
  [AttachedAgentStatus.ERROR]: 'error',
  [AttachedAgentStatus.STOPPED]: 'default',
};

const AgentCard: React.FC<AgentCardProps> = ({ config, state, onStart, onStop, onConfigure }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      await onStart(config.id);
      Message.success(t('attachedAgents.startSuccess', { name: config.name }));
    } catch (error) {
      Message.error(t('attachedAgents.startFailed', { name: config.name }));
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await onStop(config.id);
      Message.success(t('attachedAgents.stopSuccess', { name: config.name }));
    } catch (error) {
      Message.error(t('attachedAgents.stopFailed', { name: config.name }));
    } finally {
      setLoading(false);
    }
  };

  const getIcon = () => {
    switch (config.type) {
      case AttachedAgentType.OPENCODE:
        return <Code theme='outline' size='24' />;
      case AttachedAgentType.WINDOWS_MCP:
        return <Windows theme='outline' size='24' />;
      case AttachedAgentType.BROWSER_CONTROL:
        return <Browser theme='outline' size='24' />;
      default:
        return <Code theme='outline' size='24' />;
    }
  };

  const isRunning = state.status === AttachedAgentStatus.RUNNING || state.status === AttachedAgentStatus.BUSY;

  return (
    <Card className={styles.agentCard} bordered={false}>
      <div className={styles.cardHeader}>
        <div className={`${styles.cardIconWrapper} ${styles[config.type]}`}>{getIcon()}</div>
        <div className={styles.cardTitleSection}>
          <div className={styles.agentNameRow}>
            <span className={styles.agentName}>{config.name}</span>
            <Badge
              status={statusColors[state.status]}
              text={t(`attachedAgents.status.${state.status}`)}
              className={isRunning ? styles.pulseBadge : ''}
            />
          </div>
          <p className={styles.description}>{config.description}</p>
        </div>
      </div>

      {state.error && <div className={styles.errorMessage}>{state.error}</div>}

      {state.status === AttachedAgentStatus.RUNNING && (
        <div className={styles.statusInfo}>
          <div className={styles.statusInfoItem}>
            <span className={styles.infoLabel}>{t('attachedAgents.startedAt')}:</span>
            <span className={styles.infoValue}>
              {state.startedAt ? new Date(state.startedAt).toLocaleString() : '-'}
            </span>
          </div>
          <div className={styles.statusInfoItem}>
            <span className={styles.infoLabel}>{t('attachedAgents.taskCount')}:</span>
            <span className={styles.infoValue}>{state.taskCount}</span>
          </div>
          {state.lastTask && (
            <div className={styles.statusInfoItem}>
              <span className={styles.infoLabel}>{t('attachedAgents.lastTask')}:</span>
              <span className={styles.infoValue}>{state.lastTask}</span>
            </div>
          )}
        </div>
      )}

      <div className={styles.cardFooter}>
        <Button
          type='secondary'
          icon={<Setting theme='outline' size='16' />}
          onClick={() => onConfigure(config.id)}
          className={styles.configBtn}
        >
          {t('attachedAgents.configure')}
        </Button>
        {isRunning ? (
          <Button
            type='primary'
            status='danger'
            icon={<Pause theme='outline' size='16' />}
            onClick={handleStop}
            loading={loading}
            className={styles.actionBtn}
          >
            {t('attachedAgents.stop')}
          </Button>
        ) : (
          <Button
            type='primary'
            icon={<Play theme='outline' size='16' />}
            onClick={handleStart}
            loading={loading}
            disabled={state.status === AttachedAgentStatus.STARTING}
            className={styles.actionBtn}
          >
            {t('attachedAgents.start')}
          </Button>
        )}
      </div>
    </Card>
  );
};

interface ConfigureModalProps {
  visible: boolean;
  config?: AttachedAgentConfig;
  onCancel: () => void;
  onSave: (config: AttachedAgentConfig) => Promise<void>;
}

const ConfigureModal: React.FC<ConfigureModalProps> = ({ visible, config, onCancel, onSave }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && config) {
      form.setFieldsValue({
        name: config.name,
        enabled: config.enabled,
        autoStart: config.autoStart,
        endpoint: config.endpoint,
        port: config.port,
        ...config.options,
      });
    }
  }, [visible, config, form]);

  const handleSave = async () => {
    if (!config) return;

    try {
      const values = await form.validate();
      setLoading(true);

      const updated: AttachedAgentConfig = {
        ...config,
        name: values.name,
        enabled: values.enabled,
        autoStart: values.autoStart,
        endpoint: values.endpoint,
        port: values.port,
        options: {
          ...config.options,
          ...values,
        },
      };

      await onSave(updated);
      Message.success(t('attachedAgents.saveSuccess'));
      onCancel();
    } catch (error) {
      Message.error(t('attachedAgents.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (!config) return null;

  return (
    <Modal
      title={t('attachedAgents.configureTitle', { name: config.name })}
      visible={visible}
      onCancel={onCancel}
      onOk={handleSave}
      confirmLoading={loading}
    >
      <Form form={form} layout='vertical'>
        <Form.Item label={t('attachedAgents.name')} field='name' rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        <Form.Item label={t('attachedAgents.endpoint')} field='endpoint'>
          <Input placeholder='http://localhost:8080' />
        </Form.Item>

        <Form.Item label={t('attachedAgents.port')} field='port'>
          <Input type='number' placeholder='8080' />
        </Form.Item>

        <Form.Item label={t('attachedAgents.enabled')} field='enabled' triggerPropName='checked'>
          <Switch />
        </Form.Item>

        <Form.Item label={t('attachedAgents.autoStart')} field='autoStart' triggerPropName='checked'>
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

const AttachedAgentsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<AttachedAgentConfig[]>([]);
  const [states, setStates] = useState<Record<string, AttachedAgentState>>({});
  const [loading, setLoading] = useState(true);
  const [configureModalVisible, setConfigureModalVisible] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [configsResult, statesResult] = await Promise.all([
        attachedAgents.getAllConfigs.invoke(),
        attachedAgents.getAllStates.invoke(),
      ]);

      if (configsResult.success && configsResult.data) {
        setConfigs(configsResult.data);
      }

      if (statesResult.success && statesResult.data) {
        const statesMap: Record<string, AttachedAgentState> = {};
        for (const state of statesResult.data) {
          statesMap[state.id] = state;
        }
        setStates(statesMap);
      }
    } catch (error) {
      console.error('Failed to fetch attached agents:', error);
      Message.error(t('attachedAgents.fetchFailed'));
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

  const handleStartAgent = async (agentId: string) => {
    const result = await attachedAgents.startAgent.invoke(agentId);
    if (!result.success) {
      throw new Error(result.msg);
    }
    await fetchData();
  };

  const handleStopAgent = async (agentId: string) => {
    const result = await attachedAgents.stopAgent.invoke(agentId);
    if (!result.success) {
      throw new Error(result.msg);
    }
    await fetchData();
  };

  const handleConfigure = (agentId: string) => {
    setSelectedAgentId(agentId);
    setConfigureModalVisible(true);
  };

  const handleSaveConfig = async (config: AttachedAgentConfig) => {
    const result = await attachedAgents.updateConfig.invoke({
      agentId: config.id,
      updates: config,
    });
    if (!result.success) {
      throw new Error(result.msg);
    }
    await fetchData();
  };

  const selectedConfig = selectedAgentId ? configs.find((c) => c.id === selectedAgentId) : undefined;

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
        <h2 className={styles.title}>{t('attachedAgents.title')}</h2>
        <p className={styles.subtitle}>{t('attachedAgents.subtitle')}</p>
      </div>

      <div className={styles.agentsGrid}>
        {configs.map((config) => (
          <AgentCard
            key={config.id}
            config={config}
            state={
              states[config.id] || {
                id: config.id,
                type: config.type,
                status: AttachedAgentStatus.IDLE,
                taskCount: 0,
              }
            }
            onStart={handleStartAgent}
            onStop={handleStopAgent}
            onConfigure={handleConfigure}
          />
        ))}
      </div>

      <ConfigureModal
        visible={configureModalVisible}
        config={selectedConfig}
        onCancel={() => {
          setConfigureModalVisible(false);
          setSelectedAgentId(null);
        }}
        onSave={handleSaveConfig}
      />
    </div>
  );
};

export default AttachedAgentsPanel;
