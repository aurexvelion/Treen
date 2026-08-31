import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const STORAGE_KEY = 'treen_state_v1';

const C = {
  bg: '#07100B',
  panel: '#0E1A13',
  panel2: '#14231A',
  panel3: '#193022',
  line: '#284232',
  text: '#F3F7F4',
  muted: '#91A59A',
  green: '#76E39D',
  yellow: '#EACB72',
  red: '#FF8E8E',
};

type DayKey = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI';
type Pain = 'green' | 'yellow' | 'red';
type Tab = 'today' | 'week' | 'progress' | 'timer';

type Exercise = {
  name: string;
  detail: string;
  seconds?: number;
  reps?: number;
};

type Workout = {
  name: string;
  focus: string;
  duration: string;
  exercises: Exercise[];
};

type HistoryItem = {
  date: string;
  day: DayKey;
  workout: string;
  minutes: number;
};

type AppState = {
  completedDates: string[];
  history: HistoryItem[];
  weekIndex: number;
  pain: Pain;
  allowRunning: boolean;
};

const defaultState: AppState = {
  completedDates: [],
  history: [],
  weekIndex: 1,
  pain: 'green',
  allowRunning: false,
};

const PROGRESSIONS = [
  { run: 60, walk: 120, rounds: 10, label: '1 min jog / 2 min walk × 10' },
  { run: 60, walk: 60, rounds: 15, label: '1 min jog / 1 min walk × 15' },
  { run: 120, walk: 60, rounds: 10, label: '2 min jog / 1 min walk × 10' },
  { run: 180, walk: 60, rounds: 8, label: '3 min jog / 1 min walk × 8' },
  { run: 300, walk: 60, rounds: 6, label: '5 min jog / 1 min walk × 6' },
];

const WORKOUTS: Record<DayKey, Workout> = {
  MON: {
    name: 'Base Engine',
    focus: 'Easy aerobic conditioning',
    duration: '60–75 min',
    exercises: [
      { name: 'Warm-up walk', detail: 'Easy pace', seconds: 600 },
      { name: 'Walk / jog intervals', detail: 'Use the interval timer for your current progression week' },
      { name: 'Cool-down walk', detail: 'Easy pace', seconds: 900 },
    ],
  },
  TUE: {
    name: 'Legs + Core',
    focus: 'Strength endurance',
    duration: '60–75 min',
    exercises: [
      { name: 'Warm-up walk', detail: 'Easy pace', seconds: 600 },
      { name: 'Bodyweight squat', detail: '4 rounds', reps: 15 },
      { name: 'Glute bridge', detail: '4 rounds', reps: 15 },
      { name: 'Wall sit', detail: '4 rounds', seconds: 40 },
      { name: 'Plank', detail: '3 rounds', seconds: 40 },
      { name: 'Dead bug', detail: '3 rounds / side', reps: 10 },
      { name: 'Reverse crunch', detail: '3 rounds', reps: 12 },
      { name: 'Side plank', detail: '3 rounds / side', seconds: 25 },
      { name: 'Easy walk', detail: 'Relaxed finish', seconds: 1200 },
    ],
  },
  WED: {
    name: 'Long Easy',
    focus: 'Recovery + aerobic base',
    duration: '60–90 min',
    exercises: [
      { name: 'Brisk walk', detail: 'Comfortable pace. You should still be able to speak.', seconds: 4200 },
    ],
  },
  THU: {
    name: 'Intervals + Core',
    focus: 'Running progression + trunk',
    duration: '60–75 min',
    exercises: [
      { name: 'Warm-up walk', detail: 'Easy pace', seconds: 600 },
      { name: 'Walk / jog intervals', detail: 'Use the interval timer for your current progression week' },
      { name: 'Plank', detail: '3 rounds', seconds: 40 },
      { name: 'Dead bug', detail: '3 rounds / side', reps: 10 },
      { name: 'Reverse crunch', detail: '3 rounds', reps: 12 },
      { name: 'Cool-down walk', detail: 'Easy pace', seconds: 600 },
    ],
  },
  FRI: {
    name: 'Leg Endurance',
    focus: 'Legs + core without equipment',
    duration: '60–75 min',
    exercises: [
      { name: 'Warm-up walk', detail: 'Easy pace', seconds: 600 },
      { name: 'Bodyweight squat', detail: '4 rounds', reps: 20 },
      { name: 'Glute bridge', detail: '4 rounds', reps: 15 },
      { name: 'Wall sit', detail: '4 rounds', seconds: 50 },
      { name: 'Plank', detail: '4 rounds', seconds: 40 },
      { name: 'Easy walk', detail: 'Relaxed finish', seconds: 1500 },
    ],
  },
};

