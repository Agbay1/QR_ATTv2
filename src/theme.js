import { StyleSheet, Platform, StatusBar } from 'react-native';
import { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export const C = { bg: '#EAF6FF', ink: '#0B3350', mut: '#5F8199', pri: '#0EA5E9', amb: '#FBBF24', ok: '#10B981', err: '#EF4444', card: '#fff', line: '#CFE8F7',
  ambD: '#B45309', ambL: '#FEF3C7', okD: '#047857', errD: '#B91C1C', priL: '#D6EEFF', used: '#CBD5E1' };   // last row = additions
// LITE MODE: set true on free / low-end devices. Every spring becomes a 200 ms fade and the logo pulse is removed.
export const LITE = false;
export const G = ['#0369A1', '#38BDF8'], TOP = (Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44) + 12;
export const MSG = { INVALID_QR: 'Invalid QR code. This is not a QR-ATT event code.', EVENT_CLOSED: 'This event is closed. Attendance is no longer accepted.',
  DUPLICATE: 'Duplicate attendance. You are already recorded for this event.', UNAUTHORIZED: 'Unauthorized. Only student accounts can record attendance.',
  EXPIRED_QR: 'This QR code expired. Scan the live code on the teacher screen again.' };
export const fmt = (d) => new Date(d).toLocaleString();
export const hap = { thud: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), ok: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), bad: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error) };
export const pop = (i = 0) => (LITE ? FadeIn.duration(200) : FadeInDown.delay(Math.min(i, 6) * 70).springify().damping(14));   // stagger: max 6 items
export const DEPTS = [
  { code: 'CCS', name: 'College of Computer Studies', color: '#0369A1', fg: '#fff' },
  { code: 'CTE', name: 'College of Teacher Education', color: '#F97316', fg: '#fff' },
  { code: 'HMD', name: 'Hospitality Management Department', color: '#7C3AED', fg: '#fff' },
  { code: 'BED', name: 'Business / Entrepreneurship Department', color: '#EAB308', fg: '#0B3350' },
];
export const NA = { code: 'NA', name: 'No department', color: '#94A3B8', fg: '#0B3350' };
export const deptOf = (c) => DEPTS.find((d) => d.code === c) || NA;


