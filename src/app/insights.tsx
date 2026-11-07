import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import DotGridBackground from '../components/DotGridBackground';
import { getMonthInsights, type MonthInsights } from '../database/insightsRepository';

const moodItems = [
  { key: 'great', name: 'Ótimo', color: '#75A9E2' },
  { key: 'good', name: 'Bom', color: '#90BF9B' },
  { key: 'neutral', name: 'Neutro', color: '#E9B36C' },
  { key: 'bad', name: 'Ruim', color: '#E28B8B' },
] as const;

export default function InsightsScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1 }; });
  const [data, setData] = useState<MonthInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    getMonthInsights(period.year, period.month).then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Erro ao carregar'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period.year, period.month]));
  const shift = (amount: number) => setPeriod(current => {
    const d = new Date(current.year, current.month - 1 + amount, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const moodTotal = data ? Object.values(data.mood).reduce((a, b) => a + b, 0) : 0;
  return (
    <View style={s.page}><DotGridBackground />
      <ScrollView contentContainerStyle={s.content}>
        <Pressable onPress={() => router.back()}><Text style={s.back}>‹ Voltar</Text></Pressable>
        <Text style={s.title}>✿ Meu mês em números</Text>
        <Text style={s.subtitle}>Resumo dos seus registros locais, sem enviar dados para a internet.</Text>
        <View style={s.monthRow}>
          <Pressable onPress={() => shift(-1)} style={s.arrow}><Text>‹</Text></Pressable>
          <Text style={s.month}>{String(period.month).padStart(2, '0')}/{period.year}</Text>
          <Pressable onPress={() => shift(1)} style={s.arrow}><Text>›</Text></Pressable>
        </View>
        {loading ? <ActivityIndicator color="#90AE98" /> : error ? <Text style={s.warning}>{error}</Text> : data && <>
          <View style={s.grid}>
            <Kpi name="Dias com anotações" value={data.notesDays} />
            <Kpi name="Hábitos concluídos" value={data.habitsCompleted} />
            <Kpi name="Micro-metas concluídas" value={data.goalsCompleted} />
            <Kpi name="Eventos" value={data.events} />
            <Kpi name="Média de sono" value={data.averageSleep == null ? '—' : `${data.averageSleep} h`} />
            <Kpi name="Média de tela" value={data.averageScreen == null ? '—' : `${data.averageScreen} h`} />
          </View>
          <View style={s.card}><Text style={s.heading}>Como foram meus dias?</Text>
            <Text style={s.hint}>{moodTotal} dia(s) com humor registrado</Text>
            {moodItems.map(item => {
              const n = data.mood[item.key];
              return <View key={item.key} style={s.moodRow}>
                <Text style={s.moodName}>{item.name}</Text>
                <View style={s.barBg}><View style={[s.bar, { backgroundColor: item.color, width: `${moodTotal ? n / moodTotal * 100 : 0}%` }]} /></View>
                <Text style={s.num}>{n}</Text>
              </View>;
            })}
            <Text style={s.hint}>♡ {data.periodDays} dia(s) no período</Text>
          </View>
          <Text style={s.hint}>As médias consideram somente os dias com registro. Sem registro não significa zero.</Text>
        </>}
      </ScrollView>
    </View>
  );
}
function Kpi({ name, value }: { name: string; value: string | number }) {
  return <View style={s.kpi}><Text style={s.value}>{value}</Text><Text style={s.kpiName}>{name}</Text></View>;
}
const s = StyleSheet.create({
  page:{flex:1,backgroundColor:'#FAF7F0'}, content:{padding:20,paddingTop:48,paddingBottom:80,gap:15},
  back:{fontSize:16,color:'#454654'}, title:{fontSize:26,fontWeight:'700',color:'#454654'},
  subtitle:{color:'#64626B',lineHeight:21}, monthRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  month:{fontSize:18,fontWeight:'700',color:'#454654'},arrow:{backgroundColor:'#F7DDE6',paddingHorizontal:18,paddingVertical:9,borderRadius:12},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:9},kpi:{width:'48.5%',borderRadius:15,borderColor:'#E7E1D8',borderWidth:1,backgroundColor:'#FFFDF9',padding:16,gap:8},
  value:{fontSize:25,color:'#454654',fontWeight:'700'},kpiName:{fontSize:12,color:'#66646E'},
  card:{padding:18,backgroundColor:'#FFFDF9',borderRadius:16,borderColor:'#E7E1D8',borderWidth:1,gap:13},
  heading:{fontWeight:'700',fontSize:17,color:'#454654'},hint:{fontSize:12,color:'#7D6E78',lineHeight:19},
  moodRow:{flexDirection:'row',alignItems:'center',gap:9},moodName:{width:56,fontSize:12,color:'#454654'},
  barBg:{height:12,flex:1,backgroundColor:'#F0ECE7',borderRadius:7,overflow:'hidden'},bar:{height:'100%',borderRadius:7},
  num:{width:22,textAlign:'right',fontSize:12,color:'#454654'},warning:{color:'#AA5462'}
});
