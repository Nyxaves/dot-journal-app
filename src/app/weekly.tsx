import KeyboardAwareJournalScrollView from '../components/KeyboardAwareJournalScrollView';
import DotGridBackground from '../components/DotGridBackground';

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import {
  WeeklyGoal,
  createWeeklyGoal,
  deleteWeeklyGoal,
  listWeeklyGoals,
  toggleWeeklyGoal,
} from '../database/weeklyRepository';

const C = {
  paper: '#FAF7F0',
  card: '#FFFDF9',
  ink: '#454654',
  sage: '#90AE98',
  line: '#E7E1D8',
  muted: '#8F8B90',
};

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonday(date: Date): Date {
  const result = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const day = result.getDay();
  result.setDate(result.getDate() - ((day + 6) % 7));

  return result;
}

function parseDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export default function WeeklyScreen() {
  const router = useRouter();

  const [weekStart, setWeekStart] = useState(() =>
    formatDate(getMonday(new Date()))
  );

  const [goals, setGoals] = useState<WeeklyGoal[]>([]);
  const [newGoal, setNewGoal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const items = await listWeeklyGoals(weekStart);
    setGoals(items);
  }, [weekStart]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);

      listWeeklyGoals(weekStart)
        .then((items) => {
          if (active) setGoals(items);
        })
        .catch((err) => {
          console.error(err);
          if (active) setError('Não foi possível carregar a semana.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [weekStart])
  );

  const monday = parseDate(weekStart);

  const days = Array.from({ length: 7 }, (_, i) =>
    addDays(monday, i)
  );

  const dateLabel = `${days[0].toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
  })} – ${days[6].toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;

  function changeWeek(offset: number) {
    setWeekStart(formatDate(addDays(monday, offset * 7)));
  }

  function openDay(date: Date) {
    router.push({
      pathname: '/',
      params: { date: formatDate(date) },
    });
  }

  async function handleAdd() {
    if (!newGoal.trim() || saving) return;

    setSaving(true);

    try {
      await createWeeklyGoal(weekStart, newGoal);
      await reload();
      setNewGoal('');
    } catch (err) {
      console.error(err);
      Alert.alert('Erro', 'Não foi possível adicionar o objetivo.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(goal: WeeklyGoal) {
    if (saving) return;

    setSaving(true);

    try {
      await toggleWeeklyGoal(goal.id, !goal.completed);
      await reload();
    } catch (err) {
      console.error(err);
      Alert.alert('Erro', 'Não foi possível atualizar o objetivo.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(goal: WeeklyGoal) {
    Alert.alert(
      'Excluir objetivo?',
      `Deseja excluir "${goal.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            if (saving) return;
            setSaving(true);

            void deleteWeeklyGoal(goal.id)
              .then(reload)
              .catch((err) => {
                console.error(err);
                Alert.alert('Erro', 'Não foi possível excluir.');
              })
              .finally(() => setSaving(false));
          },
        },
      ]
    );
  }

  const completed = goals.filter((g) => g.completed).length;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DotGridBackground />
      <KeyboardAwareJournalScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Voltar ao diário</Text>
        </Pressable>

        <Text style={styles.title}>Minha semana ✿</Text>
        <Text style={styles.subtitle}>
          Organize suas prioridades com carinho.
        </Text>

        <View style={styles.card}>
          <View style={styles.weekHeader}>
            <Pressable
              accessibilityLabel="Semana anterior"
              onPress={() => changeWeek(-1)}
            >
              <Text style={styles.arrow}>‹</Text>
            </Pressable>

            <Text style={styles.weekLabel}>{dateLabel}</Text>

            <Pressable
              accessibilityLabel="Próxima semana"
              onPress={() => changeWeek(1)}
            >
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          </View>

          <View style={styles.daysRow}>
            {days.map((date, index) => {
              const isToday =
                formatDate(date) === formatDate(new Date());

              return (
                <Pressable
                  key={formatDate(date)}
                  onPress={() => openDay(date)}
                  style={[
                    styles.dayCard,
                    isToday && styles.today,
                  ]}
                >
                  <Text style={styles.dayName}>
                    {WEEKDAYS[index]}
                  </Text>
                  <Text style={styles.dayNumber}>
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.hint}>
            Toque em um dia para abrir seu diário.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            ✦ Objetivos da semana
          </Text>

          <Text style={styles.subtitle}>
            {completed} de {goals.length} concluídos
          </Text>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${
                    goals.length
                      ? (completed / goals.length) * 100
                      : 0
                  }%`,
                },
              ]}
            />
          </View>

          {loading ? (
            <ActivityIndicator color={C.sage} />
          ) : error ? (
            <Text style={styles.subtitle}>{error}</Text>
          ) : goals.length === 0 ? (
            <Text style={styles.hint}>
              Nenhum objetivo cadastrado para esta semana.
            </Text>
          ) : (
            goals.map((goal) => (
              <View key={goal.id} style={styles.goalRow}>
                <Pressable
                  disabled={saving}
                  onPress={() => void handleToggle(goal)}
                  style={[
                    styles.checkbox,
                    goal.completed && styles.checked,
                  ]}
                >
                  {goal.completed && (
                    <Text style={styles.checkText}>✓</Text>
                  )}
                </Pressable>

                <Text
                  style={[
                    styles.goalText,
                    goal.completed && styles.completedText,
                  ]}
                >
                  {goal.title}
                </Text>

                <Pressable
                  disabled={saving}
                  onPress={() => handleDelete(goal)}
                >
                  <Text style={styles.deleteText}>Excluir</Text>
                </Pressable>
              </View>
            ))
          )}

          <TextInput
            style={styles.input}
            value={newGoal}
            onChangeText={setNewGoal}
            placeholder="Novo objetivo da semana..."
            placeholderTextColor="#99969A"
            maxLength={120}
          />

          <Pressable
            onPress={() => void handleAdd()}
            disabled={!newGoal.trim() || saving}
            style={[
              styles.button,
              (!newGoal.trim() || saving) && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.buttonText}>
              + Adicionar objetivo
            </Text>
          </Pressable>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            ♡ Micro-metas da semana
          </Text>

          <Text style={styles.subtitle}>
            Personalize as três pequenas metas de cada dia.
          </Text>

          {days.map((date, index) => (
            <Pressable
              key={formatDate(date)}
              onPress={() =>
                router.push({
                  pathname: '/micro-goals',
                  params: { date: formatDate(date) },
                })
              }
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F3F0EA',
                padding: 14,
                borderRadius: 12,
                marginBottom: 8,
              }}
            >
              <Text style={{ color: C.ink, fontWeight: '600' }}>
                {WEEKDAYS[index]} · {date.getDate()}
              </Text>

              <Text style={{ color: C.sage, fontWeight: '700' }}>
                Personalizar →
              </Text>
            </Pressable>
          ))}
        </View>
      </KeyboardAwareJournalScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.paper,
  },
  content: {
    padding: 20,
    paddingTop: 45,
    paddingBottom: 50,
  },
  back: {
    color: C.sage,
    fontWeight: '700',
    marginBottom: 22,
  },
  title: {
    fontSize: 28,
    color: C.ink,
    fontWeight: '800',
  },
  subtitle: {
    color: C.muted,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 18,
  },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  arrow: {
    fontSize: 30,
    color: C.sage,
    paddingHorizontal: 10,
  },
  weekLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: C.ink,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 5,
  },
  dayCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: '#F3F0EA',
  },
  today: {
    backgroundColor: '#E2EBE0',
  },
  dayName: {
    color: C.muted,
    fontSize: 10,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: C.ink,
    marginTop: 5,
  },
  hint: {
    color: C.muted,
    fontSize: 12,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.ink,
    marginBottom: 10,
  },
  progressTrack: {
    height: 7,
    borderRadius: 10,
    backgroundColor: '#EAEAE5',
    overflow: 'hidden',
    marginBottom: 18,
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.sage,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: C.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: {
    backgroundColor: C.sage,
  },
  checkText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  goalText: {
    flex: 1,
    color: C.ink,
    fontSize: 13,
  },
  completedText: {
    color: '#A0A0A0',
    textDecorationLine: 'line-through',
  },
  deleteText: {
    fontSize: 12,
    color: '#C48693',
  },
  input: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 13,
    marginTop: 18,
    color: C.ink,
  },
  button: {
    backgroundColor: C.sage,
    borderRadius: 12,
    padding: 15,
    marginTop: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#E8EDE4',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryText: {
    color: C.ink,
    fontWeight: '700',
  },
});
