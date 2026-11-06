
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
      </Stack>
    </>
  );
}
