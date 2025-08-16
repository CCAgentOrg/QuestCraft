import type { AIAuditLog } from '../types';

const AUDIT_LOG_STORAGE_KEY = 'questcraft-ai-audit-log';
export const AUDIT_LOG_UPDATED_EVENT = 'auditlogupdated';

const dispatchUpdateEvent = () => {
    window.dispatchEvent(new Event(AUDIT_LOG_UPDATED_EVENT));
};

export const auditLogService = {
    getLogs: (): AIAuditLog[] => {
        try {
            const logsJson = localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
            const logs = logsJson ? JSON.parse(logsJson) : [];
            // Sort by most recent first, which is the natural order after prepending
            return logs;
        } catch (e) {
            console.error("Failed to parse AI audit logs from localStorage", e);
            return [];
        }
    },
    addLog: (log: Omit<AIAuditLog, 'id' | 'timestamp'>): void => {
        try {
            const fullLog: AIAuditLog = {
                id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                timestamp: new Date().toISOString(),
                ...log
            };
            const currentLogs = auditLogService.getLogs();
            // Prepend new log to keep it sorted by most recent
            const newLogs = [fullLog, ...currentLogs];
            localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(newLogs));
            dispatchUpdateEvent();
        } catch (e) {
            console.error("Failed to save AI audit log to localStorage", e);
        }
    },
    clearLogs: (): void => {
        try {
            localStorage.setItem(AUDIT_LOG_STORAGE_KEY, '[]');
            dispatchUpdateEvent();
        } catch (e) {
            console.error("Failed to clear AI audit logs from localStorage", e);
        }
    }
};