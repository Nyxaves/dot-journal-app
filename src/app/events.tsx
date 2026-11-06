import DotGridBackground from '../components/DotGridBackground';
import { Platform } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';

import {
  createEvent,
  deleteEvent,
  listEventsByDate,
  updateEvent,
  type EventType,
  type JournalEvent,
} from '../database/eventRepository';

const C = {
  paper: '#FAF7F0',
  card: '#FFFDF9',
  ink: '#454654',
  pink: '#F7DDE6',
  sage: '#90AE98',
  line: '#E7E1D8',
  muted: '#8F8B90',
};

const TYPES: { value: EventType; label: string }[] = [
  { value: 'birthday', label: 'Aniversário' },
  { value: 'meeting', label: 'Reunião' },
  { value: 'appointment', label: 'Compromisso' },
  { value: 'holiday', label: 'Feriado' },
  { value: 'other', label: 'Outro' },
];

function todayKey(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);

  return (
    parsed.getFullYear() === y &&
    parsed.getMonth() + 1 === m &&
    parsed.getDate() === d
  );
}

function formatTimeInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function normalizeTime(value: string): string | null {
  const digits = value.replace(/\D/g, '');

  if (!digits) return null;

  let hours: number;
  let minutes: number;

  if (digits.length <= 2) {
    hours = Number(digits);
    minutes = 0;
  } else if (digits.length === 3) {
    hours = Number(digits.slice(0, 1));
    minutes = Number(digits.slice(1));
  } else if (digits.length === 4) {
    hours = Number(digits.slice(0, 2));
    minutes = Number(digits.slice(2));
  } else {
    throw new Error('Horário inválido.');
  }

  if (hours > 23 || minutes > 59) {
    throw new Error('Horário inválido.');
  }

  return (
    `${String(hours).padStart(2, '0')}:` +
    String(minutes).padStart(2, '0')
  );
}

export default function EventsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();

  const initialDate =
    typeof params.date === 'string' && isValidDate(params.date)
      ? params.date
      : todayKey();

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [eventDate, setEventDate] = useState(initialDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [events, setEvents] = useState<JournalEvent[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [type, setType] = useState<EventType>('appointment');
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await listEventsByDate(selectedDate);
    setEvents(data);
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);

      listEventsByDate(selectedDate)
        .then((data) => {
          if (active) setEvents(data);
        })
        .catch((err) => {
          console.error(err);
          if (active) setError('Não foi possível carregar os eventos.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [selectedDate])
  );
  function parseLocalDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 12);
    }

    function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
    }
  function resetForm() {
    setEditingId(null);
    setTitle('');
    setTime('');
    setEndTime('');
    setType('appointment');
    setDescription('');
    setEventDate(selectedDate);
    setShowDatePicker(false);
  }

  function editEvent(event: JournalEvent) {
    setEditingId(event.id);
    setTitle(event.title);
    setTime(event.time ?? '');
    setEndTime(event.endTime ?? '');
    setType(event.type);
    setDescription(event.description);
    setEventDate(event.date);
  }

  

