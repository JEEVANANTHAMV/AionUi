import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, Switch } from '@arco-design/web-react';
import type { IMcpServer } from '@/common/config/storage';

interface McpServerToolsListProps {
  server: IMcpServer;
  onToggleTool?: (serverId: string, toolName: string, enabled: boolean) => void;
}

const McpServerToolsList: React.FC<McpServerToolsListProps> = ({ server, onToggleTool }) => {
  const { t } = useTranslation();

  if (!server.tools || server.tools.length === 0) {
    return null;
  }

  return (
    <div className='space-y-3'>
      <div>
        <div className='space-y-2'>
          {server.tools.map((tool, index) => (
            <div key={index} className='border border-3 rounded p-3 bg-fill-1'>
              <div className='flex items-center justify-between gap-4'>
                <div className='flex-shrink-0 min-w-0 w-1/3'>
                  <div className='font-medium text-sm text-blue-600 break-words'>{tool.name}</div>
                </div>
                <div className='flex-1 min-w-0'>
                  <Tooltip content={tool.description || t('settings.mcpNoDescription')}>
                    <div className='text-xs text-t-secondary line-clamp-1 cursor-pointer'>
                      {tool.description || t('settings.mcpNoDescription')}
                    </div>
                  </Tooltip>
                </div>
                <div className='flex-shrink-0'>
                  <Switch
                    size='small'
                    checked={tool.enabled !== false} // 默认开启
                    onChange={(checked) => onToggleTool?.(server.id, tool.name, checked)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default McpServerToolsList;
