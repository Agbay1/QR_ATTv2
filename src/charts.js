import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedProps, withTiming, withDelay, Easing } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { C, S, LITE } from './theme';

/* Light on resources: bars and columns are plain Views animated with one shared value each.
   The donut is a few SVG arcs that each animate one number (strokeDashoffset). */
const dur = LITE ? 200 : 600;

export const Legend = ({ items }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
  {items.map((x) => <View key={x.label} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 4 }}>
    <View style={{ width: 10, height: 10, borderRadius: 3, marginRight: 6, backgroundColor: x.color }} /><Text style={{ fontSize: 13, color: C.mut, fontWeight: '600' }}>{x.label}</Text></View>)}</View>;

/* horizontal bar that fills from the left */
export function HBar({ label, pct, sub, color = C.pri, i = 0, dot }) {
  const w = useSharedValue(0); useEffect(() => { w.value = withDelay(LITE ? 0 : i * 70, withTiming(Math.min(100, Math.max(0, pct)), { duration: dur, easing: Easing.out(Easing.cubic) })); }, [pct]);
  const a = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return <View style={{ marginBottom: 14 }}>
    <View style={S.row}><View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>{!!dot && <View style={[S.dot, { backgroundColor: dot, marginRight: 8 }]} />}<Text style={[S.cardT, { fontSize: 15 }]} numberOfLines={1}>{label}</Text></View>
      <Text style={{ fontWeight: '900', fontSize: 16, color: C.ink }}>{pct}%</Text></View>
    <View style={S.track}><Animated.View style={[{ height: 10, borderRadius: 5, backgroundColor: color }, a]} /></View>
    {!!sub && <Text style={S.mut}>{sub}</Text>}</View>;
}

/* stacked column chart. rows: [{ label, segs: [{ v, color }] }] */
function Col({ r, i, max }) {
  const h = useSharedValue(0), tot = r.segs.reduce((s, x) => s + x.v, 0);
  useEffect(() => { h.value = withDelay(LITE ? 0 : i * 50, withTiming(max ? (tot / max) * 100 : 0, { duration: dur, easing: Easing.out(Easing.cubic) })); }, [tot, max]);
  const a = useAnimatedStyle(() => ({ height: `${Math.min(100, h.value)}%` }));
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
    <Text style={{ fontSize: 12, color: C.mut, fontWeight: '700' }}>{tot}</Text>
    <Animated.View style={[{ width: '58%', minHeight: 3, borderRadius: 5, overflow: 'hidden', flexDirection: 'column-reverse' }, a]}>
      {r.segs.map((x, k) => x.v > 0 ? <View key={k} style={{ flex: x.v, backgroundColor: x.color }} /> : null)}</Animated.View>
    <Text style={{ fontSize: 10, color: C.mut, marginTop: 4 }} numberOfLines={1}>{r.label}</Text></View>;
}
export const StackedCols = ({ rows, height = 150 }) => { const max = Math.max(1, ...rows.map((r) => r.segs.reduce((s, x) => s + x.v, 0)));
  return <View style={{ flexDirection: 'row', height }}>{rows.map((r, i) => <Col key={r.key || r.label + i} r={r} i={i} max={max} />)}</View>; };

/* donut: parts [{ v, color }], centre content as children */
const AC = Animated.createAnimatedComponent(Circle);
function Arc({ cx, r, sw, color, from, len, delay }) {
  const circ = 2 * Math.PI * r, p = useSharedValue(0);
  useEffect(() => { p.value = 0; p.value = withDelay(LITE ? 0 : delay, withTiming(1, { duration: dur + 50, easing: Easing.out(Easing.cubic) })); }, [len, from]);
  const ap = useAnimatedProps(() => ({ strokeDashoffset: circ - circ * len * p.value }));
  return <AC cx={cx} cy={cx} r={r} stroke={color} strokeWidth={sw} fill="none" strokeDasharray={[circ, circ]} animatedProps={ap} rotation={from * 360 - 90} origin={`${cx}, ${cx}`} />;
}
export function Donut({ parts, size = 130, sw = 18, children }) {
  const tot = parts.reduce((s, x) => s + x.v, 0) || 1, cx = size / 2, r = cx - sw / 2 - 1; let acc = 0;
  return <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={size} height={size}><Circle cx={cx} cy={cx} r={r} stroke={C.used} strokeWidth={sw} fill="none" />
      {parts.map((x, k) => { const len = x.v / tot, from = acc; acc += len; return len > 0 ? <Arc key={k} cx={cx} r={r} sw={sw} color={x.color} from={from} len={len} delay={k * 220} /> : null; })}</Svg>
    <View style={{ position: 'absolute', alignItems: 'center' }}>{children}</View></View>;
}
