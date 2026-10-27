import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, StyleSheet, ScrollView, Modal, StatusBar, KeyboardAvoidingView, Platform, Share } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, FadeOutUp, ZoomIn, SlideInDown, LinearTransition, useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, withSequence, withDelay, interpolateColor, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../supabase';
import { C, G, TOP, MSG, fmt, hap, pop, S, LITE } from '../theme';
import { Press, useShake, Float, Ring, Live, Count, Skel, Empty, Item, Btn, Field, Badge, useLoad, useLive, List, Filters, filt, toCsv } from '../ui';
import { notify, scheduleReminder, initNotify } from '../notify';
import { Alert } from '../dialog';
import { queueScan, syncQueue } from '../offline';
import { fmtRange, effStatus, dayParts } from '../dt';

/* ---------- student ---------- */
const Notch = ({ top }) => <View pointerEvents="none" style={[S.notch, { left: 68 }, top ? { top: -8 } : { bottom: -8 }]} />;
export const EventCard = ({ e, onPress, extra, i = 0 }) => {      // ticket stub: date block | tear line + 2 notches | details
  const open = effStatus(e) === 'open', d = dayParts(e.event_date), mu = !open && { color: C.mut };
  const stub = <><Text style={[S.stubM, !open && { color: C.mut }]}>{d.mon}</Text><Text style={[S.stubD, mu]}>{d.day}</Text><Text style={[S.stubW, mu]}>{d.dow}</Text></>;
  return <Item i={i}><Press disabled={!onPress} onPress={onPress} style={[S.ticket, !open && S.ticketUsed]}>
    {open ? <LinearGradient colors={G} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.stub}>{stub}</LinearGradient> : <View style={[S.stub, { backgroundColor: C.used }]}>{stub}</View>}
    <View style={S.tear}><View style={S.tearIn} /></View>
    <View style={S.tBody}>
      <View style={S.row}><Text style={[S.cardT, mu]}>{e.name}</Text>{open ? <Badge s="open" /> : <View style={S.closedStamp}><Text style={S.closedT}>Closed</Text></View>}</View>
      <Text style={[S.tTime, mu]}>{fmtRange(e)}</Text>
      <Text style={S.mut}><Ionicons name="location-outline" /> {e.venue}</Text>
      {!!e.description && <Text style={{ color: open ? C.ink : C.mut, marginTop: 6 }}>{e.description}</Text>}{extra}</View>
    <Notch top /><Notch /></Press></Item>;
};

export function StudentEvents() {
  const q = useLoad(() => supabase.from('events').select('*').order('event_date', { ascending: false }));
  const [v, setV] = useState(''), [f, setF] = useState('all');
  useLive('events', q.run);
  useEffect(() => { (q.d || []).forEach(scheduleReminder); }, [q.d]);
  return <List q={filt(q, v, f)} icon="calendar-outline" empty="No events match. Check back soon." header={<Filters v={v} setV={setV} f={f} setF={setF} />} render={(e, i) => <EventCard e={e} i={i} />} />;
}
export function History() {
  const q = useLoad(() => supabase.from('attendance').select('id,status,scanned_at,events(name,venue,event_date)').order('scanned_at', { ascending: false }));
  return <List q={q} icon="qr-code-outline" empty="No attendance yet. Scan an event QR code to get started." render={(a, i) => (
    <Item i={i}><View style={S.card}><View style={[S.bar, { backgroundColor: C.pri }]} /><View style={{ flex: 1 }}>
      <View style={S.row}><Text style={S.cardT}>{a.events?.name}</Text><Badge s={a.status} /></View>
      <Text style={S.mut}>{a.events?.venue} · {a.events?.event_date}</Text><Text style={S.mut}>Recorded {fmt(a.scanned_at)}</Text></View></View></Item>)} />;
}


