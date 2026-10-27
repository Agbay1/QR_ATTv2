import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, StyleSheet, ScrollView, Modal, StatusBar, KeyboardAvoidingView, Platform, Share } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, FadeOutUp, ZoomIn, SlideInDown, LinearTransition, useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, withSequence, withDelay, interpolateColor, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../supabase';
import { C, G, TOP, MSG, fmt, hap, pop, S, LITE, deptOf } from '../theme';
import { Press, useShake, Float, Ring, Live, Count, Skel, Empty, Item, Btn, Field, Badge, useLoad, useLive, List, Filters, filt, toCsv, DeptPicker } from '../ui';
import { notify, scheduleReminder, initNotify } from '../notify';
import { Alert } from '../dialog';
import { queueScan, syncQueue } from '../offline';

const ROLE = { student: 'Student ID', teacher: 'Teacher ID', admin: 'Admin ID' };
export function Profile({ profile, setProfile }) {
  const hasDept = 'department' in profile;                                           // false until the department migration is run
  const [name, setName] = useState(profile.full_name), [dept, setDept] = useState(profile.department || ''), [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) return Alert.alert('Name required', 'Enter your full name.');
    const row = { full_name: name.trim(), ...(hasDept && dept ? { department: dept } : {}) };
    setBusy(true); const { data, error } = await supabase.from('profiles').update(row).eq('id', profile.id).select().single(); setBusy(false);
    error ? Alert.alert('Error', error.message) : (hap.ok(), setProfile(data), Alert.alert('Saved', 'Profile updated.'));
  };
  const [pw, setPw] = useState('');
  const changePw = async () => {                                                    // EVENT: password changed
    if (pw.length < 6) return Alert.alert('Too short', 'Password must be at least 6 characters.');
    const { error } = await supabase.auth.updateUser({ password: pw }); error ? Alert.alert('Error', error.message) : (hap.ok(), setPw(''), Alert.alert('Saved', 'Password changed.'));
  };
  const d = profile.department ? deptOf(profile.department) : null;
  return <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
    <Animated.View entering={pop(0)} style={S.idCard}>
      <View style={S.idHead}><Text style={S.idBrand}>QR-ATT</Text><Text style={S.idRole}>{ROLE[profile.role] || 'ID'}</Text></View>
      <View style={S.idBody}>
        <Animated.View entering={LITE ? FadeIn.duration(200) : ZoomIn.delay(150).springify()}><LinearGradient colors={G} style={S.photo}><Text style={S.avTL}>{profile.full_name?.[0]?.toUpperCase()}</Text></LinearGradient></Animated.View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={S.idName} numberOfLines={2}>{profile.full_name}</Text>
          <Text style={S.mut}>{profile.student_no || 'No student number'}</Text>
          {d && <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}><View style={[S.dot, { backgroundColor: d.color }]} /><Text style={{ flex: 1, fontWeight: '600', fontSize: 13 }}>{d.name}</Text></View>}</View></View>
      <View style={S.idStripe} /></Animated.View>
    <Animated.View entering={pop(1)}><Field icon="person-outline" placeholder="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
      {hasDept && <DeptPicker value={dept} onChange={setDept} />}<Btn t="Save profile" icon="save" onPress={save} busy={busy} style={{ marginTop: 4 }} /></Animated.View>
    <Animated.View entering={pop(2)} style={{ marginTop: 18 }}><Field icon="key-outline" placeholder="New password (min 6)" value={pw} onChangeText={setPw} secureTextEntry /><Btn t="Change password" kind="out" icon="key" onPress={changePw} /></Animated.View>
    <Animated.View entering={pop(3)}><Btn t="Log out" kind="out" icon="log-out-outline" onPress={() => supabase.auth.signOut()} style={{ marginTop: 10 }} /></Animated.View></ScrollView>;   // EVENT: logout
}
