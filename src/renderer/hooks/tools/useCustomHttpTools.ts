import { useState, useEffect, useCallback } from 'react';
import { ConfigStorage } from '@/common/config/storage';
import type { ICustomHttpTool } from '@/common/config/storage';
import { uuid } from '@/common/utils';

/**
 * Custom HTTP Tools management hook
 * 管理用户自定义的 HTTP 工具列表
 */
export const useCustomHttpTools = () => {
  const [tools, setTools] = useState<ICustomHttpTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load custom tools
  useEffect(() => {
    void ConfigStorage.get('custom.http.tools')
      .then((data) => {
        if (data) {
          setTools(data);
        }
      })
      .catch((error) => {
        console.error('[useCustomHttpTools] Failed to load custom tools:', error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Save custom tools
  const saveTools = useCallback((toolsOrUpdater: ICustomHttpTool[] | ((prev: ICustomHttpTool[]) => ICustomHttpTool[])) => {
    return new Promise<void>((resolve, reject) => {
      setTools((prev) => {
        const newTools = typeof toolsOrUpdater === 'function' ? toolsOrUpdater(prev) : toolsOrUpdater;
        
        queueMicrotask(() => {
          ConfigStorage.set('custom.http.tools', newTools)
            .then(() => resolve())
            .catch((error) => {
              console.error('Failed to save custom tools:', error);
              reject(error);
            });
        });

        return newTools;
      });
    });
  }, []);

  const addTool = useCallback((toolData: Omit<ICustomHttpTool, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    const newTool: ICustomHttpTool = {
      ...toolData,
      id: uuid(),
      createdAt: now,
      updatedAt: now,
    };
    return saveTools((prev) => [...prev, newTool]).then(() => newTool);
  }, [saveTools]);

  const updateTool = useCallback((id: string, toolData: Partial<ICustomHttpTool>) => {
    return saveTools((prev) => 
      prev.map((t) => (t.id === id ? { ...t, ...toolData, updatedAt: Date.now() } : t))
    );
  }, [saveTools]);

  const deleteTool = useCallback((id: string) => {
    return saveTools((prev) => prev.filter((t) => t.id !== id));
  }, [saveTools]);

  const toggleTool = useCallback((id: string, enabled: boolean) => {
    return updateTool(id, { enabled });
  }, [updateTool]);

  return {
    tools,
    isLoading,
    addTool,
    updateTool,
    deleteTool,
    toggleTool,
    saveTools,
  };
};
