import KeyboardAwareJournalScrollView from '../components/KeyboardAwareJournalScrollView';
import DotGridBackground from '../components/DotGridBackground';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, KeyboardAvoidingView, Platform, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import {
  getWellnessEntry, listWellnessRange, saveWellnessEntry,
  type WellnessEntry,
} from '../database/wellnessRepository';

const C = {
  paper: '#FAF7F0', card: '#FFFDF9', ink: '#454654',
  sage: '#90AE98', lavender: '#A9A3D7', pink: '#F7DDE6',
  line: '#E7E1D8', muted: '#8F8B90',
};

function dateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
}
function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
function shift(date: string, days: number): string {
  const result = parseDate(date);
  result.setDate(result.getDate() + days);
  return dateKey(result);
}
function minutesToText(value: number | null): string {
  if (value === null) return '';
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
function textToMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) throw new Error('Use HH:MM');
  const [hours, minutes] = trimmed.split(':').map(Number);
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes !== 0)) {
    throw new Error('Informe de 00:00 a 24:00');
  }
  return hours * 60 + minutes;
}
function inputMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}
function normalizeInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 2) return `${digits.padStart(2, '0')}:00`;
  if (digits.length === 3) return `0${digits[0]}:${digits.slice(1)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}
function getWeekDates(day: string): string[] {
  const base = parseDate(day);
  const offset = (base.getDay() + 6) % 7;
  base.setDate(base.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const next = new Date(base);
    next.setDate(base.getDate() + i);
    return dateKey(next);
  });
}

function Chart({ dates, entries }: { dates: string[]; entries: WellnessEntry[] }) {
  const byDate = new Map(entries.map((item) => [item.date, item]));
  const width = 330;
  const height = 188;
  const left = 30;
  const right = 9;
  const top = 15;
  const bottom = 31;
  const plotHeight = height - top - bottom;
  const plotWidth = width - left - right;
  const x = (index: number) => left + (index * plotWidth) / 6;
  const values = dates.flatMap((date) => {
    const item = byDate.get(date);
    return [item?.sleepMinutes, item?.screenMinutes].filter((v): v is number => v != null);
  });
  const maxHours = Math.max(8, Math.ceil(Math.max(0, ...values) / 60 / 2) * 2);
  const y = (minutes: number) => top + plotHeight * (1 - minutes / 60 / maxHours);

  function segments(field: 'sleepMinutes' | 'screenMinutes') {
    const paths: string[][] = [];
    let active: string[] = [];
    dates.forEach((date, index) => {
      const value = byDate.get(date)?.[field];
      if (value == null) {
        if (active.length) paths.push(active);
        active = [];
      } else {
        active.push(`${x(index)},${y(value)}`);
      }
    });
    if (active.length) paths.push(active);
    return paths;
  }

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.5, 1].map((fraction) => (
          <React.Fragment key={fraction}>
            <Line x1={left} x2={width - right} y1={top + fraction * plotHeight}
              y2={top + fraction * plotHeight} stroke={C.line} strokeWidth={1} />
            <SvgText x={left - 5} y={top + fraction * plotHeight + 4}
              textAnchor="end" fill={C.muted} fontSize={10}>
              {Math.round(maxHours * (1 - fraction))}h
            </SvgText>
          </React.Fragment>
        ))}
        {([
          { field: 'sleepMinutes', color: C.lavender },
          { field: 'screenMinutes', color: C.sage },
        ] as const).map(({ field, color }) => (
          <React.Fragment key={field}>
            {segments(field).map((points, idx) => (
              <Polyline key={idx} points={points.join(' ')} fill="none"
                stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
            ))}
            {dates.map((date, i) => {
              const value = byDate.get(date)?.[field];
              return value == null ? null : (
                <Circle key={date} cx={x(i)} cy={y(value)} r={3.5} fill={color} />
              );
            })}
          </React.Fragment>
        ))}
        {dates.map((date, index) => (
          <SvgText key={date} x={x(index)} y={height - 8} textAnchor="middle"
            fontSize={10} fill={C.muted}>
            {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'][index]}
          </SvgText>
        ))}
      </Svg>
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: C.lavender }]} />
        <Text style={styles.hint}>Sono</Text>
        <View style={[styles.legendDot, { backgroundColor: C.sage, marginLeft: 16 }]} />
        <Text style={styles.hint}>Tempo de tela</Text>
      </View>
    </View>
  );
}

export default function WellnessScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [sleep, setSleep] = useState('');
  const [screen, setScreen] = useState('');
  const [weekEntries, setWeekEntries] = useState<WellnessEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dates = getWeekDates(selectedDate);
  const load = useCallback(async (active: () => boolean) => {
    const [entry, records] = await Promise.all([
      getWellnessEntry(selectedDate),
      listWellnessRange(getWeekDates(selectedDate)[0], getWeekDates(selectedDate)[6]),
    ]);
    if (!active()) return;
    setSleep(minutesToText(entry.sleepMinutes));
    setScreen(minutesToText(entry.screenMinutes));
    setWeekEntries(records);
  }, [selectedDate]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void load(() => active).catch((err) => {
      console.error('Erro ao carregar bem-estar:', err);
      if (active) setError('Não foi possível carregar os registros.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [load]));

  async function save() {
    if (saving) return;
    let sleepMinutes: number | null;
    let screenMinutes: number | null;
    try {
      sleepMinutes = textToMinutes(normalizeInput(sleep));
      screenMinutes = textToMinutes(normalizeInput(screen));
    } catch (err) {
      Alert.alert('Horário inválido', err instanceof Error ? err.message : 'Verifique os valores.');
      return;
    }
    setSaving(true);
    try {
      await saveWellnessEntry({ date: selectedDate, sleepMinutes, screenMinutes });
      await load(() => true);
      Alert.alert('Salvo', 'Seus registros foram atualizados.');
    } catch (err) {
      console.error('Erro ao salvar bem-estar:', err);
      Alert.alert('Erro', 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  const mean = (key: 'sleepMinutes' | 'screenMinutes') => {
    const values = weekEntries.map((entry) => entry[key]).filter((v): v is number => v !== null);
    return values.length ? (values.reduce((a, b) => a + b, 0) / values.length / 60).toFixed(1) + ' h' : '—';
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DotGridBackground />
      <KeyboardAwareJournalScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>← Voltar</Text></Pressable>
        <Text style={styles.title}>Meu bem-estar ✿</Text>
        <Text style={styles.subtitle}>Sono e tempo de tela, um dia de cada vez.</Text>

        <View style={styles.card}>
          <View style={styles.dateRow}>
            <Pressable onPress={() => setSelectedDate(shift(selectedDate, -1))}>
              <Text style={styles.arrow}>‹</Text>
            </Pressable>
            <Text style={styles.dateText}>{parseDate(selectedDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
            <Pressable onPress={() => setSelectedDate(shift(selectedDate, 1))}>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          </View>
          {loading ? <ActivityIndicator color={C.sage} /> : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <>
              <Text style={styles.label}>Horas de sono</Text>
              <TextInput value={sleep} onChangeText={(v) => setSleep(inputMask(v))}
                onBlur={() => setSleep((v) => normalizeInput(v))}
                keyboardType="number-pad" placeholder="Ex.: 0730 → 07:30" style={styles.input} />
              <Text style={styles.label}>Tempo de tela</Text>
              <TextInput value={screen} onChangeText={(v) => setScreen(inputMask(v))}
                onBlur={() => setScreen((v) => normalizeInput(v))}
                keyboardType="number-pad" placeholder="Ex.: 0420 → 04:20" style={styles.input} />
              <Pressable disabled={saving} onPress={() => void save()} style={[styles.button, saving && { opacity: 0.5 }]}>
                <Text style={styles.buttonText}>{saving ? 'Salvando...' : 'Salvar registros'}</Text>
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Minha semana</Text>
          <Text style={styles.hint}>Segunda a domingo · valores informados manualmente</Text>
          <Chart dates={dates} entries={weekEntries} />
          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.hint}>Média de sono</Text><Text style={styles.statValue}>{mean('sleepMinutes')}</Text></View>
            <View style={styles.stat}><Text style={styles.hint}>Média de tela</Text><Text style={styles.statValue}>{mean('screenMinutes')}</Text></View>
          </View>
        </View>
        <Text style={styles.note}>Os dados são armazenados apenas no dispositivo. Campos vazios representam dados não registrados, não zero horas.</Text>
      </KeyboardAwareJournalScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  content: { padding: 20, paddingTop: 45, paddingBottom: 55 },
  back: { color: C.sage, fontWeight: '700', marginBottom: 22 },
  title: { color: C.ink, fontSize: 28, fontWeight: '800' },
  subtitle: { color: C.muted, fontSize: 13, marginTop: 6, marginBottom: 20 },
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 18 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  arrow: { fontSize: 32, color: C.sage, paddingHorizontal: 12 },
  dateText: { color: C.ink, fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },
  label: { color: C.ink, fontWeight: '700', fontSize: 13, marginBottom: 8 },
  input: { borderColor: C.line, borderWidth: 1, borderRadius: 12, padding: 13, color: C.ink, marginBottom: 16 },
  button: { backgroundColor: C.sage, borderRadius: 12, alignItems: 'center', padding: 15 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  sectionTitle: { color: C.ink, fontSize: 17, fontWeight: '700' },
  hint: { color: C.muted, fontSize: 11, marginTop: 5 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 15 },
  legendDot: { width: 9, height: 9, borderRadius: 5, marginRight: 6 },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: C.paper, borderRadius: 12, padding: 12 },
  statValue: { color: C.ink, fontWeight: '800', fontSize: 18, marginTop: 6 },
  note: { color: C.muted, fontSize: 12, lineHeight: 19 },
  error: { color: '#B45353' },
});