export const S = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoBox: { width: 92, height: 92, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 12, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16 },
  logo: { fontSize: 40, fontWeight: '900', color: '#fff', letterSpacing: 2, marginTop: 18 }, sub: { color: '#E0F4FF', fontSize: 16, marginTop: 2 },
  authCard: { backgroundColor: '#fff', borderRadius: 23, padding: 22, elevation: 10, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20 },
  head: { paddingTop: TOP, paddingHorizontal: 18, paddingBottom: 18, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  hTitle: { fontSize: 30, fontWeight: '900', color: '#fff' }, hSub: { color: '#E0F4FF', marginTop: 2 },
  tile: { flex: 1, backgroundColor: '#FFFFFF24', borderRadius: 16, padding: 12, marginHorizontal: 4, borderWidth: 1, borderColor: '#FFFFFF30' },
  tileN: { fontSize: 26, fontWeight: '900', color: '#fff' }, tileL: { color: '#E0F4FF', fontSize: 12, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '900', color: C.ink, marginBottom: 14 }, mut: { color: C.mut, marginTop: 2 },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3FAFF', borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12, marginBottom: 10, height: 52 },
  fin: { flex: 1, marginLeft: 10, fontSize: 16, color: C.ink },
  btn: { borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, out: { borderWidth: 1.5, borderColor: C.pri }, brow: { flexDirection: 'row', alignItems: 'center' }, bt: { fontWeight: '800', fontSize: 16 },
  card: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 12, elevation: 3, shadowColor: '#0EA5E9', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  bar: { width: 5, borderRadius: 3, marginRight: 12 }, cardT: { fontSize: 17, fontWeight: '800', color: C.ink, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  err: { color: C.err, marginBottom: 10, fontWeight: '600' }, okT: { color: '#047857', marginBottom: 10, fontWeight: '600' }, empty: { color: C.mut, textAlign: 'center', marginTop: 12, fontSize: 16 },
  skel: { height: 92, borderRadius: 18, backgroundColor: '#D4E9F7', marginBottom: 12 },
  big: { fontSize: 32, fontWeight: '900', color: '#fff', marginTop: 8 }, resT: { color: '#fff', fontSize: 16, textAlign: 'center', marginVertical: 14, opacity: 0.95 },
  resCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  hint: { marginTop: 28, backgroundColor: '#0B3350CC', color: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 19, overflow: 'hidden', fontWeight: '700' },
  tabs: { position: 'absolute', left: 16, right: 16, bottom: Platform.OS === 'android' ? 30 : 18, flexDirection: 'row', backgroundColor: '#fff', borderRadius: 22, height: 66, elevation: 14, shadowColor: '#0369A1', shadowOpacity: 0.25, shadowRadius: 16 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' }, ind: { position: 'absolute', top: 0, bottom: 0, padding: 5 }, indIn: { flex: 1, borderRadius: 21 },
  qrBox: { padding: 14, backgroundColor: '#fff', borderRadius: 19, borderWidth: 2, borderColor: C.line }, sumN: { fontSize: 38, fontWeight: '900', color: C.pri },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5, borderColor: C.line, marginRight: 8 },
  avatarS: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#D6EEFF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, avT: { color: C.pri, fontWeight: '900', fontSize: 18 },
  avatarL: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' }, avTL: { color: '#fff', fontWeight: '900', fontSize: 36 },
  timer: { width: 200, height: 6, borderRadius: 3, backgroundColor: '#DCEBF5', marginTop: 12, overflow: 'hidden' }, timerIn: { height: 6, backgroundColor: C.amb, borderRadius: 3 },
  pend: { color: '#fff', backgroundColor: '#F59E0B', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 8, fontWeight: '700', overflow: 'hidden' },
  track: { height: 10, borderRadius: 5, backgroundColor: '#DCEBF5', marginVertical: 6 },
  /* additions: shared bits */
  lbl: { color: C.mut, fontWeight: '700', marginBottom: 6, marginLeft: 2 },
  dept: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: C.line, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  /* boarding-pass style event ticket: date block, dashed tear line with two notches, details */
  ticket: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 16, marginBottom: 12, elevation: 3, shadowColor: '#0EA5E9', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  ticketUsed: { backgroundColor: '#F1F6FA', elevation: 0, shadowOpacity: 0 },
  stub: { width: 76, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderTopLeftRadius: 16, borderBottomLeftRadius: 16, overflow: 'hidden' },
  stubM: { fontSize: 14, fontWeight: '800', color: '#FDE68A' }, stubD: { fontSize: 34, lineHeight: 38, fontWeight: '900', color: '#fff' }, stubW: { fontSize: 13, fontWeight: '700', color: '#E0F4FF' },
  tear: { width: 1, overflow: 'hidden' },
  tearIn: { position: 'absolute', top: -2, bottom: -2, left: 0, width: 3, borderWidth: 1, borderStyle: 'dashed', borderColor: '#9CC3DA' },
  notch: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: C.bg },
  tBody: { flex: 1, padding: 12, paddingLeft: 14 }, tTime: { fontSize: 17, fontWeight: '900', color: C.ink, marginTop: 6 },
  closedStamp: { borderWidth: 2, borderColor: C.err, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1, transform: [{ rotate: '-8deg' }], marginLeft: 8 },
  closedT: { fontSize: 13, fontWeight: '900', color: C.err },
  /* scan result pass + stamp */
  pass: { alignSelf: 'stretch', maxWidth: 360, backgroundColor: '#fff', borderRadius: 20, minHeight: 230, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14 },
  passStrip: { height: 12 }, passIn: { padding: 18, paddingBottom: 96 }, passLbl: { color: C.mut, fontWeight: '700' }, passName: { fontSize: 24, fontWeight: '900', color: C.ink, marginTop: 4 },
  resT2: { color: C.ink, fontSize: 15, marginTop: 10 },
  stampBox: { borderWidth: 4, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 4 }, stampT: { fontSize: 34, fontWeight: '900' },
  /* lanyard pass (teacher QR) */
  strap: { width: 26, height: 44, backgroundColor: C.pri, marginBottom: -16, alignItems: 'center' }, strapStripe: { width: 6, flex: 1, backgroundColor: C.amb },
  lan: { alignSelf: 'stretch', maxWidth: 340, backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', elevation: 6, shadowColor: '#0369A1', shadowOpacity: 0.2, shadowRadius: 12 },
  slot: { alignSelf: 'center', width: 44, height: 10, borderRadius: 5, backgroundColor: C.line, marginTop: 8 },
  lanHead: { backgroundColor: C.pri, padding: 14, marginTop: 8 }, lanName: { fontSize: 21, fontWeight: '900', color: '#fff' }, lanSub: { color: '#E0F4FF', marginTop: 2 },
  lanFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: '#F3FAFF' },
  /* student ID card */
  idCard: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', marginBottom: 14, elevation: 4, shadowColor: '#0EA5E9', shadowOpacity: 0.15, shadowRadius: 10 },
  idHead: { backgroundColor: C.pri, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  idBrand: { fontSize: 18, fontWeight: '900', color: '#fff' }, idRole: { fontWeight: '800', color: '#FDE68A' },
  idBody: { flexDirection: 'row', alignItems: 'center', padding: 16 }, photo: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  idName: { fontSize: 22, fontWeight: '900', color: C.ink }, idStripe: { height: 10, backgroundColor: C.amb },
});
