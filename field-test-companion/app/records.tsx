import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { getFieldTestRecordsAsync, type FieldTestRecord } from '@/services/database';

export default function RecordsScreen({ isTab = false }: { isTab?: boolean } = {}) {
  const router = useRouter();
  const [records, setRecords] = useState<FieldTestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FieldTestRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadRecords = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const data = await getFieldTestRecordsAsync();
      setRecords(data);
    } catch (error: any) {
      console.error('Failed to load records:', error);
      const detail = error?.message || 'Could not load records from local SQLite database.';
      setErrorMessage(detail);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Reload records whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [loadRecords])
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      {/* Top Header */}
      <View style={styles.header}>
        {!isTab && (
          <Pressable
            style={styles.backButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backButtonText}>‹ Back</Text>
          </Pressable>
        )}

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Test Records</Text>
          <Text style={styles.headerSubtitle}>
            {records.length} {records.length === 1 ? 'record' : 'records'} stored on device
          </Text>
        </View>

        <Pressable
          style={styles.newTestButton}
          onPress={() => router.push('/capture')}
          accessibilityRole="button"
          accessibilityLabel="Start New Test"
        >
          <Text style={styles.newTestButtonText}>＋ New</Text>
        </Pressable>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1D5D8F" />
          <Text style={styles.loadingText}>Loading records from SQLite...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>Error Loading Records</Text>
          <Text style={styles.errorDescription}>{errorMessage}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => loadRecords()}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : records.length === 0 ? (
        /* Empty State */
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIconText}>▤</Text>
            </View>
            <Text style={styles.emptyTitle}>No Test Records Saved</Text>
            <Text style={styles.emptyDescription}>
              You haven’t captured and saved any field test records on this device yet.
            </Text>

            <Pressable
              style={styles.emptyActionButton}
              onPress={() => router.push('/capture')}
              accessibilityRole="button"
              accessibilityLabel="Start New Test"
            >
              <Text style={styles.emptyActionButtonText}>＋  Start New Test</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* Records List */
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadRecords(true)}
              tintColor="#1D5D8F"
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.recordCard,
                pressed && styles.recordCardPressed,
              ]}
              onPress={() => setSelectedRecord(item)}
              accessibilityRole="button"
              accessibilityLabel={`View test record ${item.sampleName || item.referenceId}`}
            >
              {/* Thumbnail */}
              <View style={styles.thumbnailContainer}>
                {item.imageUri ? (
                  <Image source={{ uri: item.imageUri }} style={styles.thumbnail} />
                ) : (
                  <View style={styles.thumbnailPlaceholder}>
                    <Text style={styles.thumbnailPlaceholderText}>📷</Text>
                  </View>
                )}
              </View>

              {/* Record Summary */}
              <View style={styles.recordContent}>
                <Text style={styles.referenceIdText} numberOfLines={1}>
                  {item.sampleName || item.referenceId}
                </Text>
                <Text style={styles.recordIdText} numberOfLines={1}>
                  ID: {item.id}
                </Text>
                <Text style={styles.timestampText}>{formatDate(item.createdAt)}</Text>

                <View style={styles.badgesRow}>
                  {item.operatorId && item.operatorId.trim() && item.operatorId !== 'Unassigned' ? (
                    <View style={styles.operatorBadge}>
                      <Text style={styles.operatorBadgeText}>Op: {item.operatorId}</Text>
                    </View>
                  ) : null}
                  <View style={styles.gpsListBadge}>
                    <Text style={styles.gpsListBadgeText}>
                      {item.locationStatus === 'available' && item.latitude !== null
                        ? '📍 GPS'
                        : '📍 No GPS'}
                    </Text>
                  </View>
                  <View style={styles.presumptiveBadge}>
                    <Text style={styles.presumptiveBadgeText}>
                      {item.presumptiveStatus || 'Presumptive (Unanalyzed)'}
                    </Text>
                  </View>
                  <View style={styles.syncBadge}>
                    <Text style={styles.syncBadgeText}>Pending Sync</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
        />
      )}

      {/* Record Details Modal */}
      <Modal
        visible={selectedRecord !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedRecord(null)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalSubheading}>RECORD DETAILS</Text>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedRecord?.sampleName || selectedRecord?.referenceId}
                </Text>
              </View>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setSelectedRecord(null)}
                accessibilityRole="button"
                accessibilityLabel="Close record details"
              >
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </Pressable>
            </View>

            {/* Modal Content */}
            <FlatList
              data={selectedRecord ? [selectedRecord] : []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.modalScrollContent}
              renderItem={({ item }) => (
                <View>
                  {/* Image Preview */}
                  <View style={styles.modalImageWrapper}>
                    {item.imageUri ? (
                      <Image
                        source={{ uri: item.imageUri }}
                        style={styles.modalImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.modalImagePlaceholder}>
                        <Text style={styles.placeholderText}>No image available</Text>
                      </View>
                    )}
                  </View>

                  {/* Metadata Table */}
                  <View style={styles.detailsCard}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Sample Name / Ref ID</Text>
                      <Text style={styles.detailValue}>{item.sampleName || item.referenceId}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Record ID</Text>
                      <Text style={[styles.detailValue, styles.monoText]}>
                        {item.id}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Operator ID</Text>
                      <Text style={styles.detailValue}>
                        {item.operatorId && item.operatorId.trim() ? item.operatorId : 'Unassigned'}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Timestamp</Text>
                      <Text style={styles.detailValue}>
                        {formatDate(item.createdAt)}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>GPS Availability</Text>
                      <View style={styles.inlineBadgeContainer}>
                        {item.locationStatus === 'available' && item.latitude !== null && item.longitude !== null ? (
                          <View style={styles.gpsAvailableBadge}>
                            <Text style={styles.gpsAvailableBadgeText}>Available</Text>
                          </View>
                        ) : item.locationStatus === 'permission_denied' ? (
                          <View style={styles.gpsDeniedBadge}>
                            <Text style={styles.gpsDeniedBadgeText}>Permission Denied</Text>
                          </View>
                        ) : (
                          <View style={styles.gpsUnavailableBadge}>
                            <Text style={styles.gpsUnavailableBadgeText}>Unavailable</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {item.locationStatus === 'available' && item.latitude !== null && item.longitude !== null ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>GPS Coordinates</Text>
                        <Text style={[styles.detailValue, styles.monoText]}>
                          {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Image SHA-256</Text>
                      <Text style={[styles.detailValue, styles.hashMonoText]} numberOfLines={2} ellipsizeMode="middle">
                        {item.imageHash && item.imageHash.trim() ? item.imageHash : 'Unavailable'}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Presumptive Status</Text>
                      <View style={styles.inlineBadge}>
                        <Text style={styles.inlineBadgeText}>{item.presumptiveStatus || 'Presumptive (Unanalyzed)'}</Text>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Analysis Status</Text>
                      <View style={styles.inlineBadge}>
                        <Text style={styles.inlineBadgeText}>not_implemented</Text>
                      </View>
                    </View>

                    <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                      <Text style={styles.detailLabel}>Sync Status</Text>
                      <View style={styles.inlineSyncBadge}>
                        <Text style={styles.inlineSyncBadgeText}>pending (Local Only)</Text>
                      </View>
                    </View>
                  </View>

                  {/* Presumptive Notice */}
                  <View style={styles.noticeBox}>
                    <Text style={styles.noticeTitle}>Presumptive Notice</Text>
                    <Text style={styles.noticeText}>
                      Field test results are presumptive only and do not replace laboratory confirmation. Automated analysis is not implemented yet.
                    </Text>
                  </View>

                  {/* Close Action */}
                  <Pressable
                    style={styles.modalPrimaryButton}
                    onPress={() => setSelectedRecord(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <Text style={styles.modalPrimaryButtonText}>Close</Text>
                  </Pressable>
                </View>
              )}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  backButtonText: {
    color: '#1D5D8F',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#142536',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  newTestButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1D5D8F',
  },
  newTestButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 6,
  },
  errorDescription: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1D5D8F',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EDF3F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyIconText: {
    fontSize: 24,
    color: '#1D5D8F',
    fontWeight: '700',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#142536',
    marginBottom: 6,
  },
  emptyDescription: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyActionButton: {
    backgroundColor: '#1D5D8F',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 8,
  },
  emptyActionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 36,
  },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  recordCardPressed: {
    backgroundColor: '#F8FAFC',
  },
  thumbnailContainer: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailPlaceholderText: {
    fontSize: 22,
  },
  recordContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  referenceIdText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#142536',
    marginBottom: 2,
  },
  recordIdText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'SpaceMono',
    marginBottom: 2,
  },
  timestampText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presumptiveBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  presumptiveBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  syncBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  syncBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },
  chevron: {
    fontSize: 22,
    color: '#94A3B8',
    fontWeight: '600',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalSubheading: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D5D8F',
    letterSpacing: 0.8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#142536',
    marginTop: 2,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  modalImageWrapper: {
    height: 260,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#142536',
  },
  monoText: {
    fontSize: 11,
    color: '#475569',
    fontFamily: 'SpaceMono',
  },
  inlineBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  inlineBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  inlineSyncBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  inlineSyncBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  noticeBox: {
    backgroundColor: '#FFF9E9',
    borderColor: '#F1D99A',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#785817',
    marginBottom: 4,
  },
  noticeText: {
    color: '#785817',
    fontSize: 12,
    lineHeight: 17,
  },
  modalPrimaryButton: {
    backgroundColor: '#1D5D8F',
    paddingVertical: 14,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  operatorBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  operatorBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0369A1',
  },
  gpsListBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gpsListBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  inlineBadgeContainer: {
    flexDirection: 'row',
  },
  gpsAvailableBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  gpsAvailableBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
  },
  gpsDeniedBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  gpsDeniedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#991B1B',
  },
  gpsUnavailableBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  gpsUnavailableBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  hashMonoText: {
    fontSize: 10,
    color: '#1E293B',
    fontFamily: 'SpaceMono',
    maxWidth: '55%',
    textAlign: 'right',
  },
});
