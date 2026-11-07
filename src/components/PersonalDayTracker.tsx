import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getPersonalDay,
  savePersonalDay,
  type Mood,
  type PersonalDay,
} from '../database/personalTrackingRepository';

export const MOOD_OPTIONS: { value: Mood; label: string; color: string }[] = [
  { value: 'great', label: 'Ótimo', color: '#75A9E2' },
  { value: 'good', label: 'Bom', color: '#90BF9B' },
  { value: 'neutral', label: 'Neutro', color: '#E9B36C' },
  { value: 'bad', label: 'Ruim', color: '#E28B8B' },
];

export default function PersonalDayTracker({ date }: { date: string }) {
  const [day, setDay] = useState<PersonalDay>({ date, mood: null, menstruating: false });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setReady(false);
    setDay({ date, mood: null, menstruating: false });
    void getPersonalDay(date).then((data) => {
      if (active) { setDay(data); setReady(true); }
    }).catch((error) => {
      console.error('Erro ao carregar registro pessoal:', error);
      if (active) Alert.alert('Erro', 'Não foi possível consultar o registro deste dia.');
    });
    return () => { active = false; };
  }, [date]);

  const persist = useCallback(async (next: PersonalDay) => {
    if (!ready || saving) return;
    const previous = day;
    setDay(next);
    setSaving(true);
    try {
      await savePersonalDay(next);
    } catch (error) {
      console.error('Erro ao salvar registro pessoal:', error);
      setDay(previous);
      Alert.alert('Erro', 'Não foi possível salvar o registro pessoal.');
    } finally {
      setSaving(false);
    }
  }, [day, ready, saving]);

  return (
    <View>
      <Text style={styles.helper}>Como foi o seu dia? Toque novamente para desmarcar.</Text>
      <View style={styles.options}>
        {MOOD_OPTIONS.map((option) => {
          const selected = day.mood === option.value;
          return (
            <Pressable key={option.value} disabled={!ready || saving}
              accessibilityRole="button" accessibilityState={{ selected, disabled: !ready || saving }}
              accessibilityLabel={`Humor ${option.label}`}
              onPress={() => void persist({ ...day, mood: selected ? null : option.value })}
              style={styles.option}>
              <View style={[styles.circle, { backgroundColor: option.color }, selected && styles.selected]}>
                {selected && <Text style={styles.check}>✓</Text>}
              </View>
              <Text style={styles.label}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable disabled={!ready || saving}
        accessibilityRole="checkbox" accessibilityState={{ checked: day.menstruating, disabled: !ready || saving }}
        accessibilityLabel="Marcar menstruação nesta data"
        onPress={() => void persist({ ...day, menstruating: !day.menstruating })}
        style={[styles.period, day.menstruating && styles.periodSelected]}>
        <Text style={[styles.heart, day.menstruating && styles.heartSelected]}>
          {day.menstruating ? '♥' : '♡'}
        </Text>
        {/* <View style={{ flex: 1 }}>
          <Text style={styles.periodTitle}>Menstruação</Text>
          <Text style={styles.helper}>{day.menstruating ? 'Marcado neste dia' : 'Toque para marcar este dia'}</Text>
        </View> */}
      </Pressable>
      <Text style={styles.privacy}>Registro opcional. Estes dados ficam no aparelho e também são incluídos em backups SQLite exportados.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  helper: { fontSize: 12, color: '#85818A', lineHeight: 18 },
  options: { flexDirection: 'row', justifyContent: 'space-between', gap: 4, marginTop: 14, marginBottom: 18 },
  option: { alignItems: 'center', flex: 1, gap: 6 },
  circle: { width: 37, height: 37, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  selected: { borderWidth: 3, borderColor: '#454654' },
  check: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  label: { color: '#454654', fontSize: 11 },
  period: { alignItems: 'center', padding: 13, borderRadius: 14, backgroundColor: '#FFF7F9', borderWidth: 1, borderColor: '#F3DEE5' },
  periodSelected: { backgroundColor: '#F7DDE6', borderColor: '#D69AAF', alignItems: 'center', justifyContent: 'center' },
  heart: { color: '#C48693', fontSize: 28 },
  heartSelected: { color: '#BF537B' },
  periodTitle: { color: '#454654', fontSize: 14, fontWeight: '700' },
  privacy: { fontSize: 10, lineHeight: 16, marginTop: 12, color: '#85818A' },
});
