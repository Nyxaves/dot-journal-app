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
      <Text style={s.body}>Diário, hábitos, metas, humor, menstruação, rotina e eventos continuam gravados no SQLite deste aparelho. Opcionalmente, você pode entrar em sua conta pessoal e enviar cópias criptografadas do banco para um bucket privado do Supabase. Não há sincronização de registros entre dispositivos.</Text></View>
    <View style={s.card}><Text style={s.heading}>Quem controla os backups?</Text>
      <Text style={s.body}>O backup manual .sqlite continua sem criptografia própria do aplicativo. Já o backup privado na nuvem é criptografado no aparelho com AES-256-GCM antes do envio. A chave de recuperação não é enviada ao Supabase e precisa ser guardada fora do celular.</Text></View>
    <View style={s.card}><Text style={s.heading}>Restauração</Text>
      <Text style={s.body}>A restauração substitui todos os dados atuais e não mistura registros. É preciso validar o backup e confirmar a substituição. O aplicativo cria uma cópia de segurança local antes de tentar restaurar; guarde também um backup externo antes de usar esta opção.</Text></View>
    <View style={s.card}><Text style={s.heading}>Limites</Text>
      <Text style={s.body}>O banco SQLite local não é criptografado individualmente. O backup privado na nuvem exige conta Supabase, bucket privado e chave de recuperação. Se a chave for perdida, os arquivos criptografados não poderão ser recuperados. Ao desinstalar ou limpar os dados do aplicativo Android, o banco local e a chave armazenada no SecureStore podem ser perdidos. Guarde a chave fora do aparelho.</Text></View>
  </ScrollView></View>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:'#FAF7F0'},content:{padding:22,paddingTop:50,paddingBottom:70,gap:16},link:{fontSize:16,color:'#454654'},title:{fontSize:26,fontWeight:'700',color:'#454654'},card:{padding:18,borderRadius:16,backgroundColor:'#FFFDF9',borderWidth:1,borderColor:'#E7E1D8',gap:8},heading:{fontSize:17,fontWeight:'700',color:'#454654'},body:{fontSize:14,color:'#55525D',lineHeight:22}});
