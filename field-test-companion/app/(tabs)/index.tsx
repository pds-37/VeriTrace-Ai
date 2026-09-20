import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getRecordStatsAsync } from '@/services/database';

export default function HomeScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<{ totalCount: number; pendingCount: number }>({
    totalCount: 0,
    pendingCount: 0,
  });

  const loadStats = useCallback(async () => {
    try {
      const data = await getRecordStatsAsync();
      setStats(data);
    } catch (error) {
      console.warn('Could not refresh stats on Home:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/images/doomsday-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.appName}>Field Test Companion</Text>
            <Text style={styles.subtitle}>Field testing & records</Text>
          </View>
        </View>

        {/* Welcome */}
        <View style={styles.welcome}>
          <Text style={styles.eyebrow}>FIELD OPERATIONS</Text>
          <Text style={styles.heading}>Ready to begin?</Text>
          <Text style={styles.description}>
            Capture a field test and create a secure digital record.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/capture')}
            accessibilityRole="button"
            accessibilityLabel="Start New Test"
          >
            <Text style={styles.buttonText}>＋  Start New Test</Text>
          </Pressable>
        </View>

        {/* Summary cards */}
        <Text style={styles.sectionTitle}>Your records</Text>

        <View style={styles.statsRow}>
          <Pressable
            style={styles.statCard}
            onPress={() => router.push('/records')}
            accessibilityRole="button"
            accessibilityLabel="View saved records"
          >
            <Text style={styles.statLabel}>Saved records</Text>
            <Text style={styles.statNumber}>{stats.totalCount}</Text>
            <Text style={styles.statHint}>Stored on device</Text>
          </Pressable>

          <Pressable
            style={styles.statCard}
            onPress={() => router.push('/records')}
            accessibilityRole="button"
            accessibilityLabel="View pending sync records"
          >
            <Text style={styles.statLabel}>Pending sync</Text>
            <Text style={styles.statNumber}>{stats.pendingCount}</Text>
            <Text style={styles.statHint}>Waiting for connection</Text>
          </Pressable>
        </View>

        {/* Device status */}
        <Text style={styles.sectionTitle}>Device status</Text>

        <View style={styles.listItem}>
          <View style={styles.itemIcon}>
            <Text style={styles.iconText}>✓</Text>
          </View>
          <View style={styles.itemContent}>
            <Text style={styles.itemTitle}>Offline storage</Text>
            <Text style={styles.itemDescription}>
              Offline-ready SQLite record keeping
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Local</Text>
          </View>
        </View>

        {/* Notice */}
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Important</Text>
          <Text style={styles.noticeText}>
            Field test results are presumptive only and do not replace
            laboratory confirmation.
          </Text>
        </View>

        <Text style={styles.footer}>
          Field Test Companion · Secure field records
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  container: {
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#0F2942',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  appName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#142536',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },
  welcome: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 20,
    marginBottom: 28,
  },
  eyebrow: {
    color: '#557086',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  heading: {
    color: '#142536',
    fontSize: 25,
    fontWeight: '700',
  },
  description: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#1D5D8F',
    paddingVertical: 15,
    borderRadius: 9,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  sectionTitle: {
    color: '#142536',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 15,
  },
  statLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  statNumber: {
    color: '#142536',
    fontSize: 27,
    fontWeight: '700',
    marginTop: 8,
  },
  statHint: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 5,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 9,
    backgroundColor: '#EDF3F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: '#1D5D8F',
    fontSize: 21,
    fontWeight: '700',
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    color: '#142536',
    fontSize: 14,
    fontWeight: '600',
  },
  itemDescription: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: '#E8F2EB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statusText: {
    color: '#286344',
    fontSize: 11,
    fontWeight: '600',
  },
  notice: {
    backgroundColor: '#FFF9E9',
    borderColor: '#F1D99A',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginTop: 18,
  },
  noticeTitle: {
    color: '#785817',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 5,
  },
  noticeText: {
    color: '#785817',
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 24,
  },
});