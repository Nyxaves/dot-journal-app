import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import DotGridBackground from '../components/DotGridBackground';
import { applyRestore, prepareRestore, type PreparedRestore } from '../database/restoreRepository';

export default function RestoreScreen() {
  const router = useRouter();
  const [prepared, setPrepared] = useState<PreparedRestore | null>(null);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  async function inspectFile() {
    setBusy(true); setResult(''); setPrepared(null); setPhrase('');
    try { setPrepared(await prepareRestore()); }
    catch (e) { Alert.alert('Arquivo rejeitado', e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function restore() {
    if (!prepared || phrase !== 'RESTAURAR' || busy) return;
    Alert.alert('Substituir todos os registros?',
      'Os dados atuais serão substituídos. Uma cópia de segurança será guardada no aparelho. Use primeiro um banco de testes.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Substituir', style: 'destructive', onPress: () => {
          setBusy(true);
          void applyRestore(prepared).then(name => {
            setPrepared(null); setPhrase('');
            setResult(`Restauração concluída. Cópia anterior: ${name}. Feche completamente e reabra o aplicativo agora.`);
            Alert.alert('Restauração concluída', 'Feche completamente e reabra o aplicativo antes de usar outras telas.');
          }).catch(e => Alert.alert('Falha na restauração', e instanceof Error ? e.message : String(e)))
            .finally(() => setBusy(false));
        } },
      ]);
  }
  return <View style={s.page}><DotGridBackground /><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()}><Text style={s.back}>‹ Voltar</Text></Pressable>
    <Text style={s.title}>♡ Recuperar meus registros</Text>
    <Text style={s.body}>Selecione um backup SQLite. Antes de qualquer mudança, o arquivo será analisado em um banco isolado.</Text>
    <View style={s.card}><Text style={s.heading}>1. Verificar arquivo</Text>
      <Pressable style={[s.btn, busy && s.disabled]} disabled={busy || Platform.OS === 'web'} onPress={() => void inspectFile()}>
        {busy ? <ActivityIndicator /> : <Text style={s.btnText}>Escolher arquivo .sqlite</Text>}
      </Pressable>
      {prepared && <><Text style={s.body}>Arquivo: {prepared.preview.fileName}</Text>
        <Text style={s.body}>Integridade: {prepared.preview.integrity} · {prepared.preview.tables.length} tabelas · {prepared.preview.totalRows} registros · {prepared.preview.bytes} bytes</Text>
        <Text style={s.warning}>ATENÇÃO: a restauração substitui o banco INTEIRO, incluindo humor, ciclo menstrual, metas e eventos. Não mescla informações.</Text>
      </>}
    </View>
    {prepared && <View style={s.card}><Text style={s.heading}>2. Confirmação obrigatória</Text>
      <Text style={s.warning}>Recurso experimental: use primeiro com um backup de teste. Exporte e guarde o banco atual em local externo ANTES de prosseguir.</Text>
      <Text style={s.body}>Digite RESTAURAR para liberar a substituição:</Text>
      <TextInput style={s.input} value={phrase} onChangeText={setPhrase} autoCapitalize="characters" placeholder="RESTAURAR" />
      <Pressable disabled={busy || phrase !== 'RESTAURAR'} onPress={() => void restore()} style={[s.danger, (busy || phrase !== 'RESTAURAR') && s.disabled]}><Text style={s.btnText}>Restaurar banco completo</Text></Pressable>
    </View>}
    {!!result && <Text style={s.success}>{result}</Text>}
    <Text style={s.warning}>Os arquivos SQLite contêm dados pessoais. Não compartilhe seus backups publicamente. Não desinstale o aplicativo durante a restauração.</Text>
  </ScrollView></View>;
}
const s = StyleSheet.create({
  page:{flex:1,backgroundColor:'#FAF7F0'},content:{padding:22,paddingTop:50,paddingBottom:85,gap:18},back:{fontSize:16,color:'#454654'},
  title:{fontSize:25,fontWeight:'700',color:'#454654'},body:{fontSize:14,color:'#55525D',lineHeight:21},
  card:{backgroundColor:'#FFFDF9',borderRadius:17,borderWidth:1,borderColor:'#E7E1D8',padding:17,gap:13},heading:{fontWeight:'700',fontSize:17,color:'#454654'},
  warning:{color:'#9E5360',fontSize:13,lineHeight:21},success:{color:'#476D53',fontSize:14},
  btn:{backgroundColor:'#F7DDE6',padding:15,borderRadius:13,alignItems:'center'},danger:{backgroundColor:'#E7B2BC',padding:15,borderRadius:13,alignItems:'center'},
  btnText:{fontWeight:'700',color:'#454654'},disabled:{opacity:0.45},input:{borderWidth:1,borderColor:'#D7CBD0',padding:12,borderRadius:10,color:'#454654',backgroundColor:'white'}
});
