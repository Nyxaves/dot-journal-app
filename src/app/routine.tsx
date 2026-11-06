import DotGridBackground from '../components/DotGridBackground';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import {
  deleteRoutineBlock, formatRoutineTime, listRoutineBlocks,
  parseRoutineTime, routineDuration, routineSegments, saveRoutineBlock,
  type RoutineBlock, type RoutineCategory,
} from '../database/routineRepository';

const C = {
  paper: '#FAF7F0', card: '#FFFDF9', ink: '#454654', sage: '#90AE98',
  line: '#E7E1D8', muted: '#8F8B90', pink: '#F7DDE6',
};
const CATEGORIES: { key: RoutineCategory; label: string; color: string }[] = [
  { key: 'sleep', label: 'Sono', color: '#A9A3D7' },
  { key: 'work', label: 'Trabalho', color: '#90AE98' },
  { key: 'study', label: 'Estudos', color: '#E4B0C2' },
  { key: 'leisure', label: 'Lazer', color: '#EECF9D' },
  { key: 'health', label: 'Saúde', color: '#A8CADB' },
  { key: 'other', label: 'Outros', color: '#B9B7AE' },
];

function clockTimeInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}
function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m ? ` ${String(m).padStart(2, '0')}min` : ''}`;
}

function RoutineClock({ blocks }: { blocks: RoutineBlock[] }) {
  const size = 320;
  const center = size / 2;
  const radius = 108;
  const circumference = 2 * Math.PI * radius;
  const used = blocks.reduce((sum, block) => sum + routineDuration(block), 0);
  const arcs = blocks.flatMap((block) => routineSegments(block).map(([start, end], index) => ({
    key: `${block.id}-${index}`, start, end, color: block.color,
  })));
  return (
    <View style={styles.clockBox}>
      <Svg width="100%" height={320} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={center} cy={center} r={radius} stroke="#EAE6DF" strokeWidth={36} fill="none" />
        {arcs.map((arc) => (
          <Circle
            key={arc.key}
            cx={center} cy={center} r={radius}
            stroke={arc.color} strokeWidth={36} fill="none"
            strokeDasharray={`${((arc.end - arc.start) / 1440) * circumference} ${circumference}`}
            strokeDashoffset={-(arc.start / 1440) * circumference}
            rotation={-90} origin={`${center}, ${center}`}
          />
        ))}
        {Array.from({ length: 24 }, (_, h) => {
          const angle = (h / 24) * 2 * Math.PI - Math.PI / 2;
          return (
            <SvgText key={h} x={center + 143 * Math.cos(angle)}
              y={center + 143 * Math.sin(angle) + 3}
              fill={C.muted} fontSize={h % 3 === 0 ? 12 : 9}
              textAnchor="middle" fontWeight={h % 3 === 0 ? 'bold' : 'normal'}>
              {h}
            </SvgText>
          );
        })}
        <SvgText x={center} y={center - 10} textAnchor="middle" fill={C.muted} fontSize={12}>
          Tempo planejado
        </SvgText>
        <SvgText x={center} y={center + 19} textAnchor="middle" fill={C.ink} fontWeight="bold" fontSize={26}>
          {durationLabel(used)}
        </SvgText>
        <SvgText x={center} y={center + 42} textAnchor="middle" fill={C.muted} fontSize={11}>
          Livre: {durationLabel(1440 - used)}
        </SvgText>
      </Svg>
      <Text style={styles.hint}>00h no topo · sentido horário · áreas bege = sem atividade definida</Text>
    </View>
  );
}

export default function RoutineScreen() {
  const router = useRouter();
  const [blocks, setBlocks] = useState<RoutineBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [category, setCategory] = useState<RoutineCategory>('work');
  const chosen = useMemo(() => CATEGORIES.find((item) => item.key === category) ?? CATEGORIES[0], [category]);

  const reload = useCallback(async () => {
    setBlocks(await listRoutineBlocks());
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listRoutineBlocks().then((items) => { if (active) setBlocks(items); })
      .catch((err) => { console.error(err); if (active) setError('Não foi possível carregar a rotina.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  function resetForm() {
    setTitle(''); setStart(''); setEnd(''); setCategory('work'); setEditingId(null);
  }
  function edit(block: RoutineBlock) {
    setEditingId(block.id);
    setTitle(block.title); setStart(formatRoutineTime(block.startMinute));
    setEnd(formatRoutineTime(block.endMinute)); setCategory(block.category);
  }
  async function save() {
    if (saving) return;
    let startMinute: number;
    let endMinute: number;
    try {
      startMinute = parseRoutineTime(start);
      endMinute = parseRoutineTime(end, true);
    } catch (err) {
      Alert.alert('Horário inválido', err instanceof Error ? err.message : 'Confira os horários.');
      return;
    }
    setSaving(true);
    try {
      await saveRoutineBlock({ title, startMinute, endMinute, category, color: chosen.color }, editingId ?? undefined);
      await reload();
      resetForm();
    } catch (err) {
      console.error(err);
      Alert.alert('Não foi possível salvar', err instanceof Error ? err.message : 'Tente novamente.');
    } finally { setSaving(false); }
  }
  function confirmDelete(block: RoutineBlock) {
    Alert.alert('Excluir atividade?', `Remover “${block.title}” da rotina?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => {
        if (saving) return;
        setSaving(true);
        void deleteRoutineBlock(block.id).then(async () => {
          await reload();
          if (editingId === block.id) resetForm();
        }).catch((err) => {
          console.error(err); Alert.alert('Erro', 'Não foi possível excluir a atividade.');
        }).finally(() => setSaving(false));
      } },
    ]);
  }

  return (
    <View style={styles.container}>
      <DotGridBackground />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>← Voltar ao diário</Text></Pressable>
        <Text style={styles.heading}>Minha rotina 24h ✿</Text>
        <Text style={styles.subtitle}>Visualize como seu tempo está distribuído.</Text>
        <View style={styles.card}>
          {loading ? <ActivityIndicator color={C.sage} /> : error ?
            <Text style={styles.error}>{error}</Text> : <RoutineClock blocks={blocks} />}
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{editingId ? 'Editar atividade' : 'Adicionar atividade'}</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle}
            placeholder="Ex.: Trabalho, sono, estudos..." placeholderTextColor={C.muted} maxLength={80} />
          <Text style={styles.label}>Categoria</Text>
          <View style={styles.categories}>
            {CATEGORIES.map((item) => (
              <Pressable key={item.key} onPress={() => setCategory(item.key)}
                style={[styles.category, category === item.key && { backgroundColor: item.color, borderColor: item.color }]}>
                <Text style={styles.categoryText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.timeRow}>
            <View style={styles.timeColumn}>
              <Text style={styles.label}>Início</Text>
              <TextInput style={styles.input} value={start} onChangeText={(value) => setStart(clockTimeInput(value))}
                keyboardType="number-pad" placeholder="Ex.: 800" placeholderTextColor={C.muted} maxLength={5}
                onBlur={() => { try { if (start) setStart(formatRoutineTime(parseRoutineTime(start))); } catch { /* validate on save */ } }} />
            </View>
            <View style={styles.timeColumn}>
              <Text style={styles.label}>Fim</Text>
              <TextInput style={styles.input} value={end} onChangeText={(value) => setEnd(clockTimeInput(value))}
                keyboardType="number-pad" placeholder="Ex.: 1800" placeholderTextColor={C.muted} maxLength={5}
                onBlur={() => { try { if (end) setEnd(formatRoutineTime(parseRoutineTime(end, true))); } catch { /* validate on save */ } }} />
            </View>
          </View>
          <Text style={styles.hint}>Digite 800 → 08:00. Horários que passam da meia-noite são aceitos, ex.: 22:00–06:00.</Text>
          <Pressable style={[styles.saveButton, (saving || loading || !title.trim() || !start || !end) && styles.disabled]}
            disabled={saving || loading || !title.trim() || !start || !end} onPress={() => void save()}>
            <Text style={styles.saveText}>{saving ? 'Salvando...' : editingId ? 'Salvar alterações' : '+ Adicionar à rotina'}</Text>
          </Pressable>
          {editingId && <Pressable onPress={resetForm}><Text style={styles.cancel}>Cancelar edição</Text></Pressable>}
        </View>
        <Text style={styles.sectionTitle}>Atividades cadastradas</Text>
        {blocks.length === 0 && !loading && !error && <Text style={styles.hint}>Sua rotina está vazia. Adicione seu primeiro bloco de horário.</Text>}
        {blocks.map((block) => (
          <View key={block.id} style={styles.blockRow}>
            <View style={[styles.colorMarker, { backgroundColor: block.color }]} />
            <View style={styles.blockInfo}>
              <Text style={styles.blockTitle}>{block.title}</Text>
              <Text style={styles.blockMeta}>{formatRoutineTime(block.startMinute)} – {formatRoutineTime(block.endMinute)} · {durationLabel(routineDuration(block))}</Text>
            </View>
            <Pressable disabled={saving} onPress={() => edit(block)}><Text style={styles.action}>Editar</Text></Pressable>
            <Pressable disabled={saving} onPress={() => confirmDelete(block)}><Text style={styles.delete}>Excluir</Text></Pressable>
          </View>
        ))}
        <Text style={styles.hint}>Este é seu modelo de rotina padrão, utilizado em todos os dias. As horas não ocupadas permanecem livres.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  content: { padding: 20, paddingTop: 44, paddingBottom: 50 },
  back: { color: C.sage, fontWeight: '700', marginBottom: 22 },
  heading: { fontSize: 28, fontWeight: '800', color: C.ink },
  subtitle: { color: C.muted, fontSize: 13, marginTop: 6, marginBottom: 20 },
  card: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 18 },
  clockBox: { alignItems: 'center' },
  hint: { fontSize: 12, color: C.muted, lineHeight: 18, marginTop: 10 },
  error: { fontSize: 13, color: '#B45353' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: C.ink, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 9 },
  input: { borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, borderRadius: 12,
    padding: 13, color: C.ink, fontSize: 14, marginBottom: 15 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  category: { borderWidth: 1, borderColor: C.line, backgroundColor: '#F2EEE9', borderRadius: 10, padding: 10 },
  categoryText: { fontSize: 12, color: C.ink, fontWeight: '600' },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeColumn: { flex: 1 },
  saveButton: { backgroundColor: C.sage, padding: 15, borderRadius: 12, alignItems: 'center' },
  saveText: { color: '#FFFFFF', fontWeight: '700' },
  disabled: { opacity: 0.45 },
  cancel: { color: C.muted, textAlign: 'center', marginTop: 12 },
  blockRow: { backgroundColor: C.card, padding: 13, borderRadius: 14, borderColor: C.line, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  colorMarker: { width: 12, height: 35, borderRadius: 6 },
  blockInfo: { flex: 1 },
  blockTitle: { color: C.ink, fontWeight: '700', fontSize: 13 },
  blockMeta: { color: C.muted, fontSize: 11, marginTop: 4 },
  action: { color: C.sage, fontSize: 12, fontWeight: '700' },
  delete: { color: '#C48693', fontSize: 12, fontWeight: '700' },
});
