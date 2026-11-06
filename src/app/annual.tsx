import DotGridBackground from '../components/DotGridBackground';

import React, { useCallback, useState } from 'react';
import AnnualCalendar from '../components/AnnualCalendar';
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
import { useFocusEffect, useRouter } from 'expo-router';

import {
  AnnualGoal,
  createAnnualGoal,
  deleteAnnualGoal,
  listAnnualGoals,
  setAnnualGoalCompleted,
  updateAnnualGoal,
} from '../database/annualRepository';

const C = {
  paper: '#FAF7F0',
  card: '#FFFDF9',
  ink: '#454654',
  sage: '#90AE98',
  line: '#E7E1D8',
  muted: '#8F8B90',
};

export default function AnnualScreen() {
  const router = useRouter();

  const [year, setYear] = useState(new Date().getFullYear());
  const [goals, setGoals] = useState<AnnualGoal[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await listAnnualGoals(year);
    setGoals(data);
  }, [year]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);

      listAnnualGoals(year)
        .then((data) => {
          if (active) setGoals(data);
        })
        .catch((err) => {
          console.error(err);
          if (active) {
            setError('Não foi possível carregar as metas.');
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [year])
  );

  function resetForm() {
    setTitle('');
    setDescription('');
    setEditingId(null);
  }

  function changeYear(amount: number) {
    if (saving) return;

    const nextYear = year + amount;
    if (nextYear < 1 || nextYear > 9999) return;

    resetForm();
    setYear(nextYear);
  }

  async function handleSave() {
    if (saving || !title.trim()) return;

    setSaving(true);

    try {
      if (editingId) {
        await updateAnnualGoal(editingId, title, description);
      } else {
        await createAnnualGoal(year, title, description);
      }

      await reload();
      resetForm();
    } catch (err) {
      console.error(err);
      Alert.alert('Erro', 'Não foi possível salvar a meta.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(goal: AnnualGoal) {
    if (saving) return;

    setSaving(true);
    try {
      await setAnnualGoalCompleted(goal.id, !goal.completed);
      await reload();
    } catch (err) {
      console.error(err);
      Alert.alert('Erro', 'Não foi possível atualizar a meta.');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(goal: AnnualGoal) {
    setEditingId(goal.id);
    setTitle(goal.title);
    setDescription(goal.description);
  }

  function handleDelete(goal: AnnualGoal) {
    Alert.alert(
      'Excluir meta?',
      `Deseja excluir "${goal.title}"? Esta ação é definitiva.`,
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
                await deleteAnnualGoal(goal.id);
                await reload();

                if (editingId === goal.id) resetForm();
              } catch (err) {
                console.error(err);
                Alert.alert('Erro', 'Não foi possível excluir a meta.');
              } finally {
                setSaving(false);
              }
            })();
          },
        },
      ]
    );
  }

  const completed = goals.filter((goal) => goal.completed).length;
  const progress = goals.length
    ? (completed / goals.length) * 100
    : 0;

  return (
    <View style={styles.container}>
      <DotGridBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Voltar ao diário</Text>
        </Pressable>

        <Text style={styles.heading}>Meu ano ✿</Text>
        <Text style={styles.subtitle}>
          Grandes conquistas começam com pequenos passos.
        </Text>

        <View style={styles.card}>
          <View style={styles.yearRow}>
            <Pressable onPress={() => changeYear(-1)}>
              <Text style={styles.arrow}>‹</Text>
            </Pressable>
            <Text style={styles.year}>{year}</Text>
            <Pressable onPress={() => changeYear(1)}>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          </View>

          <View style={styles.progressHeader}>
            <Text style={styles.muted}>Metas concluídas</Text>
            <Text style={styles.progressNumber}>
              {completed}/{goals.length}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progress}%` }]}
            />
          </View>
          <AnnualCalendar
            year={year}
            onSelectMonth={(month) => {
                router.push({
                pathname: '/monthly',
                params: {
                    year: String(year),
                    month: String(month),
                },
                });
            }}
            />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {editingId ? 'Editar meta' : 'Nova meta anual'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Ex.: Ler 12 livros"
            placeholderTextColor="#99969A"
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />

          <TextInput
            style={[styles.input, styles.description]}
            placeholder="Descreva sua meta (opcional)..."
            placeholderTextColor="#99969A"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            maxLength={500}
          />

          <Pressable
            style={[
              styles.primaryButton,
              (saving || !title.trim()) && styles.disabled,
            ]}
            disabled={saving || !title.trim()}
            onPress={() => void handleSave()}
          >
            <Text style={styles.primaryText}>
              {saving
                ? 'Salvando...'
                : editingId
                  ? 'Salvar alterações'
                  : '+ Adicionar meta'}
            </Text>
          </Pressable>

          {editingId && (
            <Pressable onPress={resetForm}>
              <Text style={styles.cancel}>Cancelar edição</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.sectionTitle}>Minhas metas de {year}</Text>

        {loading ? (
          <ActivityIndicator color={C.sage} />
        ) : error ? (
          <Text style={styles.muted}>{error}</Text>
        ) : goals.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.muted}>
              Nenhuma meta cadastrada para este ano.
            </Text>
          </View>
        ) : (
          goals.map((goal) => (
            <View key={goal.id} style={styles.goalCard}>
              <Pressable
                disabled={saving}
                onPress={() => void handleToggle(goal)}
                style={[
                  styles.checkbox,
                  goal.completed && styles.checked,
                ]}
              >
                {goal.completed && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </Pressable>

              <View style={styles.goalContent}>
                <Text
                  style={[
                    styles.goalTitle,
                    goal.completed && styles.completedTitle,
                  ]}
                >
                  {goal.title}
                </Text>

                {!!goal.description && (
                  <Text style={styles.goalDescription}>
                    {goal.description}
                  </Text>
                )}

                <View style={styles.actions}>
                  <Pressable
                    disabled={saving}
                    onPress={() => handleEdit(goal)}
                  >
                    <Text style={styles.edit}>Editar</Text>
                  </Pressable>

                  <Pressable
                    disabled={saving}
                    onPress={() => handleDelete(goal)}
                  >
                    <Text style={styles.delete}>Excluir</Text>
                  </Pressable>
                </View>
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
  back: { color: C.sage, fontWeight: '700', marginBottom: 24 },
  heading: { color: C.ink, fontSize: 28, fontWeight: '800' },
  subtitle: {
    color: C.muted,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 22,
  },
  card: {
    backgroundColor: C.card,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  year: { fontSize: 25, fontWeight: '800', color: C.ink },
  arrow: { fontSize: 32, color: C.sage, paddingHorizontal: 14 },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  muted: { color: C.muted, fontSize: 13 },
  progressNumber: { color: C.sage, fontWeight: '700' },
  progressTrack: {
    height: 8,
    backgroundColor: '#EAEAE5',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.sage,
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.ink,
    marginBottom: 14,
  },
  input: {
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    marginBottom: 12,
    color: C.ink,
    backgroundColor: C.paper,
  },
  description: { minHeight: 82 },
  primaryButton: {
    backgroundColor: C.sage,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  cancel: { color: C.muted, textAlign: 'center', marginTop: 15 },
  goalCard: {
    flexDirection: 'row',
    gap: 13,
    padding: 17,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
    marginBottom: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: C.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: C.sage },
  checkmark: { color: '#FFFFFF', fontWeight: '800' },
  goalContent: { flex: 1 },
  goalTitle: { color: C.ink, fontSize: 14, fontWeight: '700' },
  completedTitle: {
    color: '#A0A0A0',
    textDecorationLine: 'line-through',
  },
  goalDescription: {
    color: C.muted,
    fontSize: 12,
    marginTop: 5,
    lineHeight: 18,
  },
  actions: { flexDirection: 'row', gap: 20, marginTop: 13 },
  edit: { color: C.sage, fontWeight: '700', fontSize: 12 },
  delete: { color: '#C48693', fontWeight: '700', fontSize: 12 },
});
