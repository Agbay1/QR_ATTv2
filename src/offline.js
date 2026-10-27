import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const K = 'qratt-offline-queue', isNet = (m) => /network|fetch/i.test(m || '');
const read = async () => { try { return JSON.parse(await AsyncStorage.getItem(K)) || []; } catch (e) { return []; } };
export async function queueScan(token, at) { const q = await read(); q.push({ token, at }); await AsyncStorage.setItem(K, JSON.stringify(q)); }
export async function syncQueue() {                    // EVENT: connection returns -> queued scans are sent
  const q = await read(), keep = [], done = [];
  for (const it of q) {
    const { data, error } = await supabase.rpc('record_attendance', { p_token: it.token, p_scanned_at: it.at });
    if (error && isNet(error.message)) { keep.push(it); continue; }
    done.push(error ? { ok: false, msg: error.message.includes('DUPLICATE') ? 'Already recorded.' : error.message } : { ok: true, ...data });
  }
  if (q.length) await AsyncStorage.setItem(K, JSON.stringify(keep));
  return { left: keep.length, done };
}
