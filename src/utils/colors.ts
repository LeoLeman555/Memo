import { GlobalSystemState } from '../domain/systemStatus';
import { EspState } from '../domain/espStatus';
import { BleConnectionState } from '../domain/systemStatus';
import { ReminderStatus, SyncStatus } from '../domain/reminder';

export function getColors(scheme: string | null) {
  const isDark = scheme === 'dark';

  return {
    background: isDark ? '#000000' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1A1A',
    inputBorder: isDark ? '#555555' : '#E0E0E0',
    buttonBg: '#C62828',
    buttonText: '#FFFFFF',
    mock: '#9E9E9E',
    accent: '#C62828',
    warning: '#FFD600',
    error: '#D50000',
  };
}

export const getStateColor = (
  state: GlobalSystemState,
): string => {
  switch (state) {
    case 'ready':
      return '#00C853';

    case 'busy':
      return '#FFD600';

    case 'booting':
      return '#2979FF'; 
    case 'degraded':
      return '#FF6D00';

    case 'error':
      return '#D50000';

    case 'offline':
    default:
      return '#616161';
  }
};

export const getBleColor = (
  bleState: BleConnectionState,
): string => {
  switch (bleState) {
    case 'connected':
      return '#00C853';

    case 'connecting':
    case 'reconnecting':
      return '#FFD600';

    case 'disconnected':
    default:
      return '#D50000';
  }
};

export const getEspColor = (
  espState: EspState | null,
): string => {
  if (!espState) return '#616161';

  switch (espState) {
    case 'ready':
      return '#00C853';

    case 'receiving':
    case 'processing':
    case 'verifying':
      return '#FFD600';

    case 'error':
      return '#D50000';

    case 'booting':
    case 'idle':
    default:
      return '#616161';
  }
};

export const getReminderColor = (
  status: ReminderStatus,
  syncStatus: SyncStatus,
): string => {

  if (status !== 'VALID') {
    return '#616161';
  }

  switch (syncStatus) {

    case 'SYNCED':
      return '#00C853';

    case 'NOT_SENT':
      return '#FF6D00';

    case 'SENDING':
      return '#FFD600';

    case 'ERROR':
      return '#D50000';

    default:
      return '#616161';
  }
};