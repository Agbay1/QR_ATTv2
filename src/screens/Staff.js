import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, StyleSheet, ScrollView, Modal, StatusBar, KeyboardAvoidingView, Platform, Share } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, FadeOutUp, ZoomIn, SlideInDown, LinearTransition, useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, withSequence, withDelay, interpolateColor, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../supabase';
import { C, G, TOP, MSG, fmt, hap, pop, S, DEPTS, NA } from '../theme';
import { Press, useShake, Float, Ring, Live, Count, Skel, Empty, Item, Btn, Field, Badge, useLoad, useLive, List, Filters, filt, toCsv, DeptTag } from '../ui';
import { notify, scheduleReminder, initNotify } from '../notify';
import { Alert } from '../dialog';
import { queueScan, syncQueue } from '../offline';

import { EventCard } from './Student';
import { DatePicker, TimePicker } from '../pickers';
import { fmtDate, t12, parseDate, parseTime, manilaMs, manilaParts, effStatus } from '../dt';

/* ---------- teacher / admin ---------- */
export function StaffEvents({ profile }) {
  const q = useLoad(() => supabase.from('events').select('*,attendance(count)').order('event_date', { ascending: false }));
  const [sel, setSel] = useState(null), [form, setForm] = useState(null), [v, setV] = useState(''), [f, setF] = useState('all');
  useLive('events', q.run);
  return <View style={{ flex: 1 }}>
    <List q={filt(q, v, f)} icon="calendar-outline" empty="No events match. Create one or change the filter." header={<View><Btn t="New event" icon="add-circle" onPress={() => setForm({})} style={{ marginBottom: 14 }} /><Filters v={v} setV={setV} f={f} setF={setF} /></View>}
      render={(e, i) => <EventCard e={e} i={i} onPress={() => setSel(e)} extra={<Text style={[S.mut, { marginTop: 6, fontWeight: '700' }]}><Ionicons name="people-outline" /> {e.attendance?.[0]?.count ?? 0} attended</Text>} />} />
    {sel && <Detail ev={sel} profile={profile} onClose={() => { setSel(null); q.run(); }} onEdit={() => { setForm(sel); setSel(null); }} onDuplicate={() => { setForm({ ...sel, id: undefined, event_date: '', end_at: null }); setSel(null); }} />}
    {form && <Form ev={form} profile={profile} onClose={(saved) => { setForm(null); if (saved) { hap.ok(); q.run(); } }} />}
  </View>;
}
export const Sheet = ({ children, onClose }) => <Modal transparent animationType="none" onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: '#0B335099' }}>
  <Pressable style={{ height: TOP }} onPress={onClose} />
  <Animated.View entering={SlideInDown.springify().damping(20).stiffness(170)} style={{ flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
    <View style={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.line }} />
      <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" style={{ position: 'absolute', right: 14, top: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="close" size={20} color={C.ink} /></Pressable></View>
    {children}</Animated.View></View></Modal>;

export function Form({ ev, profile, onClose }) {
  const endP = ev.end_at ? manilaParts(ev.end_at) : null;
  const [f, setF] = useState({ name: ev.name || '', event_date: ev.event_date || '', event_time: ev.event_time ? t12(ev.event_time) : '', end_time: endP ? t12(endP.time) : '', venue: ev.venue || '', description: ev.description || '', late_after_minutes: String(ev.late_after_minutes ?? 15) });
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [pk, setPk] = useState(null), [shake, go] = useShake(), set = (k) => (v) => setF({ ...f, [k]: v });
  const fail = (m) => { setErr(m); hap.bad(); go(); };
  const start = parseTime(f.event_time), endT = f.end_time.trim() ? parseTime(f.end_time) : null;
  const nextDay = !!(start && start !== 'AMBIG' && endT && endT !== 'AMBIG' && endT <= start);
  const save = async () => {                                                        // EVENT: event created / edited
    if (!f.name.trim() || !f.venue.trim()) return fail('Event name and venue are required.');
    if (!parseDate(f.event_date.trim())) return fail('Pick a date (or type it like 2026-12-31).');
    if (start === 'AMBIG') return fail('Add AM or PM to the start time, for example 2:30 PM.');
    if (!start) return fail('Pick a start time, for example 2:30 PM.');
    if (f.end_time.trim() && endT === 'AMBIG') return fail('Add AM or PM to the end time, for example 4:00 PM.');
    if (f.end_time.trim() && !endT) return fail('End time is not valid. Pick one or clear it.');
    const late = Number(f.late_after_minutes);
    if (!/^\d{1,3}$/.test(String(f.late_after_minutes)) || late > 600) return fail('Late-after minutes must be a number from 0 to 600.');
    const date = f.event_date.trim(), row = { name: f.name.trim(), event_date: date, event_time: start, venue: f.venue.trim(), description: f.description.trim(), late_after_minutes: late };
    if (endT) row.end_at = new Date(manilaMs(date, endT) + (nextDay ? 864e5 : 0)).toISOString();   // optional: auto-close time
    else if (ev.end_at) row.end_at = null;                                           // end time cleared on an existing event
    setBusy(true);
    const { error } = ev.id ? await supabase.from('events').update(row).eq('id', ev.id) : await supabase.from('events').insert({ ...row, created_by: profile.id });
    setBusy(false);
    if (error) return fail(/end_at/.test(error.message) ? 'End times need the new database update (migration 20260104). Run it in the Supabase SQL editor, or save without an end time.' : error.message);
    onClose(true);
  };
  const Pk = ({ icon, onPress, label }) => <Press onPress={onPress} style={{ padding: 6 }}><Ionicons name={icon} size={22} color={C.pri} accessibilityLabel={label} /></Press>;
  const hint = (t) => (t ? <Text style={[S.mut, { marginTop: -4, marginBottom: 10, marginLeft: 6, fontSize: 13 }]}>{t}</Text> : null);
  return <Sheet onClose={() => onClose(false)}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4 }} keyboardShouldPersistTaps="handled"><Animated.View style={shake}>
        <Text style={S.title}>{ev.id ? 'Edit event' : 'New event'}</Text>
        <Field icon="bookmark-outline" placeholder="Event name" value={f.name} onChangeText={set('name')} autoCapitalize="sentences" />
        <Field icon="calendar-outline" placeholder="Date (tap the calendar to pick)" value={f.event_date} onChangeText={set('event_date')} right={<Pk icon="calendar" label="Pick date" onPress={() => setPk('date')} />} />
        {hint(parseDate(f.event_date.trim()) ? fmtDate(f.event_date.trim()) : '')}
        <Field icon="time-outline" placeholder="Start time (e.g. 2:30 PM)" value={f.event_time} onChangeText={set('event_time')} autoCapitalize="characters" right={<Pk icon="time" label="Pick start time" onPress={() => setPk('start')} />} />
        <Field icon="flag-outline" placeholder="End time (optional) - auto-closes" value={f.end_time} onChangeText={set('end_time')} autoCapitalize="characters"
          right={<View style={{ flexDirection: 'row' }}>{!!f.end_time && <Pk icon="close-circle" label="Clear end time" onPress={() => set('end_time')('')} />}<Pk icon="time" label="Pick end time" onPress={() => setPk('end')} /></View>} />
        {hint(f.end_time.trim() ? (endT && endT !== 'AMBIG' ? `Closes automatically at ${t12(endT)}${nextDay ? ' the next day' : ''}.` : '') : 'Leave empty to close the event yourself.')}
        <Field icon="location-outline" placeholder="Venue" value={f.venue} onChangeText={set('venue')} autoCapitalize="sentences" />
        <Field icon="alarm-outline" placeholder="Mark late after (minutes)" value={String(f.late_after_minutes)} onChangeText={set('late_after_minutes')} keyboardType="number-pad" />
        <Field icon="reader-outline" placeholder="Description" value={f.description} onChangeText={set('description')} multiline autoCapitalize="sentences" />
        {!!err && <Animated.View entering={FadeIn.duration(150)}><Text style={S.err}>{err}</Text></Animated.View>}
        <Btn t="Save event" icon="checkmark-circle" onPress={save} busy={busy} /><Btn t="Cancel" kind="out" onPress={() => onClose(false)} style={{ marginTop: 10 }} /></Animated.View></ScrollView></KeyboardAvoidingView>
    {pk === 'date' && <DatePicker value={f.event_date.trim()} onClose={() => setPk(null)} onPick={(d) => { setF({ ...f, event_date: d }); setPk(null); }} />}
    {pk === 'start' && <TimePicker title="Start time" value={f.event_time} onClose={() => setPk(null)} onPick={(t) => { setF({ ...f, event_time: t }); setPk(null); }} />}
    {pk === 'end' && <TimePicker title="End time" value={f.end_time || f.event_time} onClose={() => setPk(null)} onPick={(t) => { setF({ ...f, end_time: t }); setPk(null); }} />}
  </Sheet>;
}

