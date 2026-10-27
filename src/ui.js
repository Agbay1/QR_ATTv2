import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, StyleSheet, ScrollView, Modal, StatusBar, KeyboardAvoidingView, Platform, Share } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, FadeOutUp, ZoomIn, SlideInDown, LinearTransition, useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, withSequence, withDelay, interpolateColor, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from './supabase';
import { C, G, TOP, MSG, fmt, hap, pop, S, DEPTS, LITE } from './theme';
import { notify, scheduleReminder, initNotify } from './notify';
import { queueScan, syncQueue } from './offline';

/* ---------- animated building blocks ---------- */
export const AP = Animated.createAnimatedComponent(Pressable);
export function Press({ children, onPress, style, disabled }) {
  const s = useSharedValue(1), a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <AP disabled={disabled} onPressIn={() => { s.value = LITE ? withTiming(0.97, { duration: 200 }) : withTiming(0.94, { duration: 80 }); }} onPressOut={() => { s.value = LITE ? withTiming(1, { duration: 200 }) : withSpring(1, { damping: 9, stiffness: 260 }); }}
    onPress={() => { Haptics.selectionAsync(); onPress && onPress(); }} style={[a, style]}>{children}</AP>;
}
export function useShake() {
  const x = useSharedValue(0), st = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return [st, () => { x.value = withSequence(withTiming(-10, { duration: 50 }), withRepeat(withTiming(10, { duration: 90 }), 5, true), withTiming(0, { duration: 50 })); }];
}
export function Float({ children, style }) {
  const y = useSharedValue(0); useEffect(() => { y.value = withRepeat(withTiming(-10, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true); }, []);
  return <Animated.View style={[useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] })), style]}>{children}</Animated.View>;
}
export function Ring({ size = 120, color = '#fff', delay = 0 }) {
  const t = useSharedValue(0); useEffect(() => { t.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false); }, []);
  const a = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - t.value), transform: [{ scale: 1 + t.value * 0.9 }] }));
  if (LITE) return null;
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: color }, a]} />;
}
export function Live() {
  const o = useSharedValue(1); useEffect(() => { o.value = withRepeat(withTiming(0.2, { duration: 700 }), -1, true); }, []);
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.ok, marginRight: 5 }, useAnimatedStyle(() => ({ opacity: o.value }))]} />;
}
export function Count({ to, style, suffix = '' }) {
  const [n, setN] = useState(0);
  useEffect(() => { const t0 = Date.now(), id = setInterval(() => { const p = Math.min(1, (Date.now() - t0) / 900); setN(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p >= 1) clearInterval(id); }, 30); return () => clearInterval(id); }, [to]);
  return <Text style={style}>{n}{suffix}</Text>;
}
export const Skel = () => {
  const o = useSharedValue(0.35); useEffect(() => { o.value = withRepeat(withTiming(0.9, { duration: 800 }), -1, true); }, []);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <View style={{ padding: 16 }}>{[0, 1, 2, 3].map((i) => <Animated.View key={i} style={[S.skel, a]} />)}</View>;
};
export const Empty = ({ icon = 'partly-sunny-outline', t }) => <Animated.View entering={FadeIn.delay(200)} style={{ alignItems: 'center', margin: 30 }}>
  <Float><Ionicons name={icon} size={56} color={C.pri} /></Float><Text style={S.empty}>{t}</Text></Animated.View>;
export const Item = ({ i, children, style }) => <Animated.View entering={pop(i)} layout={LITE ? undefined : LinearTransition.springify()} style={style}>{children}</Animated.View>;

