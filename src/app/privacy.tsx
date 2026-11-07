import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import DotGridBackground from '../components/DotGridBackground';
export default function PrivacyScreen() {
  const router = useRouter();
  return <View style={s.page}><DotGridBackground /><ScrollView contentContainerStyle={s.content}>
    <Pressable onPress={() => router.back()}><Text style={s.link}>‹ Voltar</Text></Pressable>
    <Text style={s.title}>✿ Privacidade e seus dados</Text>
    <View style={s.card}><Text style={s.heading}>Onde ficam os registros?</Text>
      <Text style={s.body}>Diário, hábitos, metas, humor, menstruação, rotina e eventos são gravados no SQLite deste aplicativo, no dispositivo. Não há login nem sincronização com Supabase implementados nesta versão.</Text></View>
    <View style={s.card}><Text style={s.heading}>Quem controla os backups?</Text>
      <Text style={s.body}>Você escolhe para onde compartilhar os arquivos .sqlite. Eles não são criptografados pelo aplicativo; podem incluir informações íntimas. Evite pastas compartilhadas e faça a limpeza de cópias antigas quando não forem mais necessárias.</Text></View>
    <View style={s.card}><Text style={s.heading}>Restauração</Text>
      <Text style={s.body}>A restauração substitui todos os dados atuais e não mistura registros. É preciso validar o backup e confirmar a substituição. O aplicativo cria uma cópia de segurança local antes de tentar restaurar; guarde também um backup externo antes de usar esta opção.</Text></View>
    <View style={s.card}><Text style={s.heading}>Limites</Text>
      <Text style={s.body}>Não existe criptografia de banco, acesso por senha ou sincronização nesta entrega. Os lembretes locais só são ativados quando você permite; não enviam seus registros para servidores. Ao desinstalar ou limpar os dados do aplicativo, o banco local pode ser excluído. Notificações e serviços externos exigirão consentimento e configuração futura.</Text></View>
  </ScrollView></View>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:'#FAF7F0'},content:{padding:22,paddingTop:50,paddingBottom:70,gap:16},link:{fontSize:16,color:'#454654'},title:{fontSize:26,fontWeight:'700',color:'#454654'},card:{padding:18,borderRadius:16,backgroundColor:'#FFFDF9',borderWidth:1,borderColor:'#E7E1D8',gap:8},heading:{fontSize:17,fontWeight:'700',color:'#454654'},body:{fontSize:14,color:'#55525D',lineHeight:22}});
