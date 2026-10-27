import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, StyleSheet, ScrollView, Modal, StatusBar, KeyboardAvoidingView, Platform, Share } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut, FadeOutUp, ZoomIn, SlideInDown, LinearTransition, useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, withSequence, withDelay, interpolateColor, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from './src/supabase';
import { C, G, TOP, MSG, fmt, hap, pop, S } from './src/theme';
import { Press, useShake, Float, Ring, Live, Count, Skel, Empty, Item, Btn, Field, Badge, useLoad, useLive, List, Filters, filt, toCsv } from './src/ui';
import { notify, scheduleReminder, initNotify } from './src/notify';
import { Alert } from './src/dialog';
import { queueScan, syncQueue } from './src/offline';

import { Home } from './src/screens/Home';
import { Auth } from './src/screens/Auth';

/* ---------- root: session handling ---------- */
export default function App() {
  const [session, setSession] = useState(undefined), [profile, setProfile] = useState(null);
  useEffect(() => {
    initNotify();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));   // EVENT: auth state change
    return () => l.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => (data ? setProfile(data) : supabase.auth.signOut()));
  }, [session]);
  return <View style={{ flex: 1, backgroundColor: C.bg }}><StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
    {session === undefined || (session && !profile) ? <LinearGradient colors={G} style={S.center}><Float><Ionicons name="cloud" size={64} color="#fff" /></Float></LinearGradient>
      : session ? <Home profile={profile} setProfile={setProfile} /> : <Auth />}</View>;
}

