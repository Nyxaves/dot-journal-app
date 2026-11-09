import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import DotGridBackground from '../components/DotGridBackground';
import { disableDailyReminder, listDailyReminders, saveDailyReminder, sendTestReminder } from '../services/reminderService';
import { getUpcomingEventReminders, syncEventReminders } from '../services/eventReminderService';

const C = { paper: '#FAF7F0', card: '#FFFDF9', ink: '#454654', line: '#E7E1D8', pink: '#F7DDE6', muted: '#77727C' };
const toNumber = (v: string) => /^\d{1,2}$/.test(v) ? Number(v) : NaN;

export default function RemindersScreen() {
  const router = useRouter();
  const [hour, setHour] = useState('20');
  const [minute, setMinute] = useState('00');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [upcomingEvents, setUpcomingEvents] = useState<Awaited<ReturnType<typeof getUpcomingEventReminders>>>([]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const saved = await listDailyReminders();
      const eventPlan = await getUpcomingEventReminders();
      setUpcomingEvents(eventPlan);
      const syncResult = await syncEventReminders();
      if (!syncResult.permissions && eventPlan.length > 0) {
        setError('Ative as permissões de notificação nas configurações do celular para receber os avisos dos eventos.');
      }
      if (saved.length) {
        setEnabled(true);
        const trigger = saved[0].trigger;
        if (trigger && 'hour' in trigger && typeof trigger.hour === 'number') {
          setHour(String(trigger.hour).padStart(2, '0'));
        }
        if (trigger && 'minute' in trigger && typeof trigger.minute === 'number') {
          setMinute(String(trigger.minute).padStart(2, '0'));
        }
      } else { setEnabled(false); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao carregar lembretes.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    try { await action(); await load(); Alert.alert('Pronto!', success); }
    catch (e) { Alert.alert('Não foi possível', e instanceof Error ? e.message : 'Tente novamente.'); }
    finally { setBusy(false); }
  };

  return <View style={s.page}>
    <DotGridBackground />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Pressable onPress={() => router.back()}><Text style={s.back}>‹ Voltar</Text></Pressable>
      <Text style={s.title}>✿ Meus lembretes</Text>
      <Text style={s.desc}>Reserve alguns minutos do dia para cuidar do seu journal. O lembrete é opcional e fica agendado no próprio celular.</Text>
      <View style={s.card}>
        <Text style={s.heading}>Lembrete diário</Text>
        {loading ? <ActivityIndicator /> : <Text style={s.status}>{enabled ? '● Ativado' : '○ Desativado'}</Text>}
        <Text style={s.label}>Horário (24 horas)</Text>
        <View style={s.row}>
          <TextInput style={s.input} value={hour} onChangeText={setHour} maxLength={2} keyboardType="number-pad" placeholder="20" accessibilityLabel="Hora do lembrete" />
          <Text style={s.sep}>:</Text>
          <TextInput style={s.input} value={minute} onChangeText={setMinute} maxLength={2} keyboardType="number-pad" placeholder="00" accessibilityLabel="Minuto do lembrete" />
        </View>
        <Pressable disabled={busy || loading} style={[s.button,s.primary]} onPress={() => void run(() => saveDailyReminder(toNumber(hour),toNumber(minute)), 'Lembrete diário agendado.')}>
          <Text style={s.buttonText}>Salvar e ativar</Text>
        </Pressable>
        <Pressable disabled={busy || loading || !enabled} style={s.button} onPress={() => void run(disableDailyReminder, 'Lembrete desativado.')}>
          <Text style={s.buttonText}>Desativar lembrete</Text>
        </Pressable>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>Testar notificações</Text>
        <Text style={s.desc}>Agenda um aviso para aproximadamente 10 segundos. Mantenha o app em segundo plano para testar.</Text>
        <Pressable disabled={busy || loading} style={[s.button,s.primary]} onPress={() => void run(sendTestReminder, 'A notificação de teste foi agendada.')}>
          <Text style={s.buttonText}>Enviar teste</Text>
        </Pressable>
      </View>
      <View style={s.card}>
        <Text style={s.heading}>Próximos avisos da agenda</Text>
        <Text style={s.desc}>Lembretes dos seus compromissos, eventos recorrentes e aniversários.</Text>
        {upcomingEvents.length === 0 ? (
          <Text style={s.status}>Nenhum aviso de evento agendado. Cadastre um evento com lembrete na agenda.</Text>
        ) : upcomingEvents.slice(0, 20).map((item, index) => (
          <View key={`${item.eventId}-${item.occurrenceDate}-${index}`} style={s.upcomingItem}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.upcomingTitle}>{item.type === 'birthday' ? '🎂 ' : '✿ '}{item.title}</Text>
              <Text style={s.status}>{item.occurrenceDate.split('-').reverse().join('/')} · {item.eventTime}</Text>
            </View>
            <Text style={s.upcomingTime}>{item.triggerAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        ))}
        <Text style={s.note}>A agenda mantém uma fila local dos próximos 24 avisos em até 400 dias. Ao abrir esta tela ou a agenda, a fila é atualizada. O Android pode atrasar notificações por economia de bateria.</Text>
      </View>
      {!!error && <Text style={s.error}>{error}</Text>}
      <Text style={s.note}>O Android pode atrasar lembretes devido à economia de bateria. Não use como alarme crítico. O horário segue o fuso local do aparelho; alterações de fuso ou permissões podem afetar a entrega.</Text>
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  page:{flex:1,backgroundColor:C.paper}, content:{padding:22,paddingTop:52,paddingBottom:96,gap:16},
  back:{color:C.ink,fontSize:16},title:{fontSize:27,fontWeight:'700',color:C.ink},
  desc:{fontSize:14,color:C.muted,lineHeight:21},
  card:{backgroundColor:C.card,borderRadius:17,borderWidth:1,borderColor:C.line,padding:17,gap:13},
  heading:{fontSize:17,fontWeight:'700',color:C.ink},status:{color:C.muted},
  label:{color:C.ink,fontWeight:'600'},row:{flexDirection:'row',alignItems:'center',gap:10},
  input:{borderWidth:1,borderColor:C.line,borderRadius:10,width:75,padding:12,fontSize:20,textAlign:'center',color:C.ink,backgroundColor:'white'},
  sep:{fontSize:22,color:C.ink},button:{padding:14,borderRadius:12,backgroundColor:C.line,alignItems:'center'},
  primary:{backgroundColor:C.pink},buttonText:{color:C.ink,fontWeight:'700'},
  note:{fontSize:12,lineHeight:19,color:C.muted},error:{color:'#AE4040',fontSize:13},
  upcomingItem:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10,borderBottomWidth:1,borderBottomColor:C.line},
  upcomingTitle:{fontSize:14,fontWeight:'700',color:C.ink},
  upcomingTime:{fontSize:13,fontWeight:'700',color:C.ink,backgroundColor:C.pink,paddingHorizontal:10,paddingVertical:7,borderRadius:9},
});