export const Btn = ({ t, onPress, kind = 'pri', busy, style, icon, small }) => {
  const dark = kind === 'pri' || kind === 'del', fg = dark ? '#fff' : C.pri;
  const inner = busy ? <ActivityIndicator color={fg} /> : <View style={S.brow}>{icon && <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 6 }} />}<Text style={[S.bt, { color: fg }]}>{t}</Text></View>;
  const g = kind === 'pri' ? G : kind === 'del' ? ['#DC2626', '#EF4444'] : null, pad = { padding: small ? 10 : 15 };
  return <Press disabled={busy} onPress={onPress} style={style}>{g ? <LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[S.btn, pad]}>{inner}</LinearGradient>
    : <View style={[S.btn, pad, kind === 'out' ? S.out : { backgroundColor: '#fff' }]}>{inner}</View>}</Press>;
};
export function Field({ icon, multiline, right, ...p }) {
  const f = useSharedValue(0), a = useAnimatedStyle(() => ({ borderColor: interpolateColor(f.value, [0, 1], [C.line, C.pri]), transform: [{ scale: 1 + f.value * 0.015 }] }));
  return <Animated.View style={[S.field, a, multiline && { height: 90, alignItems: 'flex-start' }]}><Ionicons name={icon} size={20} color={C.mut} style={multiline && { marginTop: 14 }} />
    <TextInput placeholderTextColor={C.mut} autoCapitalize="none" multiline={multiline} {...p} onFocus={() => { f.value = withTiming(1); }} onBlur={() => { f.value = withTiming(0); }} style={[S.fin, multiline && { textAlignVertical: 'top' }]} />{right}</Animated.View>;
}
export const Badge = ({ s }) => <View style={[S.badge, { backgroundColor: s === 'open' ? '#D1FAE5' : s === 'late' ? '#FEF3C7' : '#DCEBF5' }]}>{s === 'open' && <Live />}
  <Text style={{ fontSize: 12, fontWeight: '800', color: s === 'open' ? '#047857' : s === 'late' ? '#B45309' : C.mut }}>{s}</Text></View>;

export function useLoad(fn, deps = []) {
  const [d, setD] = useState(null), [l, setL] = useState(true), [e, setE] = useState('');
  const run = useCallback(async () => { setL(true); const { data, error } = await fn(); setE(error ? error.message : ''); setD(data || []); setL(false); }, deps);
  useEffect(() => { run(); }, [run]);
  return { d, l, e, run };
}
export function useLive(table, cb, filter) {   // EVENT: realtime database change
  useEffect(() => { const ch = supabase.channel(`rt-${table}-${Math.random()}`).on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, cb).subscribe();
    return () => { supabase.removeChannel(ch); }; }, []);
}
export const List = ({ q, render, empty, icon, header }) => (q.l && !q.d ? <Skel /> :
  <FlatList data={q.d || []} keyExtractor={(i) => i.id} refreshing={q.l} onRefresh={q.run} renderItem={({ item, index }) => render(item, index)}
    ListHeaderComponent={<>{header}{q.e ? <Text style={S.err}>Could not load data: {q.e}</Text> : null}</>}
    ListEmptyComponent={!q.l && !q.e ? <Empty icon={icon} t={empty} /> : null} contentContainerStyle={{ padding: 16, paddingBottom: 110 }} />);


export function Filters({ v, setV, f, setF }) {
  return <View style={{ marginBottom: 12 }}><Field icon="search" placeholder="Search events or venues" value={v} onChangeText={setV} />
    <View style={{ flexDirection: 'row' }}>{['all', 'open', 'closed'].map((x) => <Press key={x} onPress={() => setF(x)} style={[S.chip, f === x && { backgroundColor: C.pri, borderColor: C.pri }]}>
      <Text style={{ fontWeight: '700', color: f === x ? '#fff' : C.ink }}>{x}</Text></Press>)}</View></View>;
}
export const filt = (q, v, f) => ({ ...q, d: q.d && q.d.filter((e) => (f === 'all' || e.status === f) && (e.name + ' ' + e.venue).toLowerCase().includes(v.trim().toLowerCase())) });
export const toCsv = (rows) => rows.map((r) => r.map((c) => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');

/* ---------- additions: chips + departments ---------- */
export const Chip = ({ on, onPress, children, color }) => <Press onPress={onPress} style={[S.chip, on && { backgroundColor: color || C.pri, borderColor: color || C.pri }]}>{children}</Press>;
export function DeptPicker({ value, onChange }) {
  return <View style={{ marginBottom: 6 }}><Text style={S.lbl}>Department</Text>
    {DEPTS.map((d) => { const on = value === d.code;
      return <Press key={d.code} onPress={() => onChange(d.code)} style={[S.dept, on && { borderColor: C.pri, backgroundColor: C.priL }]}>
        <View style={[S.dot, { backgroundColor: d.color }]} /><Text style={{ flex: 1, fontWeight: on ? '800' : '600', color: C.ink }}>{d.name}</Text>
        {on && <Ionicons name="checkmark-circle" size={20} color={C.pri} />}</Press>; })}</View>;
}
export const DeptTag = ({ code }) => { const d = code && DEPTS.find((x) => x.code === code); if (!d) return null;
  return <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={[S.dot, { width: 9, height: 9, borderRadius: 5, marginRight: 5, backgroundColor: d.color }]} /><Text style={{ color: C.mut, fontSize: 13, fontWeight: '700' }}>{d.code}</Text></View>; };
