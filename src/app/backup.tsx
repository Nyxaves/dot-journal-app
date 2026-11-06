import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { exportJournalBackup, type BackupSummary } from '../database/backupRepository';
import DotGridBackground from '../components/DotGridBackground';

export default function BackupScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState<BackupSummary | null>(null);

  async function exportBackup() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await exportJournalBackup();
      setLastBackup(result);
      Alert.alert('Arquivo preparado', 'Se você escolheu um destino no menu de compartilhamento, confirme que o arquivo está salvo lá. O app não consegue verificar o destino externo.');
    } catch (error) {
      Alert.alert('Falha no backup', error instanceof Error ? error.message : 'Erro desconhecido.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.page}>
      <DotGridBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.back}>‹ Voltar</Text></Pressable>
        <Text style={styles.title}>✿ Proteção dos meus dados</Text>
        <Text style={styles.subtitle}>Exporte uma cópia do banco SQLite para guardar fora do aplicativo.</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Backup manual</Text>
          <Text style={styles.body}>Inclui diário, hábitos, metas, eventos, bem-estar e rotina que estiverem registrados no banco local.</Text>
          <Text style={styles.body}>Selecione um destino externo no menu de compartilhamento (por exemplo, Arquivos ou Drive). Um arquivo guardado apenas no cache não é backup permanente.</Text>
          {Platform.OS === 'web' && <Text style={styles.warning}>Exportação disponível no Android ou iOS, não no navegador.</Text>}
          <Pressable
            disabled={busy || Platform.OS === 'web'}
            style={[styles.button, (busy || Platform.OS === 'web') && styles.disabled]}
            accessibilityRole="button"
            onPress={() => void exportBackup()}
          >
            {busy ? <ActivityIndicator color="#454654" /> : <Text style={styles.buttonLabel}>Exportar backup SQLite</Text>}
          </Pressable>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Segurança</Text>
          <Text style={styles.body}>A exportação confere a integridade do SQLite antes de gerar a cópia. O banco original não é apagado, substituído ou restaurado.</Text>
          <Text style={styles.warning}>A restauração automática ainda não está disponível. Guarde o arquivo fora do celular. Ele pode conter dados pessoais: não o compartilhe publicamente.</Text>
          {lastBackup && <Text style={styles.meta}>Último arquivo preparado: {lastBackup.fileName} ({lastBackup.bytes} bytes) · integridade {lastBackup.integrity}</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FAF7F0' },
  content: { padding: 22, paddingTop: 50, paddingBottom: 70, gap: 16 },
  back: { color: '#454654', fontSize: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#454654' },
  subtitle: { fontSize: 15, color: '#64626B', lineHeight: 22 },
  card: { backgroundColor: '#FFFDF9', borderRadius: 18, padding: 18, gap: 12, borderColor: '#E7E1D8', borderWidth: 1 },
  cardTitle: { fontSize: 18, color: '#454654', fontWeight: '700' },
  body: { fontSize: 14, color: '#55525D', lineHeight: 21 },
  warning: { fontSize: 13, color: '#98616C', lineHeight: 19 },
  meta: { fontSize: 12, color: '#56765D', lineHeight: 19 },
  button: { minHeight: 50, backgroundColor: '#F7DDE6', justifyContent: 'center', alignItems: 'center', borderRadius: 14 },
  disabled: { opacity: 0.5 },
  buttonLabel: { color: '#454654', fontSize: 15, fontWeight: '700' },
});
