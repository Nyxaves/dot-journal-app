
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  StatusBar,
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

const initialHabits = [
  { id: '1', title: 'Tomar remédio', done: false },
  { id: '2', title: 'Ler', done: false },
  { id: '3', title: 'Exercitar-se', done: false },
  { id: '4', title: 'Estudar', done: false },
];

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
  const [goals, setGoals] = useState(initialGoals);
  const [habits, setHabits] = useState(initialHabits);
  const [notes, setNotes] = useState('');
  const [gratitude, setGratitude] = useState('');

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const toggleGoal = (id: string) => {
    setGoals((current) =>
      current.map((goal) =>
        goal.id === id ? { ...goal, done: !goal.done } : goal
      )
    );
  };

  const toggleHabit = (id: string) => {
    setHabits((current) =>
      current.map((habit) =>
        habit.id === id ? { ...habit, done: !habit.done } : habit
      )
    );
  };

  const completedHabits = habits.filter((habit) => habit.done).length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.brand}>dot journal.</Text>
          <Text style={styles.subtitle}>um dia de cada vez ✿</Text>
        </View>

        <View style={styles.dateCard}>
          <Text style={styles.dateLabel}>MEU PLANEJAMENTO</Text>
          <Text style={styles.dateText}>{today}</Text>
        </View>

        <Section title="✦  Minhas 3 micro-metas">
          <Text style={styles.helper}>
            Pequenos passos também são progresso.
          </Text>

          <Checklist items={goals} onToggle={toggleGoal} />
        </Section>

        <Section title="♡  Hábitos de hoje">
          <View style={styles.progressRow}>
            <Text style={styles.helper}>Meu progresso diário</Text>
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
            onChangeText={setNotes}
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
            onChangeText={setGratitude}
          />
        </Section>

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
