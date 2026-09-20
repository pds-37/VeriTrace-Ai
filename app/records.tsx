import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  getFieldTestRecordsAsync,
  updateRecordSyncStatusAsync,
  type FieldTestRecord,
  type SyncStatusType,
} from '@/services/database';
import {
  getBackendBaseUrl,
  setBackendBaseUrl,
  testBackendConnectionAsync,
  syncPendingRecordsAsync,
  sendRecordToBackendAsync,
  getDefaultBackendUrl,
  loginAsync,
  getAuthTokenAsync,
} from '@/services/backendApi';

export default function RecordsScreen({ isTab = false }: { isTab?: boolean } = {}) {
  const router = useRouter();
  const [records, setRecords] = useState<FieldTestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const PAGE_SIZE = 20;

  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FieldTestRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Server Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{
    tested: boolean;
    ok: boolean;
    message: string;
  }>({ tested: false, ok: false, message: '' });

  // Auth State
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authStatus, setAuthStatus] = useState<string | null>(null);

  // Sync state stats (approximated for now based on loaded records, a real app would run a separate count query)
  const pendingCount = records.filter(
    (r) => r.syncStatus === 'pending' || r.syncStatus === 'local_only' || r.syncStatus === 'conflict'
  ).length;
  const syncedCount = records.filter((r) => r.syncStatus === 'synced').length;

  const loadRecords = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);
    setPage(0);
    setHasMore(true);

    try {
      const data = await getFieldTestRecordsAsync({ limit: PAGE_SIZE, offset: 0 });
      setRecords(data);
      if (data.length < PAGE_SIZE) setHasMore(false);
    } catch (error: any) {
      console.error('Failed to load records:', error);
      const detail = error?.message || 'Could not load records from local SQLite database.';
      setErrorMessage(detail);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const loadMoreRecords = useCallback(async () => {
    if (isLoadingMore || !hasMore || isLoading || isRefreshing) return;
    
    setIsLoadingMore(true);
    const nextPage = page + 1;
    
    try {
      const data = await getFieldTestRecordsAsync({ limit: PAGE_SIZE, offset: nextPage * PAGE_SIZE });
      if (data.length > 0) {
        setRecords(prev => [...prev, ...data]);
        setPage(nextPage);
      }
      if (data.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load more records:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, hasMore, isLoadingMore, isLoading, isRefreshing]);

  // Reload records whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [loadRecords])
  );

  // Initialize server URL on mount
  useEffect(() => {
    getBackendBaseUrl().then((url) => setServerUrlInput(url));
  }, []);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSyncAll = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const report = await syncPendingRecordsAsync();
      await loadRecords();
      Alert.alert(
        report.success ? 'Sync Complete' : 'Sync Notice',
        report.message
      );
    } catch (error: any) {
      Alert.alert('Sync Error', error?.message || 'Could not complete synchronization.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncSingleRecord = async (record: FieldTestRecord) => {
    setIsSyncing(true);
    try {
      const res = await sendRecordToBackendAsync(record);
      if (res.status === 'synced') {
        await updateRecordSyncStatusAsync(record.id, 'synced', res.recordHash, res.previousRecordHash);
        Alert.alert('Record Synced', `Record "${record.sampleName || record.referenceId}" is cryptographically linked to Hash-Linked Chain of Custody.`);
      } else if (res.status === 'already_synced') {
        await updateRecordSyncStatusAsync(record.id, 'synced', res.recordHash);
        Alert.alert('Already Synced', 'Record is already recorded identically on server.');
      } else if (res.status === 'conflict') {
        await updateRecordSyncStatusAsync(record.id, 'conflict', res.recordHash);
        Alert.alert('Sync Conflict', 'Server reported a conflict for this record ID. Original server record preserved.');
      } else if (res.status === 'network_unavailable') {
        Alert.alert('Offline / Unreachable', 'Could not reach backend server. Record remains safely saved locally.');
      } else if (res.status === 'rejected') {
        await updateRecordSyncStatusAsync(record.id, 'rejected');
        Alert.alert('Validation Rejected', res.message);
      }
      const refreshed = await getFieldTestRecordsAsync();
      setRecords(refreshed);
      const updated = refreshed.find((r) => r.id === record.id);
      if (updated) {
        setSelectedRecord(updated);
      }
    } catch (err: any) {
      Alert.alert('Sync Failed', err?.message || 'Could not sync record.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionTestResult({ tested: false, ok: false, message: '' });
    try {
      const result = await testBackendConnectionAsync(serverUrlInput);
      setConnectionTestResult({
        tested: true,
        ok: result.ok,
        message: result.message,
      });
    } catch (err: any) {
      setConnectionTestResult({
        tested: true,
        ok: false,
        message: err?.message || 'Connection test failed.',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveServerSettings = async () => {
    const trimmed = (serverUrlInput || '').trim();
    if (!trimmed) {
      Alert.alert('Invalid URL', 'Please enter a valid backend URL.');
      return;
    }
    await setBackendBaseUrl(trimmed);
    setIsSettingsOpen(false);
    setConnectionTestResult({ tested: false, ok: false, message: '' });
    Alert.alert('Settings Saved', `Backend URL set to:\n${trimmed}`);
  };

  const handleLogin = async () => {
    if (!usernameInput || !passwordInput) {
      Alert.alert('Missing Fields', 'Please enter username and password.');
      return;
    }
    setIsLoggingIn(true);
    setAuthStatus(null);
    try {
      // Ensure backend URL is saved first before logging in
      const trimmed = (serverUrlInput || '').trim();
      if (trimmed) await setBackendBaseUrl(trimmed);
      
      const res = await loginAsync(usernameInput, passwordInput);
      if (res.ok) {
        setAuthStatus(`✅ Authenticated as ${usernameInput} (${res.role})`);
        Alert.alert('Login Successful', `Welcome, ${usernameInput}! You can now securely sync records.`);
      } else {
        setAuthStatus('❌ Login Failed: ' + res.error);
        Alert.alert('Login Failed', res.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setAuthStatus('❌ Network Error');
      Alert.alert('Error', err.message);
    } finally {
      setIsLoggingIn(false);
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

  const renderSyncBadge = (status: SyncStatusType) => {
    switch (status) {
      case 'synced':
        return (
          <View style={[styles.syncBadge, styles.syncBadgeSynced]}>
            <Text style={[styles.syncBadgeText, styles.syncBadgeTextSynced]}>🟢 Synced</Text>
          </View>
        );
      case 'conflict':
        return (
          <View style={[styles.syncBadge, styles.syncBadgeConflict]}>
            <Text style={[styles.syncBadgeText, styles.syncBadgeTextConflict]}>🔴 Conflict</Text>
          </View>
        );
      case 'local_only':
        return (
          <View style={[styles.syncBadge, styles.syncBadgeLocal]}>
            <Text style={[styles.syncBadgeText, styles.syncBadgeTextLocal]}>⚪ Local Only</Text>
          </View>
        );
      case 'rejected':
        return (
          <View style={[styles.syncBadge, styles.syncBadgeConflict]}>
            <Text style={[styles.syncBadgeText, styles.syncBadgeTextConflict]}>✕ Rejected</Text>
          </View>
        );
      case 'pending':
      default:
        return (
          <View style={[styles.syncBadge, styles.syncBadgePending]}>
            <Text style={[styles.syncBadgeText, styles.syncBadgeTextPending]}>🟡 Pending Sync</Text>
          </View>
        );
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
            {records.length} stored · {syncedCount} synced · {pendingCount} pending
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={styles.settingsHeaderButton}
            onPress={() => {
              getBackendBaseUrl().then((url) => setServerUrlInput(url));
              setConnectionTestResult({ tested: false, ok: false, message: '' });
              setIsSettingsOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Server Settings"
          >
            <Text style={styles.settingsHeaderButtonText}>⚙️</Text>
          </Pressable>

          <Pressable
            style={styles.newTestButton}
            onPress={() => router.push('/capture')}
            accessibilityRole="button"
            accessibilityLabel="Start New Test"
          >
            <Text style={styles.newTestButtonText}>＋ New</Text>
          </Pressable>
        </View>
      </View>

      {/* Sync Action & Status Banner */}
      {records.length > 0 && (
        <View style={styles.syncBanner}>
          <View style={styles.syncBannerTextContainer}>
            <Text style={styles.syncBannerTitle}>
              {pendingCount > 0 ? `🔄 ${pendingCount} Pending Sync` : '✓ All Records Synced'}
            </Text>
            <Text style={styles.syncBannerSubtitle}>
              {pendingCount > 0
                ? 'Records are saved locally. Sync with chain of custody when online.'
                : 'All local records cryptographically verified with server.'}
            </Text>
          </View>

          {pendingCount > 0 && (
            <Pressable
              style={[styles.syncNowButton, isSyncing && styles.syncNowButtonDisabled]}
              onPress={handleSyncAll}
              disabled={isSyncing}
              accessibilityRole="button"
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.syncNowButtonText}>Sync Now</Text>
              )}
            </Pressable>
          )}
        </View>
      )}

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
              You haven’t captured and saved any field test records on this device yet. Records are saved locally first and synced when connected.
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
              onRefresh={async () => {
                await syncPendingRecordsAsync();
                await loadRecords(true);
              }}
              tintColor="#1D5D8F"
            />
          }
          onEndReached={loadMoreRecords}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ padding: 16, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#1D5D8F" />
              </View>
            ) : null
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
                  {renderSyncBadge(item.syncStatus)}
                </View>
              </View>

              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
        />
      )}

      {/* Server Settings Modal */}
      <Modal
        visible={isSettingsOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsSettingsOpen(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalSubheading}>CONFIGURATION</Text>
                <Text style={styles.modalTitle}>Backend Server Settings</Text>
              </View>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setIsSettingsOpen(false)}
              >
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>Backend API Base URL</Text>
              <TextInput
                style={styles.settingsInput}
                value={serverUrlInput}
                onChangeText={setServerUrlInput}
                placeholder="http://192.168.1.100:8000"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.settingsQuickText}>Quick Presets:</Text>
              <View style={styles.presetButtonsRow}>
                <Pressable
                  style={styles.presetButton}
                  onPress={() => setServerUrlInput('http://10.0.2.2:8000')}
                >
                  <Text style={styles.presetButtonText}>Android Emulator (10.0.2.2)</Text>
                </Pressable>
                <Pressable
                  style={styles.presetButton}
                  onPress={() => setServerUrlInput('http://localhost:8000')}
                >
                  <Text style={styles.presetButtonText}>Localhost (8000)</Text>
                </Pressable>
              </View>

              <Pressable
                style={[styles.testConnectionButton, isTestingConnection && styles.syncNowButtonDisabled]}
                onPress={handleTestConnection}
                disabled={isTestingConnection}
              >
                {isTestingConnection ? (
                  <ActivityIndicator size="small" color="#1D5D8F" />
                ) : (
                  <Text style={styles.testConnectionButtonText}>🔌 Test Connection (GET /health)</Text>
                )}
              </Pressable>

              {connectionTestResult.tested && (
                <View
                  style={[
                    styles.testResultBox,
                    connectionTestResult.ok ? styles.testResultBoxOk : styles.testResultBoxFail,
                  ]}
                >
                  <Text
                    style={[
                      styles.testResultText,
                      connectionTestResult.ok ? styles.testResultTextOk : styles.testResultTextFail,
                    ]}
                  >
                    {connectionTestResult.ok ? '✓ Connected: ' : '✕ Failed: '}
                    {connectionTestResult.message}
                  </Text>
                </View>
              )}

              <View style={styles.settingsHelpBox}>
                <Text style={styles.settingsHelpTitle}>Connecting Physical Mobile Phones (LAN)</Text>
                <Text style={styles.settingsHelpBody}>
                  1. Find your PC IP address using `ipconfig` (e.g. 192.168.1.45).{'\n'}
                  2. Ensure your phone is connected to the same Wi-Fi network.{'\n'}
                  3. Enter `http://&lt;YOUR_PC_IP&gt;:8000` above and tap Save.
                </Text>
              </View>

              <View style={{ marginTop: 24, padding: 16, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={styles.settingsLabel}>Operator Login</Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                  You must authenticate to securely sync records to the Chain of Custody.
                </Text>
                
                <TextInput
                  style={[styles.settingsInput, { marginBottom: 8 }]}
                  value={usernameInput}
                  onChangeText={setUsernameInput}
                  placeholder="Username (e.g. officer_1)"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                
                <TextInput
                  style={[styles.settingsInput, { marginBottom: 16 }]}
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                  placeholder="Password"
                  secureTextEntry
                  autoCapitalize="none"
                />

                <Pressable
                  style={[styles.saveSettingsButton, isLoggingIn && styles.syncNowButtonDisabled]}
                  onPress={handleLogin}
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveSettingsButtonText}>Login & Obtain Token</Text>
                  )}
                </Pressable>

                {authStatus && (
                  <Text style={{ marginTop: 12, fontSize: 13, color: authStatus.includes('✅') ? '#059669' : '#DC2626', textAlign: 'center', fontWeight: '500' }}>
                    {authStatus}
                  </Text>
                )}
              </View>

              <Pressable
                style={[styles.saveSettingsButton, { marginTop: 16, backgroundColor: '#64748B' }]}
                onPress={handleSaveServerSettings}
              >
                <Text style={styles.saveSettingsButtonText}>Save Server Settings (No Login)</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

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
                <Text style={styles.modalSubheading}>RECORD DETAILS & CHAIN OF CUSTODY</Text>
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
                        <Text style={styles.inlineBadgeText}>{item.analysisStatus || 'not_implemented'}</Text>
                      </View>
                    </View>

                    {/* Extended Sync & Cryptographic Status */}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Sync Status</Text>
                      {renderSyncBadge(item.syncStatus)}
                    </View>

                    {item.serverRecordHash ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Record Hash</Text>
                        <Text style={[styles.detailValue, styles.hashMonoText]} numberOfLines={2} ellipsizeMode="middle">
                          {item.serverRecordHash}
                        </Text>
                      </View>
                    ) : null}

                    {item.serverPrevHash ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Previous Hash</Text>
                        <Text style={[styles.detailValue, styles.hashMonoText]} numberOfLines={2} ellipsizeMode="middle">
                          {item.serverPrevHash}
                        </Text>
                      </View>
                    ) : null}

                    {item.syncedAt ? (
                      <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                        <Text style={styles.detailLabel}>Synced Timestamp</Text>
                        <Text style={styles.detailValue}>{formatDate(item.syncedAt)}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Manual Sync Retry Button if Pending or Conflict */}
                  {item.syncStatus !== 'synced' && (
                    <Pressable
                      style={[styles.singleSyncButton, isSyncing && styles.syncNowButtonDisabled]}
                      onPress={() => handleSyncSingleRecord(item)}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.singleSyncButtonText}>🔄 Sync This Record with Backend</Text>
                      )}
                    </Pressable>
                  )}

                  {/* Presumptive Notice */}
                  <View style={styles.noticeBox}>
                    <Text style={styles.noticeTitle}>Presumptive Notice</Text>
                    <Text style={styles.noticeText}>
                      Field test results are presumptive only and do not replace laboratory confirmation. Automated analysis is non-diagnostic.
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
    flex: 1,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsHeaderButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  settingsHeaderButtonText: {
    fontSize: 14,
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
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  syncBannerTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  syncBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  syncBannerSubtitle: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
  },
  syncNowButton: {
    backgroundColor: '#1D5D8F',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 74,
  },
  syncNowButtonDisabled: {
    opacity: 0.6,
  },
  syncNowButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  syncBadgeSynced: {
    backgroundColor: '#DCFCE7',
  },
  syncBadgeTextSynced: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  syncBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  syncBadgeTextPending: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  syncBadgeConflict: {
    backgroundColor: '#FEE2E2',
  },
  syncBadgeTextConflict: {
    fontSize: 10,
    fontWeight: '700',
    color: '#991B1B',
  },
  syncBadgeLocal: {
    backgroundColor: '#F1F5F9',
  },
  syncBadgeTextLocal: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  syncBadgeText: {
    fontSize: 10,
    fontWeight: '600',
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
  singleSyncButton: {
    backgroundColor: '#1D5D8F',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  singleSyncButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
  settingsContent: {
    padding: 20,
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#142536',
    marginBottom: 8,
  },
  settingsInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'SpaceMono',
    marginBottom: 12,
  },
  settingsQuickText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 6,
  },
  presetButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetButtonText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  testConnectionButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#1D5D8F',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  testConnectionButtonText: {
    color: '#1D5D8F',
    fontSize: 13,
    fontWeight: '700',
  },
  testResultBox: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  testResultBoxOk: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  testResultBoxFail: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  testResultText: {
    fontSize: 12,
    fontWeight: '600',
  },
  testResultTextOk: {
    color: '#166534',
  },
  testResultTextFail: {
    color: '#991B1B',
  },
  settingsHelpBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 20,
  },
  settingsHelpTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  settingsHelpBody: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  saveSettingsButton: {
    backgroundColor: '#1D5D8F',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveSettingsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
