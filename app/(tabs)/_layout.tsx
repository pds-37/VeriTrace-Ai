import { SymbolView } from 'expo-symbols';
import { Link, Tabs } from 'expo-router';
import { Platform, Pressable, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import TopNavigation from '@/components/TopNavigation';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <TopNavigation />
      <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1D5D8F',
        tabBarInactiveTintColor: '#64748B',
        headerTintColor: '#142536',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          display: Platform.OS === 'web' ? 'none' : 'flex',
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Field Test Companion',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'house.fill',
                android: 'home',
                web: 'home',
              }}
              tintColor={color}
              size={24}
            />
          ),
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable style={{ marginRight: 15 }}>
                {({ pressed }) => (
                  <SymbolView
                    name={{ ios: 'info.circle', android: 'info', web: 'info' }}
                    size={22}
                    tintColor="#1D5D8F"
                    style={{ opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Records',
          headerTitle: 'Test Records',
          tabBarLabel: 'Records',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'doc.text.fill',
                android: 'description',
                web: 'description',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="dataset"
        options={{
          title: 'Dataset',
          headerTitle: 'Dataset Collection',
          tabBarLabel: 'Dataset',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'camera.viewfinder',
                android: 'collections',
                web: 'collections',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: 'Overview',
          headerTitle: 'SIH Project Overview',
          tabBarLabel: 'Overview',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'sparkles',
                android: 'auto_awesome',
                web: 'auto_awesome',
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
    </View>
  );
}