async function saveEvent() {
  if (saving || !title.trim()) return;

  let normalizedStart: string | null;
  let normalizedEnd: string | null;

  try {
    normalizedStart = normalizeTime(time);
    normalizedEnd = normalizeTime(endTime);

    if (normalizedEnd !== null && normalizedStart === null) {
      Alert.alert('Horário inválido', 'Informe o horário inicial.');
      return;
    }

    if (
      normalizedStart !== null &&
      normalizedEnd !== null &&
      normalizedEnd <= normalizedStart
    ) {
      Alert.alert(
        'Intervalo inválido',
        'O horário final deve ser posterior ao inicial.'
      );
      return;
    }

    if (!isValidDate(eventDate)) {
      Alert.alert('Data inválida', 'Selecione uma data válida.');
      return;
    }
  } catch {
    Alert.alert('Erro', 'Verifique os horários informados.');
    return;
  }

  const targetDate = eventDate;

  setSaving(true);

  try {
    const eventData = {
      title: title.trim(),
      date: targetDate,
      time: normalizedStart,
      endTime: normalizedEnd,
      type,
      description: description.trim(),
    };

    if (editingId) {
      await updateEvent({
        id: editingId,
        ...eventData,
      });
    } else {
      await createEvent(eventData);
    }

    // Limpa o formulário sem mudar a data escolhida.
    setEditingId(null);
    setTitle('');
    setTime('');
    setEndTime('');
    setType('appointment');
    setDescription('');
    setShowDatePicker(false);

    // Atualiza o dia exibido na agenda.
    if (targetDate !== selectedDate) {
      setSelectedDate(targetDate);
    } else {
      await reload();
    }

    setEventDate(targetDate);

    Alert.alert(
      'Sucesso!',
      `Evento salvo para ${targetDate.split('-').reverse().join('/')}.`
    );
  } catch (err) {
    console.error('ERRO AO SALVAR EVENTO:', err);
    Alert.alert('Erro', 'Não foi possível salvar o evento.');
  } finally {
    setSaving(false);
  }
}

  function confirmDelete(event: JournalEvent) {
    Alert.alert(
      'Excluir evento?',
      `Deseja excluir "${event.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            if (saving) return;
            setSaving(true);

            void (async () => {
              try {
                await deleteEvent(event.id);
                await reload();
                if (editingId === event.id) resetForm();
              } catch (err) {
                console.error(err);
                Alert.alert('Erro', 'Não foi possível excluir.');
              } finally {
                setSaving(false);
              }
            })();
          },
        },
      ]
    );
  }

  function changeDay(amount: number) {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const next = new Date(y, m - 1, d + amount);
    const key = [
      next.getFullYear(),
      String(next.getMonth() + 1).padStart(2, '0'),
      String(next.getDate()).padStart(2, '0'),
    ].join('-');

    resetForm();
    setEventDate(key);
    setSelectedDate(key);
  }

  return (
    <View style={styles.container}>
      <DotGridBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Voltar</Text>
        </Pressable>

        <Text style={styles.heading}>Minha agenda ✿</Text>
        <Text style={styles.subtitle}>
          Organize seus momentos importantes.
        </Text>

        <View style={styles.card}>
          <View style={styles.dateRow}>
            <Pressable onPress={() => changeDay(-1)}>
              <Text style={styles.arrow}>‹</Text>
            </Pressable>
            <Text style={styles.dateText}>{selectedDate}</Text>
            <Pressable onPress={() => changeDay(1)}>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {editingId ? 'Editar evento' : 'Novo evento'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Título do evento"
            placeholderTextColor={C.muted}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
          
            <Text style={styles.label}>Data do evento</Text>

            <Pressable
            onPress={() => setShowDatePicker(true)}
            style={{
                backgroundColor: '#F7DDE6',
                padding: 14,
                borderRadius: 12,
                marginBottom: 14,
            }}
            >
            <Text
                style={{
                color: C.ink,
                fontWeight: '700',
                textAlign: 'center',
                }}
            >
                📅 {eventDate.split('-').reverse().join('/')}
            </Text>
            </Pressable>

            {showDatePicker && (
            <DateTimePicker
                value={parseLocalDate(eventDate)}
                mode="date"
                display={Platform.OS === 'android' ? 'default' : 'spinner'}
                onChange={(
                event: DateTimePickerEvent,
                selected?: Date
                ) => {
                if (Platform.OS === 'android') {
                    setShowDatePicker(false);
                }

                if (
                    event.type === 'set' &&
                    selected
                ) {
                    setEventDate(formatLocalDate(selected));
                }
                }}
            />
            )}

 
        <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
            <Text style={styles.label}>Início</Text>

            <TextInput
            style={styles.input}
            placeholder="Ex.: 1900"
            placeholderTextColor={C.muted}
            value={time}
            onChangeText={(value) =>
                setTime(formatTimeInput(value))
            }
            onBlur={() => {
                try {
                setTime(normalizeTime(time) ?? '');
                } catch {
                // Mantém o valor para permitir a correção.
                }
            }}
            keyboardType="number-pad"
            maxLength={5}
            />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={styles.label}>Fim</Text>

            <TextInput
            style={styles.input}
            placeholder="Ex.: 2000"
            placeholderTextColor={C.muted}
            value={endTime}
            onChangeText={(value) =>
                setEndTime(formatTimeInput(value))
            }
            onBlur={() => {
                try {
                setEndTime(normalizeTime(endTime) ?? '');
                } catch {
                // Mantém o valor para permitir a correção.
                }
            }}
            keyboardType="number-pad"
            maxLength={5}
            />
        </View>
        </View>
          <Text style={styles.label}>Tipo de evento</Text>
          <View style={styles.typeRow}>
            {TYPES.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => setType(item.value)}
                style={[
                  styles.typeButton,
                  type === item.value && styles.selectedType,
                ]}
              >
                <Text style={styles.typeText}>{item.label}</Text>
              </Pressable>
            ))}
        </View>

          <TextInput
            style={[styles.input, styles.description]}
            placeholder="Descrição (opcional)"
            placeholderTextColor={C.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            maxLength={500}
          />

          <Pressable
            style={[
              styles.primaryButton,
              (saving || !title.trim()) && { opacity: 0.5 },
            ]}
            disabled={saving || !title.trim()}
            onPress={() => void saveEvent()}
          >
            <Text style={styles.primaryText}>
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : '+ Adicionar evento'}
            </Text>
          </Pressable>

          {editingId && (
            <Pressable onPress={resetForm}>
              <Text style={styles.cancel}>Cancelar edição</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.sectionTitle}>Eventos do dia</Text>

        {loading ? (
          <ActivityIndicator color={C.sage} />
        ) : error ? (
          <Text style={styles.subtitle}>{error}</Text>
        ) : events.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.subtitle}>
              Nenhum evento cadastrado para esta data.
            </Text>
          </View>
        ) : (
          events.map((event) => (
            <View key={event.id} style={styles.eventCard}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventMeta}>
                {event.time
                    ? event.endTime
                        ? `${event.time} – ${event.endTime}`
                        : event.time
                    : 'Sem horário'}{' · '}
                {TYPES.find((item) => item.value === event.type)?.label ?? 'Outro'}
              </Text>

              {!!event.description && (
                <Text style={styles.subtitle}>{event.description}</Text>
              )}

              <View style={styles.actions}>
                <Pressable onPress={() => editEvent(event)}>
                  <Text style={styles.edit}>Editar</Text>
                </Pressable>
                <Pressable onPress={() => confirmDelete(event)}>
                  <Text style={styles.delete}>Excluir</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  content: { padding: 20, paddingTop: 45, paddingBottom: 50 },
  back: { color: C.sage, fontWeight: '700', marginBottom: 22 },
  heading: { color: C.ink, fontSize: 28, fontWeight: '800' },
  subtitle: { color: C.muted, fontSize: 13, marginTop: 6, marginBottom: 20 },
  card: {
    backgroundColor: C.card, borderColor: C.line, borderWidth: 1,
    borderRadius: 18, padding: 18, marginBottom: 18,
  },
  dateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  arrow: { fontSize: 30, color: C.sage, paddingHorizontal: 12 },
  dateText: { color: C.ink, fontSize: 18, fontWeight: '700' },
  sectionTitle: { color: C.ink, fontSize: 17, fontWeight: '700', marginBottom: 14 },
  label: { color: C.ink, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  input: {
    borderWidth: 1, borderColor: C.line, borderRadius: 12,
    padding: 13, color: C.ink, marginBottom: 12,
  },
  description: { minHeight: 85 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  typeButton: {
    backgroundColor: '#F1EEEA', borderRadius: 10, padding: 10,
  },
  selectedType: { backgroundColor: C.pink },
  typeText: { color: C.ink, fontSize: 12 },
  primaryButton: {
    backgroundColor: C.sage, padding: 15, borderRadius: 12, alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  cancel: { color: C.muted, textAlign: 'center', marginTop: 15 },
  eventCard: {
    backgroundColor: C.card, borderColor: C.line, borderWidth: 1,
    borderRadius: 16, padding: 17, marginBottom: 10,
  },
  eventTitle: { color: C.ink, fontSize: 15, fontWeight: '700' },
  eventMeta: { color: C.sage, fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 24, marginTop: 12 },
  edit: { color: C.sage, fontWeight: '700' },
  delete: { color: '#C48693', fontWeight: '700' },
});
