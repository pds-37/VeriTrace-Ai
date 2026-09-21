import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

export default function TopNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<'User' | 'Admin'>('User');

  const tabs = [
    { label: 'Overview (SIH)', route: '/about' },
    { label: 'Field App', route: '/' },
    { label: 'Records', route: '/two' },
    { label: 'Dataset', route: '/dataset' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.pillContainer}>
        {/* Left: Logo and Title */}
        <View style={styles.leftSection}>
          <Image 
            source={require('../assets/images/doomday-logo.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
          <Text style={styles.title}>VeriTrace AI</Text>
        </View>

        {/* Middle: Navigation Tabs */}
        {Platform.OS === 'web' && (
          <View style={styles.centerSection}>
            {tabs.map((tab, idx) => {
              const isActive = pathname === tab.route || (pathname === '/' && tab.route === '/');
              return (
                <Pressable 
                  key={idx}
                  onPress={() => tab.route !== '#' ? router.push(tab.route as any) : null}
                  style={[styles.tabButton, isActive && styles.activeTabButton]}
                >
                  <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Right: User / Admin Toggle */}
        <View style={styles.rightSection}>
          <View style={styles.toggleContainer}>
            <Pressable 
              style={[styles.toggleButton, role === 'User' && styles.toggleActive]}
              onPress={() => setRole('User')}
            >
              <Text style={[styles.toggleText, role === 'User' && styles.toggleActiveText]}>User</Text>
            </Pressable>
            <Pressable 
              style={[styles.toggleButton, role === 'Admin' && styles.toggleActive]}
              onPress={() => setRole('Admin')}
            >
              <Text style={[styles.toggleText, role === 'Admin' && styles.toggleActiveText]}>Admin</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 15,
    backgroundColor: '#F8FAFC', // light background behind the pill
    zIndex: 100,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    paddingHorizontal: 15,
    paddingVertical: 8,
    width: '95%',
    maxWidth: 1200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 45,
    height: 45,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
  centerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 20,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
  },
  activeTabButton: {
    backgroundColor: '#FF7F50', // Coral orange from your screenshot
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF5F0', // Very light orange background
    borderRadius: 30,
    padding: 4,
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 25,
  },
  toggleActive: {
    backgroundColor: '#FF7F50',
    shadowColor: '#FF7F50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  toggleActiveText: {
    color: '#FFFFFF',
  }
});
