import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { listHabits } from '../database/habitRepository';
import { debugDatabase } from '../database/dailyRepository';
import {
  getDailyData,
  saveDailyCheck,
  saveDailyField,
} from '../database/dailyRepository';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';

const COLORS = {
  paper: '#FAF7F0',
  ink: '#454654',
  sage: '#90AE98',
  pink: '#E7C8D3',
  lavender: '#C9C5E8',
  line: '#E7E1D8',
};

const initialGoals = [
  { id: '1', title: 'Beber um copo de água', done: false },
  { id: '2', title: 'Escrever uma frase', done: false },
  { id: '3', title: 'Organizar meu espaço', done: false },
];


function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function shiftDate(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day + amount);

  return toDateKey(date);
}

type Task = {
  id: string;
  title: string;
  done: boolean;
};

function Checklist({
  items,
  onToggle,
}: {
  items: Task[];
  onToggle: (id: string) => void;
}) {
  return (
    <View>
      {items.map((item) => (
        <Pressable
          key={item.id}
          style={styles.checkRow}
          onPress={() => onToggle(item.id)}
        >
          <View
            style={[
              styles.checkbox,
              item.done && styles.checkboxChecked,
            ]}
          >
            {item.done && <Text style={styles.checkmark}>✓</Text>}
          </View>

          <Text
            style={[
              styles.checkLabel,
              item.done && styles.completedText,
            ]}
          >
            {item.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}


export default function DailyScreen() {
  const [dateKey, setDateKey] = useState(() => toDateKey(new Date()));
  const [goals, setGoals] = useState(initialGoals);
  const [habits, setHabits] = useState<Task[]>([]);
  const router = useRouter();
  const [notes, setNotes] = useState('');
  const [gratitude, setGratitude] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleDebug = async () => {
    try {
      await debugDatabase();
    } catch (error) {
      console.error('ERRO SQLITE DEBUG:', error);
    }
  };
  
  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      setError(null);

      async function loadDay() {
        try {
          // Inicializa o banco e recupera as marcações do dia.
          const data = await getDailyData(dateKey);

          // Consulta os hábitos cadastrados no SQLite.
          const activeHabits = await listHabits();

          if (!active) return;

          setGoals(
            initialGoals.map((item) => ({
              ...item,
              done: data.goals[item.id] ?? false,
            }))
          );

          setHabits(
            activeHabits.map((habit) => ({
              id: habit.id,
              title: habit.title,
              done: data.habits[habit.id] ?? false,
            }))
          );

          setNotes(data.notes);
          setGratitude(data.gratitude);
        } catch (err) {
          if (!active) return;

          console.error('Erro ao carregar diário:', err);
          setError('Não foi possível carregar os dados do dia.');
        } finally {
          if (active) setLoading(false);
        }
      }

      void loadDay();

      return () => {
        active = false;
      };
    }, [dateKey])
  );


  const showSaveError = (err: unknown) => {
    console.error('Erro ao salvar:', err);
    Alert.alert('Erro', 'Não foi possível salvar a alteração.');
  };

  const toggleGoal = (id: string) => {
    const item = goals.find((goal) => goal.id === id);
    if (!item) return;

    const completed = !item.done;

    setGoals((current) =>
      current.map((goal) =>
        goal.id === id ? { ...goal, done: completed } : goal
      )
    );

    void saveDailyCheck(dateKey, 'goal', id, completed)
      .catch(showSaveError);
  };

  const toggleHabit = (id: string) => {
    const item = habits.find((habit) => habit.id === id);
    if (!item) return;

    const completed = !item.done;

    setHabits((current) =>
      current.map((habit) =>
        habit.id === id ? { ...habit, done: completed } : habit
      )
    );

    void saveDailyCheck(dateKey, 'habit', id, completed)
      .catch(showSaveError);
  };

  const changeNotes = (value: string) => {
    setNotes(value);
    void saveDailyField(dateKey, 'notes', value)
      .catch(showSaveError);
  };

  const changeGratitude = (value: string) => {
    setGratitude(value);
    void saveDailyField(dateKey, 'gratitude', value)
      .catch(showSaveError);
  };

  const [year, month, day] = dateKey.split('-').map(Number);

  const formattedDate = new Date(
    year, month - 1, day
  ).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const completedHabits = habits.filter(
    (habit) => habit.done
  ).length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Pressable
        onPress={handleDebug}
        style={{
          backgroundColor: '#C5D6C4',
          padding: 12,
          alignItems: 'center',
        }}
      >
        <Text>TESTAR BANCO SQLITE</Text>
      </Pressable>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.brand}>dot journal.</Text>
          <Text style={styles.subtitle}>um dia de cada vez ✿</Text>
          <Pressable
            onPress={() => router.push('/habits')}
            style={{
              backgroundColor: '#E8EDE4',
              padding: 12,
              borderRadius: 12,
              marginTop: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: COLORS.ink, fontWeight: '700' }}>
              ✿ Gerenciar meus hábitos
            </Text>
          </Pressable>
        </View>

        <View style={styles.dateCard}>
          <Text style={styles.dateLabel}>MEU PLANEJAMENTO</Text>
          <Text style={styles.dateText}>{formattedDate}</Text>

          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 18,
          }}>
            <Pressable
              onPress={() => setDateKey(shiftDate(dateKey, -1))}
            >
              <Text style={{ color: COLORS.ink }}>
                ← Anterior
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setDateKey(toDateKey(new Date()))}
            >
              <Text style={{ color: COLORS.ink }}>
                Hoje
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setDateKey(shiftDate(dateKey, 1))}
            >
              <Text style={{ color: COLORS.ink }}>
                Próximo →
              </Text>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.sage}
          />
        ) : error ? (
          <View style={styles.section}>
            <Text>{error}</Text>
            <Pressable onPress={() => setDateKey(toDateKey(new Date()))}>
              <Text>Voltar para hoje</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Section title="✦  Minhas 3 micro-metas">
              <Text style={styles.helper}>
                Pequenos passos também são progresso.
              </Text>

              <Checklist items={goals} onToggle={toggleGoal} />
            </Section>

            <Section title="♡  Hábitos de hoje">
              <View style={styles.progressRow}>
                <Text style={styles.helper}>
                  Meu progresso diário
                </Text>
                <Text style={styles.progressLabel}>
                  {completedHabits}/{habits.length}
                </Text>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${
                        habits.length
                          ? (completedHabits / habits.length) * 100
                          : 0
                      }%`,
                    },
                  ]}
                />
              </View>

              <Checklist items={habits} onToggle={toggleHabit} />
            </Section>

            <Section title="☼  Anotações do dia">
              <TextInput
                style={styles.textArea}
                placeholder="Compromissos, reuniões, ideias..."
                placeholderTextColor="#99969A"
                multiline
                textAlignVertical="top"
                value={notes}
                onChangeText={changeNotes}
              />
            </Section>

            <Section title="✿  Gratidão">
              <Text style={styles.helper}>
                O que eu agradeço hoje?
              </Text>

              <TextInput
                style={styles.textArea}
                placeholder="Hoje sou grata por..."
                placeholderTextColor="#99969A"
                multiline
                textAlignVertical="top"
                value={gratitude}
                onChangeText={changeGratitude}
              />
            </Section>
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            feito de pequenos momentos ♡
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 24,
  },
  brand: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -1,
  },
  subtitle: {
    color: '#8B8A8D',
    marginTop: 4,
    fontSize: 13,
  },
  dateCard: {
    backgroundColor: '#E8EDE4',
    padding: 20,
    borderRadius: 18,
    marginBottom: 20,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#788C7A',
    letterSpacing: 2,
    marginBottom: 8,
  },
  dateText: {
    fontSize: 19,
    color: COLORS.ink,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  section: {
    backgroundColor: '#FFFDF9',
    borderColor: COLORS.line,
    borderWidth: 1,
    borderRadius: 18,
    padding: 19,
    marginBottom: 16,
  },
  sectionTitle: {
    color: COLORS.ink,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  helper: {
    fontSize: 12,
    color: '#8F8B90',
    marginBottom: 14,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 12,
  },
  checkbox: {
    width: 23,
    height: 23,
    borderWidth: 1.5,
    borderColor: COLORS.sage,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.sage,
  },
  checkmark: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  checkLabel: {
    color: COLORS.ink,
    fontSize: 14,
    flex: 1,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#A0A0A0',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: COLORS.sage,
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 7,
    borderRadius: 10,
    backgroundColor: '#EAEAE5',
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.sage,
    borderRadius: 10,
  },
  textArea: {
    minHeight: 115,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    backgroundColor: COLORS.paper,
    padding: 14,
    color: COLORS.ink,
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 12,
  },
  footerText: {
    color: '#A6A0A5',
    fontSize: 12,
  },
});
