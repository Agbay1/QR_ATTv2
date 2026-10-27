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
import { Press, useShake, Float, Ring, Live, Count, Skel, Empty, Item, Btn, Field, Badge, useLoad, useLive, List, Filters, filt, toCsv, DeptPicker } from '../ui';
import { notify, scheduleReminder, initNotify } from '../notify';
import { Alert } from '../dialog';
import { queueScan, syncQueue } from '../offline';

/* ---------- auth ---------- */
export function Auth() {
  const [reg, setReg] = useState(false), [f, setF] = useState({ name: '', sno: '', email: '', pw: '', dept: '' }), [busy, setBusy] = useState(false), [msg, setMsg] = useState(null), [shake, go] = useShake(), [fp, setFp] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const fail = (e) => { setMsg({ e }); hap.bad(); go(); };
  if (fp) return <ResetScreen onBack={() => setFp(false)} />;
  const submit = async () => {                                                      // EVENT: Login / Register pressed
    const email = f.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Enter a valid email address.');
    if (f.pw.length < 6) return fail('Password must be at least 6 characters.');
    if (reg && !f.name.trim()) return fail('Full name is required.');
    if (reg && !f.dept) return fail('Pick your department.');
    setBusy(true); setMsg(null);
    const { data, error } = reg ? await supabase.auth.signUp({ email, password: f.pw, options: { data: { full_name: f.name.trim(), student_no: f.sno.trim(), department: f.dept } } })
      : await supabase.auth.signInWithPassword({ email, password: f.pw });
    setBusy(false);
    if (error) fail(error.message); else if (reg && !data.session) { setMsg({ ok: 'Account created. Check your email to confirm, then log in.' }); hap.ok(); }
  };
  return <LinearGradient colors={['#0C6FB5', '#0EA5E9', '#0EA5E9']} style={{ flex: 1 }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: TOP + 20, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}><Ring size={96} /><Animated.View entering={ZoomIn.springify()} style={S.logoBox}><Ionicons name="cloud" size={46} color={C.pri} /></Animated.View></View>
        <Animated.Text entering={FadeInUp.delay(200)} style={S.logo}>QR-ATT</Animated.Text>
        <Animated.Text entering={FadeInUp.delay(320)} style={S.sub}>Scan in. Float on. Done.</Animated.Text></View>
      <Animated.View entering={FadeInUp.delay(400).springify()} layout={LinearTransition.springify()} style={[S.authCard, shake]}>
        <Text style={S.title}>{reg ? 'Create your account' : 'Welcome back'}</Text>
        {reg && <Animated.View entering={FadeInDown} exiting={FadeOutUp}><Field icon="person-outline" placeholder="Full name" value={f.name} onChangeText={set('name')} autoCapitalize="words" />
          <Field icon="id-card-outline" placeholder="Student number (optional)" value={f.sno} onChangeText={set('sno')} />
          <DeptPicker value={f.dept} onChange={set('dept')} /></Animated.View>}
        <Field icon="mail-outline" placeholder="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" />
        <Field icon="lock-closed-outline" placeholder="Password" value={f.pw} onChangeText={set('pw')} secureTextEntry />
        {msg && <Animated.Text entering={FadeIn} exiting={FadeOut} style={msg.e ? S.err : S.okT}>{msg.e || msg.ok}</Animated.Text>}
        <Btn t={reg ? 'Create student account' : 'Log in'} icon={reg ? 'person-add' : 'log-in'} onPress={submit} busy={busy} />
        {!reg && <Press onPress={() => setFp(true)} style={{ alignSelf: 'center', padding: 10 }}><Text style={{ color: C.pri, fontWeight: '700' }}>Forgot password?</Text></Press>}
        <Btn t={reg ? 'I already have an account' : 'Register as a student'} kind="out" onPress={() => { setReg(!reg); setMsg(null); }} style={{ marginTop: 10 }} />
      </Animated.View></ScrollView></KeyboardAvoidingView></LinearGradient>;
}


function ResetScreen({ onBack }) {
  const [step, setStep] = useState(1), [email, setEmail] = useState(''), [code, setCode] = useState(''), [pw, setPw] = useState(''), [busy, setBusy] = useState(false), [msg, setMsg] = useState(null), [shake, go] = useShake();
  const fail = (e) => { setMsg({ e }); hap.bad(); go(); }, mail = email.trim().toLowerCase();
  const send = async () => {                                                        // EVENT: reset code requested
    if (!/^\S+@\S+\.\S+$/.test(mail)) return fail('Enter a valid email address.');
    setBusy(true); const { error } = await supabase.auth.resetPasswordForEmail(mail); setBusy(false);
    if (error) return fail(error.message); setMsg({ ok: 'We emailed you a code. Enter it below.' }); setStep(2);
  };
  const apply = async () => {                                                       // EVENT: new password submitted
    if (!/^\d{6,10}$/.test(code.trim())) return fail('Enter the numeric code from your email.');
    if (pw.length < 6) return fail('Password must be at least 6 characters.');
    setBusy(true); const { error } = await supabase.auth.verifyOtp({ email: mail, token: code.trim(), type: 'recovery' });
    if (error) { setBusy(false); return fail(error.message); }
    const { error: e2 } = await supabase.auth.updateUser({ password: pw }); setBusy(false); e2 ? fail(e2.message) : hap.ok();
  };
  return <LinearGradient colors={['#0C6FB5', '#0EA5E9', '#0EA5E9']} style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
    <Animated.View entering={FadeInUp.springify()} style={[S.authCard, shake]}>
      <Text style={S.title}>Reset password</Text>
      <Field icon="mail-outline" placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" editable={step === 1} />
      {step === 2 && <Animated.View entering={FadeInDown}><Field icon="keypad-outline" placeholder="Code from email" value={code} onChangeText={setCode} keyboardType="number-pad" />
        <Field icon="lock-closed-outline" placeholder="New password" value={pw} onChangeText={setPw} secureTextEntry /></Animated.View>}
      {msg && <Animated.Text entering={FadeIn} style={msg.e ? S.err : S.okT}>{msg.e || msg.ok}</Animated.Text>}
      <Btn t={step === 1 ? 'Send reset code' : 'Set new password'} icon="key" onPress={step === 1 ? send : apply} busy={busy} />
      <Btn t="Back to login" kind="out" onPress={onBack} style={{ marginTop: 10 }} /></Animated.View></LinearGradient>;
}
