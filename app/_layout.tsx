import { AlertProvider } from '@/template';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AgentProvider } from '@/contexts/AgentContext';
import { VaultProvider } from '@/contexts/VaultContext';
import { ForenseProvider } from '@/contexts/ForenseContext';

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <AgentProvider>
          <VaultProvider>
            <ForenseProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080808' } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="case-detail" options={{ headerShown: false }} />
            </Stack>
            </ForenseProvider>
          </VaultProvider>
        </AgentProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