export function LiveQR({ id }) {                                                          // EVENT: QR rotates every 30s
  const [code, setCode] = useState(null), [err, setErr] = useState(''), t = useSharedValue(1);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('current_qr', { p_event: id }); error ? setErr(error.message) : (setErr(''), setCode(data));
    t.value = 1; t.value = withTiming(0, { duration: 30000, easing: Easing.linear });
  }, [id]);
  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);
  const bar = useAnimatedStyle(() => ({ width: `${t.value * 100}%` }));
  return <View style={{ alignItems: 'center' }}>{code ? <QRCode value={'QRATT2:' + code} size={200} /> : <ActivityIndicator color={C.pri} />}
    {!!err && <Text style={S.err}>{err}</Text>}<View style={S.timer}><Animated.View style={[S.timerIn, bar]} /></View></View>;
}

/* teacher QR on a lanyard-style pass */
function Lanyard({ ev }) {
  return <Animated.View entering={FadeInDown.springify().damping(13).stiffness(140)} style={{ alignItems: 'center', marginBottom: 16 }}>
    <View style={S.strap}><View style={S.strapStripe} /></View>
    <View style={S.lan}>
      <View style={S.slot} />
      <View style={S.lanHead}><Text style={S.lanName} numberOfLines={2}>{ev.name}</Text><Text style={S.lanSub}>Scan to check in · {ev.venue}</Text></View>
      <View style={{ alignItems: 'center', padding: 18 }}><View style={S.qrBox}><LiveQR id={ev.id} /></View></View>
      <View style={S.lanFoot}><Live /><Text style={{ color: C.mut, fontSize: 13 }}>Rotating code · screenshots stop working</Text></View></View></Animated.View>;
}

