import React, { useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import type { Session } from '@supabase/supabase-js';

import DotGridBackground from '../components/DotGridBackground';
import { getSupabaseClient, isSupabaseConfigured } from '../services/supabaseClient';
import {
  confirmRecoveryKeySaved,
  generateRecoveryKey,
  getCloudBackupStatus,
  importRecoveryKey,
  listCloudBackups,
  maybeCreateDailyCloudBackup,
  revealRecoveryKey,
  uploadCloudBackup,
  prepareCloudBackupRestore,
  applyCloudBackupRestore,
  type CloudBackupItem,
} from '../services/cloudBackupService';
import type { PreparedRestore } from '../database/restoreRepository';

const client = getSupabaseClient();

function formatDate(value: string | null): string {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return date.toLocaleString('pt-BR');
}

function formatBytes(value: number | null): string {
  if (value === null) return 'Tamanho indisponível';
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export default function CloudBackupScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const [keyExists, setKeyExists] = useState(false);
  const [keyConfirmed, setKeyConfirmed] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [backups, setBackups] = useState<CloudBackupItem[]>([]);
  const [preparedRestore, setPreparedRestore] = useState<PreparedRestore | null>(null);
  const [preparedRestoreName, setPreparedRestoreName] = useState('');
  const [restorePhrase, setRestorePhrase] = useState('');

  useEffect(() => {
    if (!client) {
      setLoadingSession(false);
      return;
    }

    let active = true;
    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setNotice(error.message);
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setKeyExists(false);
      setKeyConfirmed(false);
      setBackups([]);
      return;
    }

    let active = true;
    async function loadAccountData() {
      try {
        const status = await getCloudBackupStatus();
        if (!active) return;
        setKeyExists(status.keyExists);
        setKeyConfirmed(status.keyConfirmed);

        if (status.keyExists && !status.keyConfirmed) {
          setRecoveryKey((await revealRecoveryKey()) ?? '');
        }

        if (status.keyConfirmed) {
          try {
            const automatic = await maybeCreateDailyCloudBackup();
            if (automatic === 'uploaded' && active) {
              setNotice('Backup automático criptografado enviado para a nuvem.');
            }
          } catch (error) {
            if (active) {
              setNotice(
                `Backup automático não realizado: ${
                  error instanceof Error ? error.message : 'verifique sua conexão e o Storage.'
                }`
              );
            }
          }
        }

        const files = await listCloudBackups();
        if (active) setBackups(files);
      } catch (error) {
        if (active) {
          setNotice(error instanceof Error ? error.message : 'Não foi possível consultar os backups.');
        }
      }
    }

    void loadAccountData();
    return () => {
      active = false;
    };
  }, [session]);

  async function submitAuth() {
    if (!client || busy) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setNotice('Informe um e-mail válido.');
      return;
    }
    if (password.length < 8) {
      setNotice('Use uma senha com pelo menos 8 caracteres.');
      return;
    }

    setBusy(true);
    setNotice('');
    try {
      if (authMode === 'signup') {
        const { data, error } = await client.auth.signUp({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        if (!data.session) {
          setNotice('Conta criada. Confirme o e-mail enviado pelo Supabase e depois entre no aplicativo.');
        } else {
          setNotice('Conta pessoal criada com sucesso.');
        }
      } else {
        const { error } = await client.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        setNotice('Acesso realizado.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível autenticar.');
    } finally {
      setBusy(false);
    }
  }

  async function createKey() {
    setBusy(true);
    setNotice('');
    try {
      const key = await generateRecoveryKey();
      setRecoveryKey(key);
      setKeyExists(true);
      setKeyConfirmed(false);
      setNotice('Chave criada. Guarde-a fora do celular antes de confirmar.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível criar a chave.');
    } finally {
      setBusy(false);
    }
  }

  async function showKey() {
    const key = await revealRecoveryKey();
    if (!key) {
      setNotice('Não há chave armazenada neste aparelho.');
      return;
    }
    setRecoveryKey(key);
  }

  async function saveImportedKey() {
    setBusy(true);
    setNotice('');
    try {
      await importRecoveryKey(recoveryInput);
      const key = await revealRecoveryKey();
      setRecoveryKey(key ?? '');
      setKeyExists(true);
      setKeyConfirmed(false);
      setShowImport(false);
      setRecoveryInput('');
      setNotice('Chave importada. Guarde uma cópia segura e confirme abaixo.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Chave inválida.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmKey() {
    setBusy(true);
    try {
      await confirmRecoveryKeySaved();
      setKeyConfirmed(true);
      setNotice('Chave confirmada. Agora você pode enviar backups criptografados.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível confirmar a chave.');
    } finally {
      setBusy(false);
    }
  }

  async function refreshBackups() {
    try {
      setBackups(await listCloudBackups());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível listar os backups.');
    }
  }

  async function sendBackup() {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      const result = await uploadCloudBackup();
      setNotice(`Backup criptografado enviado: ${result.name} (${formatBytes(result.bytes)}).`);
      await refreshBackups();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao enviar backup.');
    } finally {
      setBusy(false);
    }
  }


  async function prepareRestore(backup: CloudBackupItem) {
    if (busy) return;
    setBusy(true);
    setNotice('');
    setPreparedRestore(null);
    setPreparedRestoreName('');
    setRestorePhrase('');
    try {
      const prepared = await prepareCloudBackupRestore(backup.name);
      setPreparedRestore(prepared);
      setPreparedRestoreName(backup.name);
      setNotice('Backup baixado, descriptografado e validado. Confira os dados antes de confirmar a substituição.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível preparar a restauração.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmCloudRestore() {
    if (!preparedRestore || restorePhrase !== 'RESTAURAR' || busy) return;

    Alert.alert(
      'Substituir todos os dados locais?',
      'O banco SQLite atual será copiado para a pasta Documents antes da substituição. O backup selecionado substituirá o banco inteiro; não haverá mesclagem. Feche e reabra o aplicativo após a conclusão.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar agora',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            setNotice('');
            void applyCloudBackupRestore(preparedRestore)
              .then((recoveryName) => {
                setPreparedRestore(null);
                setPreparedRestoreName('');
                setRestorePhrase('');
                setNotice(`Restauração concluída. Cópia de segurança anterior: ${recoveryName}. Feche completamente e reabra o aplicativo antes de continuar.`);
                Alert.alert(
                  'Restauração concluída',
                  `Seu diário foi restaurado. A cópia anterior foi salva em Documents/${recoveryName}. Feche completamente e reabra o Dot Journal agora.`
                );
              })
              .catch((error) => {
                setNotice(error instanceof Error ? error.message : 'A restauração falhou. Seus dados atuais foram preservados ou o rollback foi acionado.');
              })
              .finally(() => setBusy(false));
          },
        },
      ]
    );
  }

  async function signOut() {
    if (!client) return;
    Alert.alert('Sair da conta?', 'Os backups na nuvem não serão apagados. A chave de criptografia continuará protegida neste aparelho.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          void client.auth.signOut()
            .then(({ error }) => {
              if (error) throw error;
              setNotice('Você saiu da conta.');
            })
            .catch((error) => setNotice(error instanceof Error ? error.message : 'Falha ao sair.'))
            .finally(() => setBusy(false));
        },
      },
    ]);
  }

  return (
    <View style={styles.page}>
      <DotGridBackground />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>‹ Voltar</Text>
        </Pressable>

        <Text style={styles.title}>☁ Backup privado</Text>
        <Text style={styles.subtitle}>
          Uma cópia criptografada do seu diário. O SQLite continua sendo o banco principal do aplicativo.
        </Text>

        {!isSupabaseConfigured() ? (
          <View style={styles.card}>
            <Text style={styles.heading}>Configuração necessária</Text>
            <Text style={styles.body}>
              Crie seu projeto Supabase, execute o arquivo supabase/setup.sql e configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY em .env.local.
            </Text>
            <Text style={styles.warning}>
              Nunca coloque uma chave service_role no aplicativo. Use somente a publishable key.
            </Text>
            <Text style={styles.body}>Depois reinicie o Expo e gere um novo APK.</Text>
          </View>
        ) : loadingSession ? (
          <View style={styles.card}><ActivityIndicator color="#454654" /></View>
        ) : !session ? (
          <View style={styles.card}>
            <Text style={styles.heading}>
              {authMode === 'signup' ? 'Criar minha conta pessoal' : 'Entrar na minha conta'}
            </Text>
            <Text style={styles.body}>
              Esta conta será usada somente para proteger seus próprios backups.
            </Text>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="seu@email.com"
              style={styles.input}
            />
            <Text style={styles.label}>Senha</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType={authMode === 'signup' ? 'newPassword' : 'password'}
              placeholder="Pelo menos 8 caracteres"
              style={styles.input}
            />
            <Pressable disabled={busy} style={[styles.button, busy && styles.disabled]} onPress={() => void submitAuth()}>
              {busy ? <ActivityIndicator color="#454654" /> : (
                <Text style={styles.buttonText}>
                  {authMode === 'signup' ? 'Criar conta' : 'Entrar'}
                </Text>
              )}
            </Pressable>
            <Pressable onPress={() => setAuthMode(authMode === 'signup' ? 'signin' : 'signup')}>
              <Text style={styles.link}>
                {authMode === 'signup' ? 'Já tenho uma conta — entrar' : 'Ainda não tenho conta — criar'}
              </Text>
            </Pressable>
            <Text style={styles.warning}>
              Depois de criar sua única conta, desative novos cadastros em Authentication → Settings no painel Supabase.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.heading}>Conta conectada</Text>
              <Text style={styles.body}>{session.user.email}</Text>
              <Text style={styles.meta}>Bucket privado · criptografia antes do envio · acesso restrito por usuário.</Text>
              <Pressable disabled={busy} style={styles.secondaryButton} onPress={() => void signOut()}>
                <Text style={styles.buttonText}>Sair da conta</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>1. Chave de recuperação</Text>
              <Text style={styles.body}>
                Essa chave protege seus backups com AES-256-GCM. Ela não é enviada ao Supabase. Sem ela, os arquivos não poderão ser recuperados em outro aparelho.
              </Text>

              {!keyExists ? (
                <>
                  <Pressable disabled={busy} style={styles.button} onPress={() => void createKey()}>
                    <Text style={styles.buttonText}>Gerar minha chave de recuperação</Text>
                  </Pressable>
                  <Pressable onPress={() => setShowImport((current) => !current)}>
                    <Text style={styles.link}>Já tenho uma chave e quero importá-la</Text>
                  </Pressable>
                  {showImport && (
                    <>
                      <TextInput
                        value={recoveryInput}
                        onChangeText={setRecoveryInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder="Cole aqui os 64 caracteres hexadecimais"
                        style={styles.input}
                      />
                      <Pressable disabled={busy} style={styles.secondaryButton} onPress={() => void saveImportedKey()}>
                        <Text style={styles.buttonText}>Importar chave</Text>
                      </Pressable>
                    </>
                  )}
                </>
              ) : (
                <>
                  {!!recoveryKey && (
                    <View style={styles.keyBox}>
                      <Text selectable style={styles.keyText}>{recoveryKey}</Text>
                    </View>
                  )}
                  {!recoveryKey && (
                    <Pressable style={styles.secondaryButton} onPress={() => void showKey()}>
                      <Text style={styles.buttonText}>Mostrar chave de recuperação</Text>
                    </Pressable>
                  )}
                  {!keyConfirmed ? (
                    <>
                      <Text style={styles.warning}>
                        Guarde a chave em um gerenciador de senhas ou em local físico seguro. Não a envie por mensagem nem a armazene junto ao backup.
                      </Text>
                      <Pressable disabled={busy || !recoveryKey} style={[styles.button, (busy || !recoveryKey) && styles.disabled]} onPress={() => void confirmKey()}>
                        <Text style={styles.buttonText}>Já guardei minha chave</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Text style={styles.meta}>Chave protegida neste aparelho e confirmada.</Text>
                  )}
                </>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>2. Backup criptografado</Text>
              <Text style={styles.body}>
                O aplicativo verifica a integridade SQLite, prepara um snapshot consistente, criptografa localmente e só então envia o arquivo.
              </Text>
              <Pressable
                disabled={busy || !keyConfirmed}
                style={[styles.button, (busy || !keyConfirmed) && styles.disabled]}
                onPress={() => void sendBackup()}
              >
                {busy ? <ActivityIndicator color="#454654" /> : <Text style={styles.buttonText}>Enviar backup agora</Text>}
              </Pressable>
              <Text style={styles.meta}>
                Verificação automática diária ao abrir esta central, se a chave estiver confirmada e já tiver passado 24 horas desde o último envio bem-sucedido.
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.heading}>3. Backups na nuvem</Text>
                <Pressable onPress={() => void refreshBackups()}><Text style={styles.link}>Atualizar</Text></Pressable>
              </View>
              {backups.length === 0 ? (
                <Text style={styles.body}>Nenhum backup encontrado nesta conta.</Text>
              ) : (
                backups.map((backup) => (
                  <View key={backup.name} style={styles.backupItem}>
                    <Text style={styles.backupName}>{backup.name}</Text>
                    <Text style={styles.meta}>{formatDate(backup.createdAt)} · {formatBytes(backup.bytes)}</Text>
                    <Pressable
                      disabled={busy || !keyConfirmed}
                      style={[styles.secondaryButton, (busy || !keyConfirmed) && styles.disabled]}
                      onPress={() => void prepareRestore(backup)}
                    >
                      <Text style={styles.buttonText}>Baixar e verificar para restaurar</Text>
                    </Pressable>
                  </View>
                ))
              )}
              <Text style={styles.warning}>
                Você pode baixar, verificar e restaurar qualquer backup listado usando sua chave de recuperação.
              </Text>
            </View>

            {!!preparedRestore && (
              <View style={styles.card}>
                <Text style={styles.heading}>4. Conferir restauração</Text>
                <Text style={styles.body}>Arquivo: {preparedRestoreName}</Text>
                <Text style={styles.meta}>
                  SQLite íntegro · {preparedRestore.preview.tables.length} tabelas · {preparedRestore.preview.totalRows} registros · {formatBytes(preparedRestore.preview.bytes)}
                </Text>
                <Text style={styles.body}>
                  Tabelas verificadas: {preparedRestore.preview.tables.join(', ')}
                </Text>
                <Text style={styles.warning}>
                  A restauração substitui o banco inteiro do aparelho. Não mescla registros. Antes da troca, o aplicativo cria uma cópia do banco atual em Documents.
                </Text>
                <Text style={styles.label}>Digite RESTAURAR para confirmar</Text>
                <TextInput
                  value={restorePhrase}
                  onChangeText={setRestorePhrase}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="RESTAURAR"
                  style={styles.input}
                />
                <Pressable
                  disabled={busy || restorePhrase !== 'RESTAURAR'}
                  style={[styles.dangerButton, (busy || restorePhrase !== 'RESTAURAR') && styles.disabled]}
                  onPress={() => void confirmCloudRestore()}
                >
                  <Text style={styles.buttonText}>Restaurar banco completo</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  style={styles.secondaryButton}
                  onPress={() => {
                    setPreparedRestore(null);
                    setPreparedRestoreName('');
                    setRestorePhrase('');
                  }}
                >
                  <Text style={styles.buttonText}>Cancelar restauração</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {!!notice && <Text style={styles.notice}>{notice}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FAF7F0' },
  content: { padding: 22, paddingTop: 50, paddingBottom: 90, gap: 16 },
  back: { color: '#454654', fontSize: 16 },
  title: { fontSize: 27, fontWeight: '700', color: '#454654' },
  subtitle: { fontSize: 14, color: '#64626B', lineHeight: 21 },
  card: { backgroundColor: '#FFFDF9', borderRadius: 18, padding: 18, gap: 12, borderColor: '#E7E1D8', borderWidth: 1 },
  heading: { fontSize: 18, color: '#454654', fontWeight: '700', flex: 1 },
  body: { fontSize: 14, color: '#55525D', lineHeight: 21 },
  label: { color: '#55525D', fontSize: 13, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#D7CBD0', paddingHorizontal: 13, borderRadius: 12, color: '#454654', backgroundColor: '#FFFFFF' },
  button: { minHeight: 49, backgroundColor: '#F7DDE6', justifyContent: 'center', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14 },
  secondaryButton: { minHeight: 45, backgroundColor: '#EEEAF4', justifyContent: 'center', alignItems: 'center', borderRadius: 13, paddingHorizontal: 14 },
  dangerButton: { minHeight: 49, backgroundColor: '#E7B2BC', justifyContent: 'center', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14 },
  disabled: { opacity: 0.45 },
  buttonText: { color: '#454654', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  link: { color: '#80627B', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  warning: { color: '#9E5360', fontSize: 12, lineHeight: 19 },
  meta: { color: '#56765D', fontSize: 12, lineHeight: 19 },
  keyBox: { borderWidth: 1, borderColor: '#D7CBD0', borderRadius: 12, backgroundColor: '#F7F3F7', padding: 12 },
  keyText: { color: '#454654', fontSize: 13, lineHeight: 21, letterSpacing: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backupItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEE7E1', gap: 4 },
  backupName: { color: '#454654', fontSize: 13, fontWeight: '600' },
  notice: { color: '#5A6F5E', backgroundColor: '#EEF3ED', borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 19 },
});
