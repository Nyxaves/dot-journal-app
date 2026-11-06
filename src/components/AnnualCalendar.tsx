import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  listEventsByYear,
  type JournalEvent,
} from '../database/eventRepository';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  year: number;
  onSelectMonth: (month: number) => void;
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março',
  'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro',
  'Outubro', 'Novembro', 'Dezembro',
];

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const C = {
  ink: '#454654',
  paper: '#FFFDF9',
  pink: '#F7DDE6',
  line: '#E7E1D8',
  muted: '#99969A',
};

export default function AnnualCalendar({
  year,
  onSelectMonth,
}: Props) {
  
  const today = new Date();
  
  const [events, setEvents] = useState<JournalEvent[]>([]);
  const [eventsError, setEventsError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setEvents([]);
      setEventsError(false);

      listEventsByYear(year)
        .then((data) => {
          if (active) setEvents(data);
        })
        .catch((error) => {
          console.error('Erro ao carregar eventos anuais:', error);
          if (active) setEventsError(true);
        });

      return () => {
        active = false;
      };
    }, [year])
  );

  // Cada data aparece apenas uma vez no conjunto,
  // mesmo que existam vários eventos no mesmo dia.
  const eventDates = new Set(events.map((event) => event.date));

  function hasEvent(month: number, day: number): boolean {
    const key =
      `${String(year).padStart(4, '0')}-` +
      `${String(month).padStart(2, '0')}-` +
      `${String(day).padStart(2, '0')}`;

    return eventDates.has(key);
  }

  return (
    <View>
      <Text style={styles.heading}>
        ✿ Meu calendário anual
      </Text>

      <Text style={styles.subtitle}>
        Selecione um mês para visualizar seu planejamento.
      </Text>
      {eventsError && (
        <Text style={{ color: '#B45353', marginBottom: 12 }}>
          Não foi possível carregar os eventos deste ano.
        </Text>
      )}
      <View style={styles.grid}>
        {MONTHS.map((monthName, index) => {
          const month = index + 1;
          const monthPrefix =
            `${String(year).padStart(4, '0')}-` +
            `${String(month).padStart(2, '0')}-`;

          const monthEvents = events.filter((event) =>
            event.date.startsWith(monthPrefix)
          );
          const firstDay = new Date(year, index, 1).getDay();
          const totalDays = new Date(year, month, 0).getDate();

          const isCurrentMonth =
            today.getFullYear() === year &&
            today.getMonth() === index;

          const cells: (number | null)[] = [
            ...Array.from({ length: firstDay }, () => null),
            ...Array.from(
              { length: totalDays },
              (_, i) => i + 1
            ),
          ];

          return (
            <Pressable
              key={month}
              onPress={() => onSelectMonth(month)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${monthName} de ${year}`}
              style={[
                styles.monthCard,
                isCurrentMonth && styles.currentMonth,
              ]}
            >
              <Text style={styles.monthTitle}>
                {monthName}
              </Text>

              <View style={styles.daysGrid}>
                {WEEKDAYS.map((day, i) => (
                  <View key={`w-${i}`} style={styles.dayCell}>
                    <Text style={styles.weekday}>{day}</Text>
                  </View>
                ))}

                {cells.map((day, i) => {
                  const isToday =
                    isCurrentMonth &&
                    day === today.getDate();

                  return (
                    <View key={i} style={styles.dayCell}>
                      {day !== null && (
                        <View
                          style={[
                            styles.dayCircle,
                            isToday && styles.todayCircle,
                          ]}
                        >
                          <>
                            <Text style={styles.dayNumber}>
                              {day}
                            </Text>

                            {hasEvent(month, day) && (
                              <View style={styles.eventDot} />
                            )}
                          </>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
              <Text style={styles.monthEventCount}>
                {monthEvents.length === 0
                  ? 'Nenhum evento'
                  : `${monthEvents.length} ${
                      monthEvents.length === 1 ? 'evento' : 'eventos'
                    }`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    monthEventCount: {
    textAlign: 'center',
    color: '#B78498',
    fontSize: 10,
    marginTop: 8,
    fontWeight: '600',
  },
  eventDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D69AAF',
    bottom: -3,
    alignSelf: 'center',
  },

  heading: {
    color: C.ink,
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 7,
  },
  subtitle: {
    color: C.muted,
    fontSize: 12,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  monthCard: {
    width: '48.5%',
    backgroundColor: C.paper,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 9,
    marginBottom: 12,
  },
  currentMonth: {
    borderColor: '#DBA6B9',
    borderWidth: 2,
  },
  monthTitle: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: C.ink,
    backgroundColor: C.pink,
    borderRadius: 8,
    paddingVertical: 7,
    marginBottom: 10,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekday: {
    fontSize: 9,
    color: C.muted,
    fontWeight: '700',
  },
  dayCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    backgroundColor: C.pink,
  },
  dayNumber: {
    fontSize: 9,
    color: C.ink,
  },
});
