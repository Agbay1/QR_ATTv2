// Web-safe Alert. Native: the normal React Native Alert. Web: window.alert / window.confirm
// (react-native-web's Alert does nothing, so buttons like "Delete" never ran in the browser).
import { Alert as RNAlert, Platform } from 'react-native';

export const Alert = {
  alert(title, message, buttons) {
    if (Platform.OS !== 'web') return RNAlert.alert(title, message, buttons);
    const text = [title, message].filter(Boolean).join('\n\n'), btns = buttons || [];
    if (btns.length < 2) { window.alert(text); btns[0]?.onPress?.(); return; }
    const cancel = btns.find((b) => b.style === 'cancel') || btns[0];
    const act = [...btns].reverse().find((b) => b !== cancel) || btns[btns.length - 1];
    (window.confirm(text) ? act : cancel).onPress?.();
  },
};
export default Alert;
