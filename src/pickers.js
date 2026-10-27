import React, { useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { C } from './theme';
import { Press, Btn } from './ui';
import { MONTHS, parseDate, parseTime, toIso, pad } from './dt';

/* In-app date + time pickers (12-hour time). Drawn as an overlay inside the current sheet,
   so no extra native packages are needed. */
const Overlay = ({ onClose, children }) => (
  <Animated.View entering={FadeIn.duration(150)} style={[StyleSheet.absoluteFill, { backgroundColor: '#0B335099', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 20 }]}>
    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
    <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 16, width: '100%', maxWidth: 360 }}>{children}</View>
  </Animated.View>
);

export function DatePicker({ value, onPick, onClose }) {
  const sel = parseDate(value), today = new Date(), base = sel || today;
  const [ym, setYm] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const first = new Date(ym.y, ym.m, 1).getDay(), days = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const go = (n) => setYm(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const same = (d, a) => a && a.getFullYear() === ym.y && a.getMonth() === ym.m && a.getDate() === d;
  return <Overlay onClose={onClose}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <Press onPress={() => go(-1)} style={{ padding: 8 }}><Ionicons name="chevron-back" size={22} color={C.ink} /></Press>
      <Text style={{ fontSize: 17, fontWeight: '800', color: C.ink }}>{MONTHS[ym.m]} {ym.y}</Text>
      <Press onPress={() => go(1)} style={{ padding: 8 }}><Ionicons name="chevron-forward" size={22} color={C.ink} /></Press>
    </View>
    <View style={{ flexDirection: 'row' }}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: C.mut, fontWeight: '700', fontSize: 12, marginBottom: 4 }}>{d}</Text>)}</View>
    {Array.from({ length: cells.length / 7 }, (_, r) => <View key={r} style={{ flexDirection: 'row' }}>{cells.slice(r * 7, r * 7 + 7).map((d, i) => {
      const on = d && same(d, sel), now = d && same(d, today);
      return <View key={i} style={{ flex: 1, aspectRatio: 1, padding: 2 }}>{d ? <Pressable onPress={() => onPick(toIso(new Date(ym.y, ym.m, d)))}
        style={{ flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.pri : 'transparent', borderWidth: now && !on ? 1.5 : 0, borderColor: C.pri }}>
        <Text style={{ fontWeight: '700', color: on ? '#fff' : C.ink }}>{d}</Text></Pressable> : null}</View>;
    })}</View>)}
    <View style={{ flexDirection: 'row', marginTop: 10 }}>
      <Btn small t="Today" kind="out" onPress={() => onPick(toIso(today))} style={{ flex: 1, marginRight: 8 }} />
      <Btn small t="Cancel" kind="out" onPress={onClose} style={{ flex: 1 }} /></View>
  </Overlay>;
}

const ROW = 44;
function Col({ items, value, onSelect, width = 72 }) {
  const ref = useRef(null), idx = Math.max(0, items.findIndex((x) => x.v === value));
  return <ScrollView ref={ref} style={{ height: ROW * 4, width }} showsVerticalScrollIndicator={false} nestedScrollEnabled
    onLayout={() => ref.current?.scrollTo({ y: Math.max(0, idx - 1) * ROW, animated: false })}>
    {items.map((x) => { const on = x.v === value; return <Pressable key={x.v} onPress={() => onSelect(x.v)}
      style={{ height: ROW, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: on ? C.pri : 'transparent' }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: on ? '#fff' : C.ink }}>{x.t}</Text></Pressable>; })}
  </ScrollView>;
}
export function TimePicker({ value, title = 'Set time', onPick, onClose }) {
  const p = parseTime(value), h24 = p && p !== 'AMBIG' ? Number(p.slice(0, 2)) : 8, mi0 = p && p !== 'AMBIG' ? Number(p.slice(3)) : 0;
  const [h, setH] = useState(h24 % 12 || 12), [mi, setMi] = useState(mi0), [ap, setAp] = useState(h24 < 12 ? 'AM' : 'PM');
  const hours = Array.from({ length: 12 }, (_, i) => ({ v: i + 1, t: String(i + 1) }));
  const mins = [...new Set([...Array.from({ length: 12 }, (_, i) => i * 5), mi0])].sort((a, b) => a - b).map((v) => ({ v, t: pad(v) }));
  return <Overlay onClose={onClose}>
    <Text style={{ fontSize: 17, fontWeight: '800', color: C.ink, textAlign: 'center', marginBottom: 8 }}>{title}</Text>
    <Text style={{ fontSize: 30, fontWeight: '900', color: C.pri, textAlign: 'center', marginBottom: 8 }}>{h}:{pad(mi)} {ap}</Text>
    <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>
      <Col items={hours} value={h} onSelect={setH} /><Text style={{ fontSize: 24, fontWeight: '900', color: C.mut }}>:</Text><Col items={mins} value={mi} onSelect={setMi} />
      <View>{['AM', 'PM'].map((x) => <Press key={x} onPress={() => setAp(x)} style={{ width: 64, height: 48, marginVertical: 4, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: ap === x ? C.pri : C.bg }}>
        <Text style={{ fontWeight: '800', fontSize: 16, color: ap === x ? '#fff' : C.ink }}>{x}</Text></Press>)}</View>
    </View>
    <View style={{ flexDirection: 'row', marginTop: 14 }}>
      <Btn small t="Cancel" kind="out" onPress={onClose} style={{ flex: 1, marginRight: 8 }} />
      <Btn small t="Set time" icon="checkmark" onPress={() => onPick(`${h}:${pad(mi)} ${ap}`)} style={{ flex: 1 }} /></View>
  </Overlay>;
}
