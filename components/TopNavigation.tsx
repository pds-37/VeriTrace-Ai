import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

export default function TopNavigation() {
  const router = useRouter();
  const pathname = usePathname();

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
        <Pressable 
          style={styles.leftSection}
          onPress={() => router.push('/about')}
        >
          <Image 
            source={require('../assets/images/doomday-logo.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
          <View>
            <Text style={styles.title}>VeriTrace AI</Text>
            <Text style={styles.titleSub}>SIH 2026 EDITION</Text>
          </View>
        </Pressable>

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

        {/* Right: Status Pill & SaaS Launch CTA */}
        <View style={styles.rightSection}>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>100% Offline</Text>
          </View>

          <Pressable 
            style={styles.launchButton}
            onPress={() => router.push('/capture')}
            accessibilityRole="button"
            accessibilityLabel="Launch Live Field Test"
          >
            <Text style={styles.launchButtonText}>
              {Platform.OS === 'web' ? 'Launch Live Test →' : 'Test →'}
            </Text>
          </Pressable>
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
    gap: 10,
  },
  titleSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF7F50',
    letterSpacing: 0.5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  launchButton: {
    backgroundColor: '#FF7F50',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#FF7F50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  launchButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
