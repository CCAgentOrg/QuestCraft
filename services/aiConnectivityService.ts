
const CONNECTIVITY_STATUS_KEY = 'questcraft-ai-connectivity-status';
export const CONNECTIVITY_UPDATED_EVENT = 'connectivityupdated';

const dispatchUpdateEvent = () => {
    window.dispatchEvent(new Event(CONNECTIVITY_UPDATED_EVENT));
};

export const aiConnectivityService = {
    setConnected: (status: boolean): void => {
        try {
            localStorage.setItem(CONNECTIVITY_STATUS_KEY, JSON.stringify(status));
            dispatchUpdateEvent();
        } catch (e) {
            console.error("Failed to save connectivity status", e);
        }
    },
    isConnected: (): boolean => {
        try {
            const statusJson = localStorage.getItem(CONNECTIVITY_STATUS_KEY);
            return statusJson ? JSON.parse(statusJson) : false;
        } catch {
            return false;
        }
    }
};
