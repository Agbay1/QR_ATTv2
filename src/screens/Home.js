import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, StyleSheet, ScrollView, Modal, StatusBar, KeyboardAvoidingView, Platform, Share } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, FadeOutUp, ZoomIn, SlideInDown, LinearTransition, useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, withSequence, withDelay, interpolateColor, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../supabase';
import { C, G, TOP, MSG, fmt, hap, pop, S } from '../theme';
import { Press, useShake, Float, Ring, Live, Count, Skel, Empty, Item, Btn, Field, Badge, useLoad, useLive, List, Filters, filt, toCsv } from '../ui';
import { notify, scheduleReminder, initNotify } from '../notify';
import { Alert } from '../dialog';
import { queueScan, syncQueue } from '../offline';

import { StudentEvents, History, Scan } from './Student';
import { StaffEvents } from './Staff';
import { Users, Analytics } from './Admin';
import { Profile } from './Profile';

/* ---------- home: header stats + animated tabs ---------- */
export const ICON = {'Stats': 'stats-chart', 'Events': 'sunny', 'Scan': 'scan', 'History': 'time', 'Users': 'people', 'Profile': 'person'};
export function TabBar({ tabs, tab, setTab }) {
  const [w, setW] = useState(0), tw = w / tabs.length, i = tabs.indexOf(tab);
  const ind = useAnimatedStyle(() => ({ width: tw, transform: [{ translateX: withSpring(i * tw, { damping: 15, stiffness: 140 }) }] }));
  return <Animated.View entering={SlideInDown.delay(300).springify()} style={S.tabs} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
    <Animated.View style={[S.ind, ind]}><LinearGradient colors={G} style={S.indIn} /></Animated.View>
    {tabs.map((t) => <TabBtn key={t} t={t} on={t === tab} onPress={() => setTab(t)} />)}</Animated.View>;
}
export function TabBtn({ t, on, onPress }) {
  const a = useAnimatedStyle(() => ({ transform: [{ scale: withSpring(on ? 1.18 : 1) }, { translateY: withSpring(on ? -2 : 0) }] }));
  return <Press style={S.tab} onPress={onPress}><Animated.View style={[{ alignItems: 'center' }, a]}>
    <Ionicons name={on ? ICON[t] : ICON[t] + '-outline'} size={22} color={on ? '#fff' : C.mut} /><Text style={{ fontSize: 11, fontWeight: '700', color: on ? '#fff' : C.mut }}>{t}</Text></Animated.View></Press>;
}
export function Home({ profile, setProfile }) {
  const tabsBy = { student: ['Events', 'Scan', 'History', 'Profile'], teacher: ['Events', 'Stats', 'Profile'], admin: ['Events', 'Stats', 'Users', 'Profile'] };
  const tabs = tabsBy[profile.role] || ['Profile'], [tab, setTab] = useState(tabs[0]), [st, setSt] = useState(null), staff = profile.role !== 'student';
  const [pend, setPend] = useState(0);
  useEffect(() => {                                                                 // EVENT: connection back -> offline queue syncs
    if (profile.role !== 'student') return;
    const run = async () => { const r = await syncQueue(); setPend(r.left);
      r.done.forEach((d) => notify(d.ok ? (d.status === 'late' ? 'Late attendance synced' : 'Attendance synced') : 'Offline scan rejected', d.ok ? d.name : d.msg)); if (r.done.length) setTab((t) => t + ''); };
    run(); const id = setInterval(run, 15000); return () => clearInterval(id);
  }, []);
  useLive('events', (p) => {                                                        // EVENT: event added / changed -> notification
    if (profile.role !== 'student') return;
    if (p.eventType === 'INSERT') notify('New event', p.new.name);
    else if (p.eventType === 'UPDATE') notify('Event changed', p.new.status !== p.old?.status ? `${p.new.name} is now ${p.new.status}.` : `${p.new.name} was updated.`);
  });
  useEffect(() => {                                                                 // EVENT: end time reached -> event closes itself (needs migration 20260104; harmless without it)
    const sweep = () => supabase.rpc('close_expired_events').then(() => {}, () => {});
    sweep(); const id = setInterval(sweep, 60000); return () => clearInterval(id);
  }, []);
  useEffect(() => { supabase.rpc('dashboard_stats').then(({ data }) => data && setSt(data)); }, [tab]);
  const tiles = staff ? [['Events', st?.events], ['Open now', st?.open_events], ['Check-ins', st?.attendance]] : [['Open now', st?.open_events], ['My check-ins', st?.my_attendance], ['Attendance', st?.rate, '%']];
  return <View style={{ flex: 1 }}>
    <LinearGradient colors={G} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.head}>
      <Animated.View key={tab} entering={FadeInDown.springify()}><Text style={S.hTitle}>{tab}</Text><Text style={S.hSub}>{profile.full_name} · {profile.role}</Text></Animated.View>
      {pend > 0 && <Text style={S.pend}>{pend} offline scan(s) waiting to sync</Text>}
      <View style={[S.row, { marginTop: 14 }]}>{tiles.map(([l, v, sx], i) => <Animated.View key={l} entering={ZoomIn.delay(150 + i * 100).springify()} style={S.tile}>
        <Count to={v || 0} suffix={sx} style={S.tileN} /><Text style={S.tileL}>{l}</Text></Animated.View>)}</View></LinearGradient>
    <Animated.View key={tab} entering={FadeIn.duration(280)} style={{ flex: 1 }}>
      {tab === 'Events' && (staff ? <StaffEvents profile={profile} /> : <StudentEvents />)}
      {tab === 'Scan' && <Scan />}{tab === 'History' && <History />}{tab === 'Users' && <Users me={profile} />}{tab === 'Stats' && <Analytics />}
      {tab === 'Profile' && <Profile profile={profile} setProfile={setProfile} />}</Animated.View>
    <TabBar tabs={tabs} tab={tab} setTab={setTab} /></View>;
}

