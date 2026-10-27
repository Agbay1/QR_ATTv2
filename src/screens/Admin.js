import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, StyleSheet, ScrollView, Modal, StatusBar, KeyboardAvoidingView, Platform, Share } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, FadeOutUp, ZoomIn, SlideInDown, LinearTransition, useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, withSequence, withDelay, interpolateColor, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../supabase';
import { C, G, TOP, MSG, fmt, hap, pop, S, DEPTS, NA, deptOf } from '../theme';
import { Press, useShake, Float, Ring, Live, Count, Skel, Empty, Item, Btn, Field, Badge, useLoad, useLive, List, Filters, filt, toCsv, Chip, DeptTag } from '../ui';
import { HBar, Donut, StackedCols, Legend } from '../charts';
import { notify, scheduleReminder, initNotify } from '../notify';
import { Alert } from '../dialog';
import { queueScan, syncQueue } from '../offline';

export function Users({ me }) {
  const q = useLoad(() => supabase.from('profiles').select('*').order('created_at', { ascending: false })), [dept, setDept] = useState('all');
  const setRole = async (u, role) => { const { error } = await supabase.from('profiles').update({ role }).eq('id', u.id); error ? Alert.alert('Error', error.message) : (hap.ok(), q.run()); };
  const shown = { ...q, d: q.d && q.d.filter((u) => dept === 'all' || (u.department || 'NA') === dept) };
  const hasDept = !!q.d?.some((u) => 'department' in u);
  const head = hasDept ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
    <Chip on={dept === 'all'} onPress={() => setDept('all')}><Text style={{ fontWeight: '700', color: dept === 'all' ? '#fff' : C.ink }}>All</Text></Chip>
    {[...DEPTS, NA].map((d) => <Chip key={d.code} on={dept === d.code} color={d.color} onPress={() => setDept(d.code)}>
      <Text style={{ fontWeight: '700', color: dept === d.code ? d.fg : C.ink }}>{d.code === 'NA' ? 'None' : d.code}</Text></Chip>)}</ScrollView> : null;
  return <List q={shown} icon="people-outline" empty="No users found." header={head} render={(u, i) => <Item i={i}><View style={[S.card, { flexDirection: 'column' }]}>
    <View style={S.row}><View style={S.avatarS}><Text style={S.avT}>{u.full_name?.[0]?.toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={S.cardT}>{u.full_name}{u.id === me.id ? ' (you)' : ''}</Text>
      <Text style={S.mut}>{u.student_no || 'No student number'}</Text>{!!u.department && <View style={{ marginTop: 3 }}><Text style={{ color: C.mut, fontSize: 13 }}>{deptOf(u.department).name}</Text></View>}</View></View>
    <View style={[S.row, { marginTop: 10, justifyContent: 'flex-start' }]}>{['student', 'teacher', 'admin'].map((r) => <Chip key={r} on={u.role === r} onPress={() => (u.id === me.id || u.role === r ? null : setRole(u, r))}>
      <Text style={{ fontWeight: '700', color: u.role === r ? '#fff' : C.ink }}>{r[0].toUpperCase() + r.slice(1)}</Text></Chip>)}</View></View></Item>} />;
}

const card = [S.card, { flexDirection: 'column' }];
export function Analytics() {
  const q = useLoad(async () => { const { data, error } = await supabase.rpc('analytics'); return { data: data ? [{ id: 'a', ...data }] : [], error }; });
  const [sel, setSel] = useState('all');
  const a = q.d?.[0];
  if (q.e) return <Text style={[S.err, { padding: 16 }]}>Could not load analytics: {q.e}</Text>;
  if (!a) return <Skel />;
  const ev = a.events || [], has = Array.isArray(a.departments);                    // department data needs migration 5
  const depts = has ? a.departments.filter((d) => d.students > 0 || ev.some((e) => (e.by_dept || []).some((b) => b.code === d.code))) : [];
  const pick = has && sel !== 'all' && depts.some((d) => d.code === sel) ? sel : 'all';
  const dBy = (e, code) => (e.by_dept || []).find((b) => b.code === code) || { present: 0, late: 0 };
  const evx = ev.map((e) => (pick === 'all' ? e : { ...e, present: dBy(e, pick).present, late: dBy(e, pick).late }));
  const stuN = pick === 'all' ? a.students : depts.find((d) => d.code === pick)?.students || 0;
  const tot = evx.reduce((s, e) => s + e.present + e.late, 0), late = evx.reduce((s, e) => s + e.late, 0), den = Math.max(1, ev.length * stuN), absent = Math.max(0, den - tot);
  const rate = Math.min(100, Math.round((100 * tot) / den)), pct = (e) => Math.min(100, Math.round((100 * (e.present + e.late)) / Math.max(1, stuN)));
  const top = [...evx].sort((x, y) => y.present + y.late - (x.present + x.late)).slice(0, 5), tr = [...evx].reverse(), pc = pick === 'all' ? C.pri : deptOf(pick).color;
  const dStat = depts.map((d) => { const p = ev.reduce((s, e) => s + dBy(e, d.code).present, 0), l = ev.reduce((s, e) => s + dBy(e, d.code).late, 0);
    return { ...d, ...deptOf(d.code), name: d.name, p, l, rate: Math.min(100, Math.round((100 * (p + l)) / Math.max(1, d.students * ev.length))) }; });
  const share = () => Share.share({ title: 'Attendance report', message: toCsv([['Event', 'Date', 'Present', 'Late', 'Rate %', ...(has ? depts.map((d) => d.code + ' check-ins') : [])],
    ...ev.map((e) => [e.name, e.date, e.present, e.late, Math.min(100, Math.round((100 * (e.present + e.late)) / Math.max(1, a.students))), ...(has ? depts.map((d) => dBy(e, d.code).present + dBy(e, d.code).late) : [])])]) });
  if (!ev.length) return <Empty icon="stats-chart-outline" t="No events yet. Create an event to see analytics." />;
  return <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
    {has && <Animated.View entering={FadeIn.duration(200)}><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
      <Chip on={pick === 'all'} onPress={() => setSel('all')}><Text style={{ fontWeight: '700', color: pick === 'all' ? '#fff' : C.ink }}>All departments</Text></Chip>
      {depts.map((d) => { const m = deptOf(d.code); return <Chip key={d.code} on={pick === d.code} color={m.color} onPress={() => setSel(d.code)}>
        <Text style={{ fontWeight: '700', color: pick === d.code ? m.fg : C.ink }}>{d.code === 'NA' ? 'None' : d.code}</Text></Chip>; })}</ScrollView></Animated.View>}

    <Item i={0}><View style={card}><Text style={S.cardT}>{pick === 'all' ? 'Overall' : deptOf(pick).name} · latest {ev.length} events</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
        <Donut parts={[{ v: tot - late, color: C.ok }, { v: late, color: C.amb }, { v: absent, color: C.used }]}><Count to={rate} suffix="%" style={{ fontWeight: '900', fontSize: 30, color: C.ink }} /><Text style={{ color: C.mut, fontSize: 12 }}>attendance</Text></Donut>
        <View style={{ flex: 1, marginLeft: 18 }}>{[['In on time', tot - late, C.ok], ['Late', late, C.amb], ['Absent', absent, '#B8C3C0']].map(([l, v, c]) => <View key={l} style={[S.row, { marginBottom: 8 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={[S.dot, { width: 10, height: 10, borderRadius: 3, backgroundColor: c }]} /><Text style={{ fontWeight: '600' }}>{l}</Text></View>
          <Count to={v} style={{ fontWeight: '900', fontSize: 18 }} /></View>)}
          <Text style={S.mut}>{stuN} students · {Math.round((100 * late) / Math.max(1, tot))}% of check-ins were late</Text></View></View></View></Item>

    {has && pick === 'all' && !!dStat.length && <Item i={1}><View style={card}><Text style={[S.cardT, { marginBottom: 14 }]}>Attendance by department</Text>
      {[...dStat].sort((x, y) => y.rate - x.rate).map((d, i) => <HBar key={d.code} i={i} dot={d.color} color={d.color} label={d.name} pct={d.rate} sub={`${d.students} students · ${d.p + d.l} check-ins · ${d.l} late`} />)}</View></Item>}

    {has && pick === 'all' && !!dStat.length && <Item i={2}><View style={card}><Text style={[S.cardT, { marginBottom: 10 }]}>Check-ins by department, per event</Text>
      <StackedCols rows={[...ev].reverse().map((e) => ({ key: e.id, label: String(e.date).slice(5), segs: dStat.map((d) => ({ v: dBy(e, d.code).present + dBy(e, d.code).late, color: d.color })) }))} />
      <Legend items={dStat.map((d) => ({ label: d.code, color: d.color }))} /></View></Item>}

    <Item i={3}><View style={card}><Text style={[S.cardT, { marginBottom: 12 }]}>Most attended events</Text>
      {top.map((e, i) => <HBar key={e.id} i={i} color={pc} label={e.name} pct={pct(e)} sub={`${e.present} on time · ${e.late} late`} />)}</View></Item>

    <Item i={4}><View style={card}><Text style={[S.cardT, { marginBottom: 10 }]}>On time vs late (oldest to newest)</Text>
      <StackedCols rows={tr.map((e) => ({ key: e.id, label: String(e.date).slice(5), segs: [{ v: e.present, color: C.pri }, { v: e.late, color: C.amb }] }))} />
      <Legend items={[{ label: 'On time', color: C.pri }, { label: 'Late', color: C.amb }]} /></View></Item>

    {!has && <View style={[card, { backgroundColor: C.ambL, borderColor: C.amb }]}><Text style={{ fontWeight: '700' }}>Department charts are waiting for the database update</Text>
      <Text style={S.mut}>Run migration 20260105 in the Supabase SQL editor, then pull to refresh.</Text></View>}
    <Btn t="Export summary CSV" kind="out" icon="download-outline" onPress={share} /><Btn t="Refresh" kind="out" icon="refresh" onPress={q.run} style={{ marginTop: 8 }} />
  </ScrollView>;
}
