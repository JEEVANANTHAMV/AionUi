import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Message, Space } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import type { ICustomHttpTool } from '@/common/config/storage';
import { Play, Save, Close } from '@icon-park/react';

interface AddHttpToolModalProps {
  visible: boolean;
  tool?: ICustomHttpTool;
  onCancel: () => void;
  onSubmit: (data: Omit<ICustomHttpTool, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

const AddHttpToolModal: React.FC<AddHttpToolModalProps> = ({ visible, tool, onCancel, onSubmit }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (visible) {
      if (tool) {
        form.setFieldsValue(tool);
      } else {
        form.resetFields();
        form.setFieldsValue({
          method: 'GET',
          enabled: true,
          inputSchema: JSON.stringify(
            {
              type: 'object',
              properties: {
                param1: { type: 'string', description: 'Sample parameter' },
              },
              required: ['param1'],
            },
            null,
            2
          ),
          sampleArgs: JSON.stringify(
            {
              param1: 'hello world',
            },
            null,
            2
          ),
        });
      }
    }
  }, [visible, tool, form]);

  const handleTest = async () => {
    try {
      const values = await form.validate();
      setIsTesting(true);

      const { url, method, sampleArgs, headers } = values;
      let body: any = null;
      let finalUrl = url;

      if (method === 'GET' || method === 'DELETE') {
        const params = JSON.parse(sampleArgs || '{}');
        const query = new URLSearchParams(params).toString();
        if (query) finalUrl += (finalUrl.includes('?') ? '&' : '?') + query;
      } else {
        body = sampleArgs;
      }

      const response = await fetch(finalUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...JSON.parse(headers || '{}'),
        },
        body,
      });

      const result = await response.text();
      if (response.ok) {
        Message.success(t('settings.customToolTestSuccess') || 'Test successful!');
        console.log('Test Response:', result);
        Modal.success({
          title: t('settings.customToolTestResult') || 'Test Result',
          content: <pre className='max-h-60 overflow-auto bg-gray-100 p-2 rounded text-xs'>{result}</pre>,
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${result}`);
      }
    } catch (error: any) {
      Message.error(`${t('settings.customToolTestFailed') || 'Test failed'}: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Modal
      title={
        tool ? t('settings.editCustomTool') || 'Edit Custom Tool' : t('settings.addCustomTool') || 'Add Custom Tool'
      }
      visible={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
      autoFocus={false}
      focusLock={true}
      className='w-full max-w-2xl'
    >
      <Form
        form={form}
        layout='vertical'
        onSubmit={(values) => {
          onSubmit({
            ...values,
            enabled: tool ? tool.enabled : true,
          });
        }}
      >
        <Form.Item label={t('settings.customToolName') || 'Name'} field='name' rules={[{ required: true }]}>
          <Input placeholder='e.g. get_weather' />
        </Form.Item>
        <Form.Item
          label={t('settings.customToolDescription') || 'Description'}
          field='description'
          rules={[{ required: true }]}
        >
          <Input.TextArea placeholder='Describe what this tool does for the AI' />
        </Form.Item>
        <div className='flex gap-4'>
          <Form.Item
            label={t('settings.customToolMethod') || 'Method'}
            field='method'
            className='w-32'
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value='GET'>GET</Select.Option>
              <Select.Option value='POST'>POST</Select.Option>
              <Select.Option value='PUT'>PUT</Select.Option>
              <Select.Option value='PATCH'>PATCH</Select.Option>
              <Select.Option value='DELETE'>DELETE</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label={t('settings.customToolUrl') || 'URL'}
            field='url'
            className='flex-1'
            rules={[{ required: true, type: 'url' }]}
          >
            <Input placeholder='https://api.example.com/data' />
          </Form.Item>
        </div>
        <Form.Item label={t('settings.customToolHeaders') || 'Headers (JSON)'} field='headers'>
          <Input.TextArea placeholder='{"Authorization": "Bearer token"}' autoSize={{ minRows: 2 }} />
        </Form.Item>
        <Form.Item
          label={t('settings.customToolInputSchema') || 'Input Schema (JSON Schema)'}
          field='inputSchema'
          rules={[{ required: true }]}
        >
          <Input.TextArea autoSize={{ minRows: 4 }} placeholder='JSON Schema defining the arguments' />
        </Form.Item>
        <Form.Item label={t('settings.customToolSampleArgs') || 'Sample Arguments (JSON)'} field='sampleArgs'>
          <Input.TextArea autoSize={{ minRows: 3 }} placeholder='Arguments to use for testing' />
        </Form.Item>

        <div className='flex justify-end mt-4'>
          <Button type='outline' icon={<Play />} loading={isTesting} onClick={handleTest}>
            {t('settings.customToolTest') || 'Test Tool'}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default AddHttpToolModal;