/* who checked in, by department */
function DeptStrip({ rows }) {
  if (!rows.some((a) => a.profiles && 'department' in a.profiles)) return null;
  const by = {}; rows.forEach((a) => { const c = a.profiles?.department || 'NA'; by[c] = (by[c] || 0) + 1; });
  const parts = [...DEPTS, NA].map((d) => ({ ...d, n: by[d.code] || 0 })).filter((d) => d.n);
  if (!parts.length) return null;
  return <Item i={0}><View style={[S.card, { flexDirection: 'column' }]}><Text style={[S.cardT, { marginBottom: 10 }]}>Check-ins by department</Text>
    <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden' }}>{parts.map((d) => <View key={d.code} style={{ flex: d.n, backgroundColor: d.color }} />)}</View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>{parts.map((d) => <View key={d.code} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 2 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, marginRight: 6, backgroundColor: d.color }} /><Text style={{ fontSize: 13, color: C.mut, fontWeight: '600' }}>{d.code} · {d.n}</Text></View>)}</View></View></Item>;
}

export function Detail({ ev: init, profile, onClose, onEdit, onDuplicate }) {
  const [ev, setEv] = useState(init), st = effStatus(ev), isAdmin = profile.role === 'admin', canEdit = isAdmin || init.created_by === profile.id;
  const q = useLoad(async () => {   // department is optional: falls back if the department migration has not been run yet
    const sel = (p) => supabase.from('attendance').select(`id,status,scanned_at,offline,profiles(${p})`).eq('event_id', ev.id).order('scanned_at', { ascending: false });
    const r = await sel('full_name,student_no,department'); return r.error ? sel('full_name,student_no') : r;
  }, [ev.id]);
  useLive('attendance', () => { hap.ok(); q.run(); }, 'event_id=eq.' + init.id);   // EVENT: new check-in arrives in real time
  const setStatus = async () => {                                                   // EVENT: event status changes
    if (st !== 'open' && ev.end_at && new Date(ev.end_at) <= new Date()) return Alert.alert('End time has passed', 'Edit the event and set a later end time (or clear it) before reopening.');
    const status = st === 'open' ? 'closed' : 'open';
    const { error } = await supabase.from('events').update({ status }).eq('id', ev.id);
    error ? Alert.alert('Error', error.message) : (hap.ok(), setEv({ ...ev, status }));
  };
  const del = (a) => Alert.alert('Remove record', `Remove ${a.profiles?.full_name}'s attendance?`, [{ text: 'Cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => { const { error } = await supabase.from('attendance').delete().eq('id', a.id); error ? Alert.alert('Error', error.message) : q.run(); } }]);
  const mark = async (a, status) => { const { error } = await supabase.from('attendance').update({ status }).eq('id', a.id); error ? Alert.alert('Error', error.message) : q.run(); };
  const delEv = () => Alert.alert('Delete event', 'This also deletes its attendance records.', [{ text: 'Cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { const { error } = await supabase.from('events').delete().eq('id', ev.id); error ? Alert.alert('Error', error.message) : onClose(); } }]);
  const exportCsv = () => Share.share({ title: ev.name + ' attendance', message: toCsv([['Student', 'Student No', 'Department', 'Status', 'Scanned at', 'Offline'], ...(q.d || []).map((a) => [a.profiles?.full_name, a.profiles?.student_no || '', a.profiles?.department || '', a.status, a.scanned_at, a.offline ? 'yes' : 'no'])]) });
  return <Sheet onClose={onClose}>
    <List q={q} icon="people-outline" empty="No one has checked in yet. Waiting for the first scan…" header={<View>
      <EventCard e={ev} />
      {st === 'open' ? <Lanyard ev={ev} /> : <Animated.View entering={FadeIn.delay(100).duration(250)} style={[S.card, { justifyContent: 'center', paddingVertical: 24 }]}><Empty icon="lock-closed-outline" t="Event closed. QR attendance is disabled." /></Animated.View>}
      {canEdit && <View style={S.row}><Btn t={st === 'open' ? 'Close event' : 'Reopen'} icon={st === 'open' ? 'lock-closed' : 'lock-open'} onPress={setStatus} style={{ flex: 1, marginRight: 8 }} />
        <Btn t="Edit" kind="out" icon="create" onPress={onEdit} style={{ flex: 1 }} /></View>}
      <View style={[S.row, { marginTop: 8 }]}><Btn t="Export CSV" kind="out" icon="download-outline" onPress={exportCsv} style={{ flex: 1, marginRight: onDuplicate ? 8 : 0 }} />
        {!!onDuplicate && <Btn t="Duplicate" kind="out" icon="copy-outline" onPress={onDuplicate} style={{ flex: 1 }} />}</View>
      {isAdmin && <Btn t="Delete event" kind="del" icon="trash" onPress={delEv} style={{ marginTop: 8 }} />}
      <View style={[S.row, { marginTop: 18, marginBottom: 12, justifyContent: 'flex-start' }]}><Count to={q.d?.length ?? 0} style={S.sumN} /><Text style={[S.cardT, { marginLeft: 8 }]}>checked in</Text><View style={{ flex: 1 }} /><Live /><Text style={S.mut}>live</Text></View>
      {!!q.d?.length && <DeptStrip rows={q.d} />}</View>}
      render={(a, i) => <Item i={i}><View style={[S.card, { flexDirection: 'column' }]}><View style={S.row}><Text style={S.cardT}>{a.profiles?.full_name}</Text><Badge s={a.status} /></View>
        <View style={[S.row, { justifyContent: 'flex-start', flexWrap: 'wrap' }]}><Text style={[S.mut, { marginRight: 10 }]}>{a.profiles?.student_no || 'No student number'} · {fmt(a.scanned_at)}{a.offline ? ' · synced offline' : ''}</Text><DeptTag code={a.profiles?.department} /></View>
        {isAdmin && <View style={[S.row, { marginTop: 10 }]}><Btn small t={a.status === 'late' ? 'Mark present' : 'Mark late'} kind="out" onPress={() => mark(a, a.status === 'late' ? 'present' : 'late')} style={{ flex: 1, marginRight: 8 }} />
          <Btn small t="Remove" kind="del" onPress={() => del(a)} style={{ flex: 1 }} /></View>}</View></Item>} />
    <View style={{ padding: 16 }}><Btn t="Back" kind="out" icon="arrow-back" onPress={onClose} /></View></Sheet>;
}
