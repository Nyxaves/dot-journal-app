import KeyboardAwareJournalScrollView from '../components/KeyboardAwareJournalScrollView';
import DotGridBackground from '../components/DotGridBackground';
import { JOURNAL_PALETTE } from '../theme/journalPalette';

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import {
  Habit,
  createHabit,
  listHabits,
  setHabitActive,
  updateHabit,
} from '../database/habitRepository';

const COLORS = {
  paper: '#FAF7F0',
  ink: '#454654',
  sage: '#90AE98',
  line: '#E7E1D8',
};

const PALETTE = [...JOURNAL_PALETTE];

export default function HabitsScreen() {
  const router = useRouter();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [title, setTitle] = useState('');
  const [color, setColor] = useState<string>(PALETTE[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const items = await listHabits(true);
    setHabits(items);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);

      listHabits(true)
        .then((items) => {
          if (active) setHabits(items);
        })
        .catch((error) => {
          console.error(error);
          if (active) Alert.alert('Erro', 'Falha ao carregar hábitos.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [])
  );

  const resetForm = () => {
    setTitle('');
    setColor(PALETTE[0]);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Atenção', 'Informe o nome do hábito.');
      return;
    }

    if (saving) return;

    setSaving(true);

    try {
      if (editingId) {
        await updateHabit(editingId, title, color);
      } else {
        await createHabit(title, color);
      }

      await reload();
      resetForm();
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível salvar o hábito.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (habit: Habit) => {
    setEditingId(habit.id);
    setTitle(habit.title);
    setColor(habit.color);
  };

  const changeStatus = async (habit: Habit) => {
    if (saving) return;

    setSaving(true);

    try {
      await setHabitActive(habit.id, !habit.isActive);
      await reload();

      if (editingId === habit.id) {
        resetForm();
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Não foi possível alterar o hábito.');
    } finally {
      setSaving(false);
    }
  };

  const confirmStatus = (habit: Habit) => {
    if (!habit.isActive) {
      void changeStatus(habit);
      return;
    }

    Alert.alert(
      'Desativar hábito?',
      'As marcações anteriores continuarão salvas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: () => void changeStatus(habit),
        },
      ]
    );
  };

  const visibleHabits = habits.filter(
    (habit) => showInactive || habit.isActive
  );

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

        <Text style={styles.heading}>Meus hábitos ✿</Text>
        <Text style={styles.subtitle}>
          Pequenos passos, grandes mudanças.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {editingId ? 'Editar hábito' : 'Novo hábito'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Ex.: Ler 20 minutos"
            placeholderTextColor="#99969A"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />

          <Text style={styles.label}>Escolha uma cor</Text>

          <Text style={styles.paletteHint}>Arraste para o lado para ver todas as cores →</Text>
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator
            keyboardShouldPersistTaps="handled" contentContainerStyle={styles.colors}>
            {PALETTE.map((item) => (
              <Pressable
                key={item}
                accessibilityLabel={`Cor ${item}`}
                onPress={() => setColor(item)}
                style={[
                  styles.colorCircle,
                  { backgroundColor: item },
                  color === item && styles.selectedColor,
                ]}
              >
                {color === item && (
                  <Text style={styles.colorCheck}>✓</Text>
                )}
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            onPress={() => void handleSave()}
            disabled={saving || !title.trim()}
            style={[
              styles.primaryButton,
              (saving || !title.trim()) && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.primaryText}>
              {saving
                ? 'Salvando...'
                : editingId
                  ? 'Salvar alterações'
                  : '+ Adicionar hábito'}
            </Text>
          </Pressable>

          {editingId && (
            <Pressable onPress={resetForm}>
              <Text style={styles.cancel}>Cancelar edição</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Hábitos cadastrados</Text>

          <Pressable
            onPress={() => setShowInactive((value) => !value)}
          >
            <Text style={styles.link}>
              {showInactive ? 'Ocultar inativos' : 'Mostrar inativos'}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.sage} />
        ) : visibleHabits.length === 0 ? (
          <Text style={styles.subtitle}>
            Nenhum hábito encontrado.
          </Text>
        ) : (
          visibleHabits.map((habit) => (
            <View key={habit.id} style={styles.habitCard}>
              <View
                style={[
                  styles.indicator,
                  { backgroundColor: habit.color },
                ]}
              />

              <View style={styles.habitInfo}>
                <Text style={styles.habitTitle}>{habit.title}</Text>
                <Text style={styles.status}>
                  {habit.isActive ? 'Ativo' : 'Inativo'}
                </Text>
              </View>

              <Pressable
                disabled={saving}
                onPress={() => handleEdit(habit)}
              >
                <Text style={styles.action}>Editar</Text>
              </Pressable>

              <Pressable
                disabled={saving}
                onPress={() => confirmStatus(habit)}
              >
                <Text style={styles.action}>
                  {habit.isActive ? 'Desativar' : 'Reativar'}
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </KeyboardAwareJournalScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  content: {
    padding: 20,
    paddingTop: 45,
    paddingBottom: 50,
  },
  back: {
    color: COLORS.sage,
    fontWeight: '700',
    marginBottom: 22,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.ink,
  },
  subtitle: {
    color: '#8F8B90',
    fontSize: 13,
    marginTop: 5,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 18,
    padding: 18,
    marginBottom: 26,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: COLORS.ink,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    padding: 14,
    color: COLORS.ink,
    marginBottom: 18,
  },
  colors: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 8,
    paddingRight: 20,
  },
  paletteHint: { color: '#8F8B90', fontSize: 12, marginBottom: 6 },
  colorCircle: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedColor: {
    borderWidth: 2,
    borderColor: COLORS.ink,
  },
  colorCheck: {
    color: COLORS.ink,
    fontWeight: '800',
  },
  primaryButton: {
    backgroundColor: COLORS.sage,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cancel: {
    textAlign: 'center',
    color: '#8F8B90',
    marginTop: 15,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  link: {
    fontSize: 12,
    color: COLORS.sage,
    fontWeight: '700',
  },
  habitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    gap: 10,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  habitInfo: {
    flex: 1,
  },
  habitTitle: {
    color: COLORS.ink,
    fontWeight: '600',
    fontSize: 13,
  },
  status: {
    color: '#99969A',
    fontSize: 11,
    marginTop: 3,
  },
  action: {
    fontSize: 12,
    color: COLORS.sage,
    fontWeight: '700',
  },
});
