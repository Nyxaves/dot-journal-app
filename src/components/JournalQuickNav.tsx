import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { journalTheme as theme } from '../theme/journalTheme';

type NavItem = {
  label: string;
  detail: string;
  icon: string;
  color: string;
  href: Href;
};

/** Atalhos fixos do diário, sem duplicar o estado de nenhuma tela. */
export default function JournalQuickNav({ date }: { date: string }) {
  const router = useRouter();
  const items: NavItem[] = [
    { label: 'Semana', detail: 'Objetivos', icon: '◫', color: theme.colors.peach, href: '/weekly' },
    { label: 'Mês', detail: 'Habit tracker', icon: '▦', color: theme.colors.lavender, href: '/monthly' },
    { label: 'Ano', detail: 'Metas e datas', icon: '✿', color: theme.colors.pink, href: '/annual' },
    { label: 'Agenda', detail: 'Compromissos', icon: '◷', color: theme.colors.sageLight, href: { pathname: '/events', params: { date } } },
    { label: 'Hábitos', detail: 'Personalizar', icon: '✓', color: theme.colors.sageLight, href: '/habits' },
    { label: 'Bem-estar', detail: 'Sono e tela', icon: '☾', color: theme.colors.lavender, href: '/wellness' },
    { label: 'Rotina 24h', detail: 'Seu relógio', icon: '◉', color: theme.colors.apricot, href: '/routine' },
    { label: 'Backup', detail: 'Guardar meus dados', icon: '▣', color: theme.colors.sageLight, href: '/backup' },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Explorar meu journal</Text>
        <Text style={styles.subheading}>Toque para abrir</Text>
      </View>
      <View style={styles.grid}>
        {items.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ${item.label}`}
            onPress={() => router.push(item.href)}
            style={({ pressed }) => [styles.tile, { backgroundColor: item.color }, pressed && styles.pressed]}
          >
            <Text style={styles.icon} accessibilityElementsHidden>{item.icon}</Text>
            <View style={styles.tileText}>
              <Text style={styles.title}>{item.label}</Text>
              <Text style={styles.detail}>{item.detail}</Text>
            </View>
            <Text style={styles.arrow} accessibilityElementsHidden>›</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 11, gap: 8 },
  heading: { color: theme.colors.ink, fontSize: 17, fontWeight: '700' },
  subheading: { color: theme.colors.muted, fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: { width: '48.6%', minHeight: 78, paddingHorizontal: 12, paddingVertical: 12, borderRadius: theme.radius.button, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
  icon: { fontSize: 22, color: theme.colors.ink },
  tileText: { flex: 1, minWidth: 0 },
  title: { color: theme.colors.ink, fontSize: 13, fontWeight: '700' },
  detail: { color: '#6E6D77', fontSize: 10, marginTop: 2 },
  arrow: { color: theme.colors.ink, fontSize: 19, opacity: 0.6 },
});