/* ---------- the ONE hero animation: a rubber stamp lands on the pass ---------- */
function Stamp({ word, color, style }) {
  const sc = useSharedValue(LITE ? 1 : 2.6), op = useSharedValue(0), st = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ rotate: '-10deg' }, { scale: sc.value }] }));
  useEffect(() => {
    op.value = withDelay(150, withTiming(1, { duration: LITE ? 200 : 80 }));
    if (!LITE) sc.value = withDelay(150, withSequence(withTiming(0.88, { duration: 130, easing: Easing.in(Easing.quad) }), withSpring(1, { damping: 6, stiffness: 320 })));   // scale-in, tiny squish, settle
  }, []);
  return <Animated.View pointerEvents="none" style={[style, st]}><View style={[S.stampBox, { borderColor: color }]}><Text style={[S.stampT, { color }]}>{word}</Text></View></Animated.View>;
}
function Result({ res, onAgain }) {
  const kind = res.off ? 'off' : res.ok ? (res.late ? 'late' : 'in') : 'void';
  const col = { in: C.ok, late: C.ambD, off: C.pri, void: C.err }[kind], word = { in: 'In', late: 'Late', off: 'Saved', void: 'Void' }[kind];
  const label = { in: 'Attendance recorded', late: 'Recorded as late', off: 'Saved on this phone', void: 'Not recorded' }[kind];
  const x = useSharedValue(0), shud = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  useEffect(() => {
    const land = LITE ? 150 : 280;                                                 // moment the stamp hits
    if (!LITE) x.value = withDelay(land, withSequence(withTiming(-7, { duration: 45 }), withTiming(6, { duration: 60 }), withSpring(0, { damping: 6, stiffness: 300 })));   // the pass shudders
    const t = setTimeout(() => { kind === 'void' ? hap.bad() : hap.thud(); }, land);
    return () => clearTimeout(t);
  }, []);
  return <View style={S.center}>
    <Animated.View entering={LITE ? FadeIn.duration(200) : FadeInUp.duration(220)} style={[S.pass, shud]}>
      <View style={[S.passStrip, { backgroundColor: col }]} />
      <View style={S.passIn}>
        <Text style={S.passLbl}>{label}</Text>
        <Text style={S.passName}>{res.name || (kind === 'void' ? 'Scan failed' : kind === 'off' ? 'Offline scan' : 'Event')}</Text>
        {kind !== 'void' && !res.off && <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink, marginTop: 8 }}>{new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>}
        <Text style={S.resT2}>{res.m}</Text></View>
      <Stamp word={word} color={col} style={{ position: 'absolute', right: 14, bottom: 14 }} /></Animated.View>
    <Animated.View entering={FadeIn.delay(450).duration(220)} style={{ alignSelf: 'stretch', maxWidth: 360, marginTop: 22 }}><Btn t="Scan another" kind="out" icon="scan" onPress={onAgain} /></Animated.View></View>;
}

export function Corner({ s }) { return <View style={[{ position: 'absolute', width: 36, height: 36, borderColor: C.amb, borderWidth: 0 }, s]} />; }
export function Scan() {
  const [perm, ask] = useCameraPermissions(), [res, setRes] = useState(null), [busy, setBusy] = useState(false);
  const y = useSharedValue(0), line = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] })), pulse = useSharedValue(1), pc = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  useEffect(() => { y.value = withRepeat(withTiming(240, { duration: 1700, easing: Easing.inOut(Easing.quad) }), -1, true); }, []);
  const onScan = async ({ data }) => {                                              // EVENT: QR scanner detects a code
    if (busy || res) return; setBusy(true);
    if (!data.startsWith('QRATT2:')) { hap.bad(); setRes({ ok: false, m: MSG.INVALID_QR }); return setBusy(false); }   // EVENT: invalid QR
    const tok = data.slice(7), at = new Date().toISOString();
    const { data: r, error } = await supabase.rpc('record_attendance', { p_token: tok });
    if (error && /network|fetch/i.test(error.message)) {                                                              // EVENT: offline -> queue
      await queueScan(tok, at); hap.ok(); setRes({ ok: true, off: true, m: 'You are offline. Your scan is saved and syncs automatically when the connection returns.' }); return setBusy(false);
    }
    const key = error && Object.keys(MSG).find((k) => error.message.includes(k));                                     // EVENT: duplicate / closed / expired
    if (error) hap.bad(); else { Haptics.selectionAsync(); notify(r.status === 'late' ? 'Marked late' : 'Attendance recorded', r.name); }
    setRes(error ? { ok: false, m: MSG[key] || error.message } : { ok: true, late: r.status === 'late', name: r.name, m: r.status === 'late' ? 'You checked in after the late mark.' : 'You are all set. Enjoy the event.' }); setBusy(false);
  };
  if (!perm) return <Skel />;
  if (!perm.granted) return <View style={S.center}><Empty icon="camera-outline" t="Camera access is needed to scan QR codes." /><Btn t="Allow camera" icon="camera" onPress={ask} /></View>;
  if (res) return <Result res={res} onAgain={() => setRes(null)} />;
  return <View style={{ flex: 1 }}><CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B335055' }]}>
      <Animated.View style={[{ width: 260, height: 260 }, pc]}>
        <Corner s={{ top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 16 }} /><Corner s={{ top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 16 }} />
        <Corner s={{ bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 16 }} /><Corner s={{ bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 16 }} />
        <Animated.View style={[{ marginTop: 8, height: 3, borderRadius: 2, backgroundColor: C.amb, shadowColor: C.amb, shadowOpacity: 1, shadowRadius: 8, elevation: 6 }, line]} /></Animated.View>
      <Animated.Text entering={FadeInUp.delay(300)} style={S.hint}>{busy ? 'Recording attendance…' : 'Point at the event QR code'}</Animated.Text></View></View>;
}

