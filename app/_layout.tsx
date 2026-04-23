import { AlertProvider } from '@/template';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AgentProvider } from '@/contexts/AgentContext';
import { VaultProvider } from '@/contexts/VaultContext';

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <AgentProvider>
          <VaultProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080808' } }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </VaultProvider>
        </AgentProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
