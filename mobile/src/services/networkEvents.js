import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
// Native connection events only. No synthetic reachability HTTP polling.
NetInfo.configure({
  reachabilityShouldRun: () => false
});
export function subscribeSyncEvents(onRecovery, onForeground, onBackground) {
  let previous = null,
    connected = null,
    foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const unsubscribe = NetInfo.addEventListener(state => {
    const signature = `${state.isConnected}:${state.type}`;
    connected = state.isConnected;
    if (state.isConnected === false) onBackground('offline');else if (state.isConnected === true && signature !== previous && foreground) onRecovery();
    previous = signature;
  });
  const lifecycle = AppState.addEventListener('change', state => {
    foreground = state === 'active';
    if (foreground) {
      NetInfo.refresh().catch(() => {});
      if (connected !== false) onForeground();
    } else onBackground('background');
  });
  return () => {
    unsubscribe();
    lifecycle.remove();
  };
}
