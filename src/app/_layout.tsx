
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: '#FAF7F0',
          },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="habits" />
        <Stack.Screen name="monthly" />
        <Stack.Screen name="weekly" />
        <Stack.Screen name="micro-goals" />
        <Stack.Screen name="annual" />
        <Stack.Screen name="events" />
        <Stack.Screen name="wellness" />
        <Stack.Screen name="routine" />
        <Stack.Screen name="backup" />
        <Stack.Screen name="insights" />
        <Stack.Screen name="restore" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="reminders" />
      </Stack>
    </>
  );
}
