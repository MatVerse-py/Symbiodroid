import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

function TabIcon({ name, color, focused, label }: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
  label: string;
}) {
  return (
    <View style={[styles.tabItem, focused && styles.tabItemActive]}>
      <Ionicons name={name} size={22} color={color} />
      {focused ? <Text style={[styles.tabLabel, { color }]}>{label}</Text> : null}
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: Platform.select({ ios: insets.bottom + 64, android: insets.bottom + 64, default: 72 }),
          paddingTop: 8,
          paddingBottom: Platform.select({ ios: insets.bottom + 8, android: insets.bottom + 8, default: 8 }),
          backgroundColor: Colors.surface0,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="grid" color={color} focused={focused} label="Dashboard" />
          ),
        }}
      />
      <Tabs.Screen
        name="agent"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="radio" color={color} focused={focused} label="Agente" />
          ),
        }}
      />
      <Tabs.Screen
        name="skills"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="apps" color={color} focused={focused} label="Skills" />
          ),
        }}
      />
      <Tabs.Screen
        name="vault"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="lock-closed" color={color} focused={focused} label="Vault" />
          ),
        }}
      />
      <Tabs.Screen
        name="forense"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="search" color={color} focused={focused} label="Forense" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="settings" color={color} focused={focused} label="Config" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 44,
    minHeight: 44,
  },
  tabItemActive: {
    backgroundColor: 'rgba(0,255,148,0.08)',
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
