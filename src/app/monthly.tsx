import { listPersonalDaysByMonth, type PersonalDay } from '../database/personalTrackingRepository';
import { MOOD_OPTIONS } from '../components/PersonalDayTracker';
import KeyboardAwareJournalScrollView from '../components/KeyboardAwareJournalScrollView';
import DotGridBackground from '../components/DotGridBackground';
import {
  listEventsByMonth,
  type JournalEvent,
} from '../database/eventRepository';
import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';

import {
  getMonthlyTracker,
  MonthlyTracker,
} from '../database/monthlyRepository';

const C = {
  paper: '#FAF7F0',
  card: '#FFFDF9',
  ink: '#454654',
  sage: '#90AE98',
  line: '#E7E1D8',
};

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function dateKey(year: number, month: number, day: number) {
  return (
    `${year}-${String(month).padStart(2, '0')}-` +
    String(day).padStart(2, '0')
  );
}

export default function MonthlyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    year?: string;
    month?: string;
  }>();
  const [events, setEvents] = useState<JournalEvent[]>([]);
  const [personalDays, setPersonalDays] = useState<PersonalDay[]>([]);
  const requestedYear = Number(params.year);
  const requestedMonth = Number(params.month);

  const hasValidPeriod =
    typeof params.year === 'string' &&
    typeof params.month === 'string' &&
    Number.isInteger(requestedYear) &&
    requestedYear >= 1 &&
    requestedYear <= 9999 &&
    Number.isInteger(requestedMonth) &&
    requestedMonth >= 1 &&
    requestedMonth <= 12;
  const [period, setPeriod] = useState(() => {
    const today = new Date();
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
    };
  });
  useEffect(() => {
    if (!hasValidPeriod) return;

    setPeriod({
      year: requestedYear,
      month: requestedMonth,
    });
  }, [hasValidPeriod, requestedYear, requestedMonth]);

  const [tracker, setTracker] = useState<MonthlyTracker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  
  useFocusEffect(
    useCallback(() => {
      let active = true;

      setLoading(true);
      setError(null);

      async function loadMonth() {
        try {
          const [monthlyData, monthlyEvents, monthlyPersonalDays] = await Promise.all([
            getMonthlyTracker(period.year, period.month),
            listEventsByMonth(period.year, period.month),
            listPersonalDaysByMonth(period.year, period.month),
          ]);

          if (!active) return;

          setTracker(monthlyData);
          setEvents(monthlyEvents);
          setPersonalDays(monthlyPersonalDays);
        } catch (err) {
          if (!active) return;

          console.error('Erro ao carregar mês:', err);
          setError('Não foi possível carregar o calendário.');
        } finally {
          if (active) setLoading(false);
        }
      }

      void loadMonth();

      return () => {
        active = false;
      };
    }, [period.year, period.month])
  );


  function changeMonth(amount: number) {
    setPeriod((current) => {
      const next = new Date(
        current.year,
        current.month - 1 + amount,
        1
      );

      return {
        year: next.getFullYear(),
        month: next.getMonth() + 1,
      };
    });
  }

  function openDay(day: number) {
    router.push({
      pathname: '/',
      params: {
        date: dateKey(period.year, period.month, day),
      },
    });
  }

  const monthName = new Date(
    period.year,
    period.month - 1,
    1
  ).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  const firstWeekday = new Date(
    period.year,
    period.month - 1,
    1
  ).getDay();

  const totalDays =
    tracker?.daysInMonth ??
    new Date(period.year, period.month, 0).getDate();

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  const eventCountByDay = new Map<number, number>();

  for (const event of events) {
    const day = Number(event.date.slice(8, 10));

    eventCountByDay.set(
      day,
      (eventCountByDay.get(day) ?? 0) + 1
    );
  }

  const completedByDay = new Map<number, number>();

  for (const habit of tracker?.habits ?? []) {
    for (const day of habit.completedDays) {
      completedByDay.set(
        day,
        (completedByDay.get(day) ?? 0) + 1
      );
    }
  }

  const personalByDay = new Map<number, PersonalDay>();
  for (const value of personalDays) personalByDay.set(Number(value.date.slice(8, 10)), value);

  const today = new Date();

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DotGridBackground />
      <KeyboardAwareJournalScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Voltar</Text>
        </Pressable>

        <Text style={styles.title}>Meu mês ✿</Text>
        <Text style={styles.subtitle}>
          Um pouquinho de progresso a cada dia.
        </Text>

        <View style={styles.card}>
          <View style={styles.monthHeader}>
            <Pressable
              accessibilityLabel="Mês anterior"
              onPress={() => changeMonth(-1)}
            >
              <Text style={styles.arrow}>‹</Text>
            </Pressable>

            <Text style={styles.monthTitle}>{monthName}</Text>

            <Pressable
              accessibilityLabel="Próximo mês"
              onPress={() => changeMonth(1)}
            >
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          </View>

          <View style={styles.calendar}>
            {WEEKDAYS.map((label, index) => (
              <View key={`week-${index}`} style={styles.cell}>
                <Text style={styles.weekday}>{label}</Text>
              </View>
            ))}

            {cells.map((day, index) => {
              const isToday =
                day !== null &&
                period.year === today.getFullYear() &&
                period.month === today.getMonth() + 1 &&
                day === today.getDate();

              return (
                <Pressable
                  key={`day-${index}`}
                  style={styles.cell}
                  disabled={day === null}
                  onPress={() => day !== null && openDay(day)}
                >
                  {day !== null && (
                    <>
                      <View
                        style={[
                          styles.dayCircle,
                          isToday && styles.todayCircle,
                        ]}
                      >
                        <Text style={styles.dayText}>{day}</Text>
                      </View>

                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 4,
                          height: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {(eventCountByDay.get(day) ?? 0) > 0 && (
                          <View
                            style={[
                              styles.dot,
                              { backgroundColor: '#D69AAF', marginTop: 0 },
                            ]}
                          />
                        )}

                        {personalByDay.get(day)?.mood && (
                          <View style={[styles.dot, {
                            backgroundColor: MOOD_OPTIONS.find(o => o.value === personalByDay.get(day)?.mood)?.color ?? '#C9C5E8',
                          }]} />
                        )}
                        {personalByDay.get(day)?.menstruating && <Text style={{ fontSize: 10, color: '#BF537B', marginTop: -4 }}>♥</Text>}
                        {(completedByDay.get(day) ?? 0) > 0 && (
                          <View
                            style={[
                              styles.dot,
                              { backgroundColor: '#90AE98', marginTop: 0 },
                            ]}
                          />
                        )}
                      </View>

                    </>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.hint}>
            Toque em um dia para abrir seu diário. O ponto verde
            indica hábitos concluídos. As cores representam o humor e o coração marca menstruação.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          ✿ Eventos do mês
        </Text>

        <View style={styles.card}>
          {loading ? (
            <ActivityIndicator color={C.sage} />
          ) : error ? (
            <Text style={styles.subtitle}>{error}</Text>
          ) : events.length === 0 ? (
            <Text style={styles.hint}>
              Nenhum evento cadastrado neste mês.
            </Text>
          ) : (
            events.map((event) => (
              <Pressable
                key={event.id}
                onPress={() =>
                  router.push({
                    pathname: '/events',
                    params: { date: event.date },
                  })
                }
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: '#E7E1D8',
                }}
              >
                <Text
                  style={{
                    fontWeight: '700',
                    color: C.ink,
                    fontSize: 14,
                  }}
                >
                  {event.title}
                </Text>

                <Text
                  style={{
                    color: '#8F8B90',
                    marginTop: 5,
                    fontSize: 12,
                  }}
                >
                  {event.date.split('-').reverse().join('/')}
                  {' · '}
                  {event.time
                    ? event.endTime
                      ? `${event.time} – ${event.endTime}`
                      : event.time
                    : 'Dia inteiro'}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Humor e ciclo do mês</Text>
        <View style={styles.card}>
          <Text style={styles.hint}>Deslize para conferir todos os dias. Toque em uma data para editar no diário.</Text>
          <View style={styles.legend}>
            {MOOD_OPTIONS.map(option => (
              <View key={option.value} style={styles.legendItem}>
                <View style={[styles.moodDot, { backgroundColor: option.color }]} />
                <Text style={styles.legendText}>{option.label}</Text>
              </View>
            ))}
            <Text style={styles.legendText}>♥ Menstruação</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={styles.trackerRow}>
                <View style={styles.nameCell}><Text style={styles.tableText}>Dia</Text></View>
                {Array.from({ length: totalDays }, (_, i) => (
                  <View key={i} style={styles.gridCell}><Text style={styles.tableText}>{i + 1}</Text></View>
                ))}
              </View>
              {(['mood', 'period'] as const).map(kind => (
                <View key={kind} style={styles.trackerRow}>
                  <View style={styles.nameCell}>
                    <Text style={styles.habitName}>{kind === 'mood' ? 'Humor' : 'Ciclo ♡'}</Text>
                  </View>
                  {Array.from({ length: totalDays }, (_, i) => {
                    const value = personalByDay.get(i + 1);
                    const mood = MOOD_OPTIONS.find(o => o.value === value?.mood);
                    return (
                      <Pressable key={i} style={styles.gridCell} onPress={() => openDay(i + 1)}
                        accessibilityLabel={`Abrir dia ${i + 1} para registrar ${kind === 'mood' ? 'humor' : 'menstruação'}`}>
                        {kind === 'mood' ? (
                          mood ? <View style={[styles.moodDot, { backgroundColor: mood.color }]} />
                               : <Text style={styles.emptyMark}>·</Text>
                        ) : (
                          <Text style={[styles.heartMark, !value?.menstruating && styles.emptyMark]}>
                            {value?.menstruating ? '♥' : '·'}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
          <Text style={styles.hint}>Registros opcionais; nenhuma previsão automática do ciclo.</Text>
        </View>

        <Text style={styles.sectionTitle}>
          Acompanhamento de hábitos
        </Text>

        {loading ? (
          <ActivityIndicator color={C.sage} />
        ) : error ? (
          <Text style={styles.subtitle}>{error}</Text>
        ) : tracker && tracker.habits.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.hint}>
              Deslize a tabela para visualizar todos os dias.
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={styles.trackerRow}>
                  <View style={styles.nameCell}>
                    <Text style={styles.tableText}>Hábito</Text>
                  </View>

                  {Array.from(
                    { length: tracker.daysInMonth },
                    (_, i) => (
                      <View key={i} style={styles.gridCell}>
                        <Text style={styles.tableText}>{i + 1}</Text>
                      </View>
                    )
                  )}
                </View>

                {tracker.habits.map((habit) => (
                  <View key={habit.id} style={styles.trackerRow}>
                    <View style={styles.nameCell}>
                      <Text
                        style={styles.habitName}
                        numberOfLines={2}
                      >
                        {habit.title}
                      </Text>
                    </View>

                    {Array.from(
                      { length: tracker.daysInMonth },
                      (_, i) => {
                        const completed =
                          habit.completedDays.includes(i + 1);

                        return (
                          <Pressable
                            key={i}
                            onPress={() => openDay(i + 1)}
                            style={styles.gridCell}
                          >
                            <View
                              style={[
                                styles.gridSquare,
                                completed && {
                                  backgroundColor: habit.color,
                                },
                              ]}
                            >
                              {completed && (
                                <Text style={styles.check}>✓</Text>
                              )}
                            </View>
                          </Pressable>
                        );
                      }
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.hint}>
              As marcações são compartilhadas com o diário.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.subtitle}>
              Nenhum hábito disponível para este mês.
            </Text>
          </View>
        )}
      </KeyboardAwareJournalScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 10, color: '#77717B' },
  moodDot: { width: 15, height: 15, borderRadius: 8 },
  heartMark: { color: '#BF537B', fontSize: 16 },
  emptyMark: { color: '#B9B7AE', fontSize: 15 },
  container: { flex: 1, backgroundColor: C.paper },
  content: {
    padding: 20,
    paddingTop: 45,
    paddingBottom: 50,
  },
  back: {
    color: C.sage,
    fontWeight: '700',
    marginBottom: 22,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: C.ink,
  },
  subtitle: {
    color: '#8F8B90',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 18,
  },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 16,
    marginBottom: 22,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'capitalize',
    color: C.ink,
  },
  arrow: {
    fontSize: 30,
    color: C.sage,
    paddingHorizontal: 12,
  },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    height: 53,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: {
    color: '#8F8B90',
    fontWeight: '700',
    fontSize: 12,
  },
  dayCircle: {
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: { backgroundColor: '#E8EDE4' },
  dayText: { color: C.ink, fontSize: 13 },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.sage,
    marginTop: 2,
  },
  hint: {
    color: '#99969A',
    fontSize: 11,
    marginTop: 12,
    lineHeight: 17,
  },
  sectionTitle: {
    color: C.ink,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  trackerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameCell: {
    width: 115,
    minHeight: 38,
    justifyContent: 'center',
    paddingRight: 8,
  },
  habitName: {
    color: C.ink,
    fontSize: 12,
  },
  tableText: {
    color: '#8F8B90',
    fontSize: 11,
    textAlign: 'center',
  },
  gridCell: {
    width: 29,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridSquare: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: '#F0EDE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    color: C.ink,
    fontWeight: '800',
    fontSize: 12,
  },
});
