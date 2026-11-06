import DotGridBackground from '../components/DotGridBackground';

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
  MicroGoal,
  listMicroGoals,
  suggestMicroGoal,
  updateMicroGoal,
} from '../database/microGoalRepository';

const C = {
  paper: '#FAF7F0',
  card: '#FFFDF9',
  ink: '#454654',
  sage: '#90AE98',
  line: '#E7E1D8',
};

function todayKey() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() + 1 === month &&
    parsed.getDate() === day
  );
}

export default function MicroGoalsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();

  const date =
    typeof params.date === 'string' && validDate(params.date)
      ? params.date
      : todayKey();

  const [goals, setGoals] = useState<MicroGoal[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const data = await listMicroGoals(date);
    setGoals(data);
    setDrafts(
      Object.fromEntries(data.map((goal) => [goal.id, goal.title]))
    );
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);

      listMicroGoals(date)
        .then((data) => {
          if (!active) return;
          setGoals(data);
          setDrafts(
            Object.fromEntries(
              data.map((goal) => [goal.id, goal.title])
            )
          );
        })
        .catch((error) => {
          console.error(error);
          if (active) {
            Alert.alert('Erro', 'Não foi possível carregar as micro-metas.');
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [date])
  );

  async function save(id: string) {
    if (saving) return;
    setSaving(true);

    try {
      await updateMicroGoal(date, id, drafts[id] ?? '');
      await reload();
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível salvar a micro-meta.');
    } finally {
      setSaving(false);
    }
  }

  async function suggest(id: string) {
    if (saving) return;
    setSaving(true);

    try {
      await suggestMicroGoal(date, id);
      await reload();
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível sortear uma sugestão.');
    } finally {
      setSaving(false);
    }
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

        <Text style={styles.title}>Minhas micro-metas ✿</Text>
        <Text style={styles.subtitle}>Planejamento de {date}</Text>

        {loading ? (
          <ActivityIndicator color={C.sage} />
        ) : (
          goals.map((goal, index) => (
            <View key={goal.id} style={styles.card}>
              <Text style={styles.label}>
                Micro-meta {index + 1}
              </Text>

              <TextInput
                style={styles.input}
                value={drafts[goal.id] ?? ''}
                onChangeText={(value) =>
                  setDrafts((current) => ({
                    ...current,
                    [goal.id]: value,
                  }))
                }
                maxLength={120}
                placeholder="Escreva sua micro-meta..."
              />

              <View style={styles.actions}>
                <Pressable
                  disabled={saving}
                  onPress={() => void suggest(goal.id)}
                  style={styles.secondary}
                >
                  <Text style={styles.secondaryText}>
                    ↻ Sortear
                  </Text>
                </Pressable>

                <Pressable
                  disabled={saving || !(drafts[goal.id] ?? '').trim()}
                  onPress={() => void save(goal.id)}
                  style={styles.primary}
                >
                  <Text style={styles.primaryText}>
                    Salvar
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Text style={styles.footer}>
          Cada dia possui suas próprias três micro-metas.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },
  content: {
    padding: 20,
    paddingTop: 45,
    paddingBottom: 50,
  },
  back: {
    color: C.sage,
    fontWeight: '700',
    marginBottom: 24,
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: C.ink,
  },
  subtitle: {
    color: '#8F8B90',
    marginTop: 7,
    marginBottom: 24,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    marginBottom: 14,
  },
  label: {
    color: C.ink,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.paper,
    borderRadius: 12,
    padding: 13,
    color: C.ink,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  secondary: {
    flex: 1,
    backgroundColor: '#E8EDE4',
    padding: 13,
    borderRadius: 11,
    alignItems: 'center',
  },
  primary: {
    flex: 1,
    backgroundColor: C.sage,
    padding: 13,
    borderRadius: 11,
    alignItems: 'center',
  },
  secondaryText: { color: C.ink, fontWeight: '700' },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  footer: {
    color: '#99969A',
    textAlign: 'center',
    marginTop: 15,
    fontSize: 12,
  },
});