function todayKey(): DayKey {
  const day = new Date().getDay();
  return ({ 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI' } as Record<number, DayKey>)[day] ?? 'MON';
}

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Pill({ text, active, onPress }: { text: string; active?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{text}</Text>
    </TouchableOpacity>
  );
}

export default function App() {
  const [state, setState] = useState<AppState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [selectedDay, setSelectedDay] = useState<DayKey>(todayKey());
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const [timerSeconds, setTimerSeconds] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<'countdown' | 'interval'>('countdown');
  const [intervalPhase, setIntervalPhase] = useState<'WALK' | 'JOG'>('WALK');
  const [intervalRound, setIntervalRound] = useState(1);

  const sessionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setState({ ...defaultState, ...JSON.parse(raw) });
      } catch {
        setState(defaultState);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  useEffect(() => {
    if (!sessionOpen) {
      if (sessionRef.current) clearInterval(sessionRef.current);
      sessionRef.current = null;
      return;
    }
    sessionRef.current = setInterval(() => setSessionSeconds((s) => s + 1), 1000);
    return () => {
      if (sessionRef.current) clearInterval(sessionRef.current);
    };
  }, [sessionOpen]);

  const progression = PROGRESSIONS[Math.min(state.weekIndex, PROGRESSIONS.length) - 1];
  const canRun = state.allowRunning && state.pain === 'green';
  const workout = WORKOUTS[selectedDay];

  useEffect(() => {
    if (!timerRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    timerRef.current = setInterval(() => {
      setTimerSeconds((current) => {
        if (current > 1) return current - 1;

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

        if (timerMode === 'countdown') {
          setTimerRunning(false);
          return 0;
        }

        if (intervalPhase === 'WALK') {
          setIntervalPhase('JOG');
          return progression.run;
        }

        if (intervalRound >= progression.rounds) {
          setTimerRunning(false);
          Alert.alert('Intervals complete', 'Cool down with an easy walk.');
          return 0;
        }

        setIntervalRound((r) => r + 1);
        setIntervalPhase('WALK');
        return progression.walk;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, timerMode, intervalPhase, intervalRound, progression]);

  const totalMinutes = useMemo(
    () => state.history.reduce((sum, item) => sum + item.minutes, 0),
    [state.history],
  );

  const streak = useMemo(() => {
    const set = new Set(state.completedDates);
    let count = 0;
    const d = new Date();
    for (let i = 0; i < 30; i += 1) {
      if (set.has(dateKey(d))) count += 1;
      else if (i > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [state.completedDates]);

  function startSession() {
    if ((selectedDay === 'MON' || selectedDay === 'THU') && !canRun) {
      Alert.alert(
        'Walking mode active',
        state.pain === 'red'
          ? 'Pain is marked red. Keep this session to pain-free walking and non-provocative exercises.'
          : 'Jogging stays locked until calf status is green and running is manually unlocked.',
      );
    }
    setSessionSeconds(0);
    setSessionOpen(true);
  }

  function completeSession() {
    const key = dateKey();
    const minutes = Math.max(1, Math.round(sessionSeconds / 60));
    setState((s) => ({
      ...s,
      completedDates: Array.from(new Set([...s.completedDates, key])),
      history: [
        { date: key, day: selectedDay, workout: workout.name, minutes },
        ...s.history,
      ].slice(0, 100),
    }));
    setSessionOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  function startCountdown(seconds: number) {
    setTimerMode('countdown');
    setTimerSeconds(seconds);
    setTimerRunning(true);
  }

  function startIntervals() {
    if (!canRun) {
      Alert.alert('Jogging locked', 'Use brisk walking instead today.');
      return;
    }
    setTimerMode('interval');
    setIntervalPhase('WALK');
    setIntervalRound(1);
    setTimerSeconds(progression.walk);
    setTimerRunning(true);
  }

  if (!loaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.logo}>T.R.E.E.N.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (sessionOpen) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.kicker}>LIVE WORKOUT</Text>
          <Text style={styles.logo}>{workout.name}</Text>
          <Text style={styles.sessionClock}>{formatTime(sessionSeconds)}</Text>

          {(selectedDay === 'MON' || selectedDay === 'THU') && (
            <Card>
              <Text style={styles.cardTitle}>Cardio block</Text>
              <Text style={styles.muted}>{canRun ? progression.label : 'Brisk walking only'}</Text>
              <TouchableOpacity style={[styles.bigButton, !canRun && styles.bigButtonMuted]} onPress={startIntervals}>
                <Text style={styles.bigButtonText}>{canRun ? 'START INTERVAL TIMER' : 'JOGGING LOCKED'}</Text>
              </TouchableOpacity>
            </Card>
          )}

          {workout.exercises.map((exercise, index) => (
            <Card key={`${exercise.name}-${index}`}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <Text style={styles.muted}>{exercise.detail}</Text>
              <View style={styles.exerciseBottom}>
                <Text style={styles.exerciseMetric}>
                  {exercise.reps ? `${exercise.reps} reps` : exercise.seconds ? formatTime(exercise.seconds) : 'Follow plan'}
                </Text>
                {!!exercise.seconds && (
                  <TouchableOpacity style={styles.smallAction} onPress={() => startCountdown(exercise.seconds!)}>
                    <Text style={styles.smallActionText}>TIMER</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          ))}

          <TouchableOpacity style={styles.completeButton} onPress={completeSession}>
            <Text style={styles.completeText}>✓ COMPLETE WORKOUT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={() => setSessionOpen(false)}>
            <Text style={styles.ghostText}>Exit without completing</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>TRAINING ROUTINE • ENDURANCE • EXERCISE NAVIGATOR</Text>
          <Text style={styles.logo}>T.R.E.E.N.</Text>
        </View>
        <Text style={styles.tree}>▲</Text>
      </View>

      <View style={styles.tabs}>
        {(['today', 'week', 'progress', 'timer'] as Tab[]).map((item) => (
          <TouchableOpacity key={item} style={[styles.tab, tab === item && styles.tabActive]} onPress={() => setTab(item)}>
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'today' && (
          <>
            <View style={styles.pillRow}>
              {(['MON', 'TUE', 'WED', 'THU', 'FRI'] as DayKey[]).map((day) => (
                <Pill key={day} text={day} active={selectedDay === day} onPress={() => setSelectedDay(day)} />
              ))}
            </View>

            <Card>
              <Text style={styles.cardEyebrow}>{selectedDay} • {workout.focus}</Text>
              <Text style={styles.heroTitle}>{workout.name}</Text>
              <Text style={styles.muted}>{workout.duration}</Text>
              {(selectedDay === 'MON' || selectedDay === 'THU') && (
                <Text style={styles.progressionText}>Week {state.weekIndex}: {canRun ? progression.label : 'walking-only mode'}</Text>
              )}
              <TouchableOpacity style={styles.bigButton} onPress={startSession}>
                <Text style={styles.bigButtonText}>START WORKOUT</Text>
              </TouchableOpacity>
            </Card>

            <Card>
              <Text style={styles.cardTitle}>Calf check</Text>
              <Text style={styles.muted}>This only changes training mode. It is not a diagnosis.</Text>
              <View style={styles.pillRow}>
                <Pill text="🟢 Fine" active={state.pain === 'green'} onPress={() => setState((s) => ({ ...s, pain: 'green' }))} />
                <Pill text="🟡 Mild" active={state.pain === 'yellow'} onPress={() => setState((s) => ({ ...s, pain: 'yellow' }))} />
                <Pill text="🔴 Pain" active={state.pain === 'red'} onPress={() => setState((s) => ({ ...s, pain: 'red' }))} />
              </View>
              <TouchableOpacity
                style={[styles.toggleButton, state.allowRunning && styles.toggleButtonOn]}
                onPress={() => setState((s) => ({ ...s, allowRunning: !s.allowRunning }))}
              >
                <Text style={styles.toggleText}>{state.allowRunning ? 'RUNNING UNLOCKED' : 'RUNNING LOCKED'}</Text>
              </TouchableOpacity>
              <Text style={styles.warning}>
                If one calf is clearly swollen, hot/red, severely painful, or worsening at rest, do not train it and get medical assessment.
              </Text>
            </Card>
          </>
        )}

        {tab === 'week' && (
          <>
            <Card>
              <Text style={styles.cardTitle}>Current progression</Text>
              <Text style={styles.heroTitle}>Week {state.weekIndex}</Text>
              <Text style={styles.progressionText}>{progression.label}</Text>
              <View style={styles.weekControls}>
                <TouchableOpacity style={styles.smallAction} onPress={() => setState((s) => ({ ...s, weekIndex: Math.max(1, s.weekIndex - 1) }))}>
                  <Text style={styles.smallActionText}>− WEEK</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallAction} onPress={() => setState((s) => ({ ...s, weekIndex: Math.min(5, s.weekIndex + 1) }))}>
                  <Text style={styles.smallActionText}>+ WEEK</Text>
                </TouchableOpacity>
              </View>
            </Card>

            {(['MON', 'TUE', 'WED', 'THU', 'FRI'] as DayKey[]).map((day) => (
              <TouchableOpacity key={day} onPress={() => { setSelectedDay(day); setTab('today'); }}>
                <Card>
                  <Text style={styles.cardEyebrow}>{day}</Text>
                  <Text style={styles.cardTitle}>{WORKOUTS[day].name}</Text>
                  <Text style={styles.muted}>{WORKOUTS[day].focus} • {WORKOUTS[day].duration}</Text>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}

        {tab === 'progress' && (
          <>
            <View style={styles.statsRow}>
              <Card><Text style={styles.statNumber}>{state.history.length}</Text><Text style={styles.muted}>workouts</Text></Card>
              <Card><Text style={styles.statNumber}>{totalMinutes}</Text><Text style={styles.muted}>minutes</Text></Card>
              <Card><Text style={styles.statNumber}>{streak}</Text><Text style={styles.muted}>streak</Text></Card>
            </View>
            <Text style={styles.sectionTitle}>History</Text>
            {state.history.length === 0 ? (
              <Card><Text style={styles.muted}>No completed workouts yet.</Text></Card>
            ) : (
              state.history.map((item, index) => (
                <Card key={`${item.date}-${index}`}>
                  <View style={styles.historyRow}>
                    <View>
                      <Text style={styles.cardTitle}>{item.workout}</Text>
                      <Text style={styles.muted}>{item.date} • {item.day}</Text>
                    </View>
                    <Text style={styles.exerciseMetric}>{item.minutes} min</Text>
                  </View>
                </Card>
              ))
            )}
          </>
        )}

        {tab === 'timer' && (
          <>
            <Card>
              <Text style={styles.cardEyebrow}>
                {timerMode === 'interval' ? `${intervalPhase} • ROUND ${intervalRound}/${progression.rounds}` : 'MANUAL TIMER'}
              </Text>
              <Text style={styles.timerBig}>{formatTime(timerSeconds)}</Text>
              <TouchableOpacity style={styles.bigButton} onPress={() => setTimerRunning((running) => !running)}>
                <Text style={styles.bigButtonText}>{timerRunning ? 'PAUSE' : 'START'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostButton} onPress={() => { setTimerRunning(false); setTimerMode('countdown'); setTimerSeconds(60); }}>
                <Text style={styles.ghostText}>RESET</Text>
              </TouchableOpacity>
            </Card>

            <Text style={styles.sectionTitle}>Quick timers</Text>
            <View style={styles.quickGrid}>
              {[30, 40, 60, 90, 120, 300].map((seconds) => (
                <TouchableOpacity key={seconds} style={styles.quickTimer} onPress={() => startCountdown(seconds)}>
                  <Text style={styles.quickTimerText}>{seconds < 60 ? `${seconds}s` : `${seconds / 60}m`}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Card>
              <Text style={styles.cardTitle}>Cardio intervals</Text>
              <Text style={styles.muted}>Week {state.weekIndex}: {progression.label}</Text>
              <TouchableOpacity style={[styles.bigButton, !canRun && styles.bigButtonMuted]} onPress={startIntervals}>
                <Text style={styles.bigButtonText}>{canRun ? 'START INTERVALS' : 'JOGGING LOCKED'}</Text>
              </TouchableOpacity>
            </Card>
          </>
        )}

        <Text style={styles.footer}>T.R.E.E.N. // standalone // offline local data</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: C.green, maxWidth: 310 },
  logo: { fontSize: 31, fontWeight: '900', letterSpacing: 4, color: C.text, marginTop: 3 },
  tree: { fontSize: 30, color: C.green },
  tabs: { flexDirection: 'row', marginHorizontal: 12, backgroundColor: C.panel, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: C.line },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: C.panel3 },
  tabText: { fontSize: 10, fontWeight: '800', color: C.muted },
  tabTextActive: { color: C.text },
  content: { padding: 14, paddingBottom: 42, gap: 12 },
  card: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 15, gap: 8, flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  cardEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, color: C.green },
  heroTitle: { fontSize: 28, fontWeight: '900', color: C.text },
  muted: { fontSize: 12, color: C.muted, lineHeight: 18 },
  progressionText: { fontSize: 13, fontWeight: '800', color: C.yellow, marginTop: 3 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pill: { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 9 },
  pillActive: { backgroundColor: C.panel3, borderColor: C.green },
  pillText: { color: C.muted, fontWeight: '800', fontSize: 11 },
  pillTextActive: { color: C.text },
  bigButton: { marginTop: 8, backgroundColor: C.green, borderRadius: 15, paddingVertical: 14, alignItems: 'center' },
  bigButtonMuted: { backgroundColor: C.line },
  bigButtonText: { color: '#07100B', fontWeight: '900', letterSpacing: 0.8 },
  toggleButton: { marginTop: 5, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 13, alignItems: 'center', backgroundColor: C.panel2 },
  toggleButtonOn: { borderColor: C.green, backgroundColor: C.panel3 },
  toggleText: { color: C.text, fontWeight: '900' },
  warning: { fontSize: 10.5, lineHeight: 15, color: C.red, marginTop: 4 },
  sessionClock: { fontSize: 46, fontWeight: '900', color: C.green, marginVertical: 8 },
  exerciseName: { fontSize: 17, fontWeight: '900', color: C.text },
  exerciseBottom: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exerciseMetric: { fontSize: 16, fontWeight: '900', color: C.yellow },
  smallAction: { backgroundColor: C.panel3, borderWidth: 1, borderColor: C.line, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9 },
  smallActionText: { color: C.text, fontSize: 10, fontWeight: '900' },
  completeButton: { backgroundColor: C.green, borderRadius: 17, paddingVertical: 16, alignItems: 'center', marginTop: 5 },
  completeText: { color: '#07100B', fontWeight: '900', fontSize: 15 },
  ghostButton: { paddingVertical: 13, alignItems: 'center' },
  ghostText: { color: C.muted, fontWeight: '800' },
  weekControls: { flexDirection: 'row', gap: 8, marginTop: 6 },
  statsRow: { flexDirection: 'row', gap: 7 },
  statNumber: { fontSize: 27, fontWeight: '900', color: C.green },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: C.text, marginTop: 4 },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timerBig: { fontSize: 64, fontWeight: '900', color: C.text, textAlign: 'center', marginVertical: 8 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickTimer: { width: '30%', minWidth: 90, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  quickTimerText: { fontSize: 20, fontWeight: '900', color: C.text },
  footer: { textAlign: 'center', color: C.muted, fontSize: 10, marginTop: 6 },
});
