import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Platform, useWindowDimensions, Modal } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

export default function TopNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { width: windowWidth } = useWindowDimensions();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Breakpoints
  const isMobile = windowWidth <= 768;
  const isSmallMobile = windowWidth <= 360;

  const tabs = [
    { label: 'Overview (SIH)', route: '/about' },
    { label: 'Field App', route: '/' },
    { label: 'Records', route: '/two' },
    { label: 'Dataset', route: '/dataset' },
  ];

  return (
    <View style={[styles.container, isMobile && styles.containerMobile, isSmallMobile && styles.containerSmallMobile]}>
      <View style={[styles.pillContainer, isMobile && styles.pillContainerMobile, isSmallMobile && styles.pillContainerSmallMobile]}>
        {isMobile ? (
          /* =======================================================
             MOBILE COMPACT HEADER (<= 768px)
             Layout: [☰] [Logo + VeriTrace AI]   [Offline Status]
             ======================================================= */
          <>
            <View style={styles.mobileLeftGroup}>
              {/* Hamburger Menu Button */}
              <Pressable
                style={styles.hamburgerButton}
                onPress={() => setIsMenuOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Open Navigation Menu"
              >
                <Text style={styles.hamburgerIcon}>☰</Text>
              </Pressable>

              {/* Logo and Brand */}
              <Pressable 
                style={styles.mobileBrand}
                onPress={() => router.push('/about')}
              >
                <Image 
                  source={require('../assets/images/doomday-logo.png')} 
                  style={styles.mobileLogo} 
                  resizeMode="contain"
                />
                <View>
                  <Text style={styles.mobileTitle}>VeriTrace AI</Text>
                  {!isSmallMobile && (
                    <Text style={styles.mobileTitleSub}>SIH 2026 EDITION</Text>
                  )}
                </View>
              </Pressable>
            </View>

            {/* Compact Offline-First Status */}
            <View style={styles.compactStatusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.compactStatusText}>
                {isSmallMobile ? 'Offline' : 'Offline Ready'}
              </Text>
            </View>
          </>
        ) : (
          /* =======================================================
             DESKTOP HEADER (> 768px) - PRESERVED EXACTLY
             ======================================================= */
          <>
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

            {/* Right: Status Pill & Field Launch CTA */}
            <View style={styles.rightSection}>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Offline-First Ready</Text>
              </View>

              <Pressable 
                style={styles.launchButton}
                onPress={() => router.push('/capture')}
                accessibilityRole="button"
                accessibilityLabel="Launch Live Field Test"
              >
                <Text style={styles.launchButtonText}>
                  {Platform.OS === 'web' ? 'Launch Field Test →' : 'Field Test →'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      {/* =======================================================
          MOBILE NAVIGATION DRAWER / MODAL PANEL
          Contains: Overview, Field App, Records, Dataset, Launch CTA
          ======================================================= */}
      {isMobile && (
        <Modal
          visible={isMenuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsMenuOpen(false)}
        >
          <Pressable 
            style={styles.menuBackdrop} 
            onPress={() => setIsMenuOpen(false)}
          >
            <Pressable style={styles.menuPanel} onPress={(e) => e.stopPropagation()}>
              <View style={styles.menuHeader}>
                <View style={styles.menuBrandRow}>
                  <Image 
                    source={require('../assets/images/doomday-logo.png')} 
                    style={styles.mobileLogo} 
                    resizeMode="contain"
                  />
                  <View>
                    <Text style={styles.mobileTitle}>VeriTrace AI</Text>
                    <Text style={styles.titleSub}>SIH 2026 EDITION</Text>
                  </View>
                </View>

                <Pressable 
                  style={styles.menuCloseButton} 
                  onPress={() => setIsMenuOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close navigation menu"
                >
                  <Text style={styles.menuCloseIcon}>✕</Text>
                </Pressable>
              </View>

              <View style={styles.menuDivider} />

              <View style={styles.menuItemsList}>
                {tabs.map((tab, idx) => {
                  const isActive = pathname === tab.route || (pathname === '/' && tab.route === '/');
                  return (
                    <Pressable
                      key={idx}
                      style={[styles.menuItem, isActive && styles.menuItemActive]}
                      onPress={() => {
                        setIsMenuOpen(false);
                        router.push(tab.route as any);
                      }}
                    >
                      <Text style={[styles.menuItemText, isActive && styles.menuItemTextActive]}>
                        {tab.label}
                      </Text>
                      {isActive && <Text style={styles.menuItemActiveDot}>●</Text>}
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.menuDivider} />

              {/* Prominent Launch Field Test CTA in Mobile Menu */}
              <Pressable
                style={styles.menuLaunchCta}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/capture');
                }}
                accessibilityRole="button"
                accessibilityLabel="Launch Field Test"
              >
                <Text style={styles.menuLaunchCtaText}>⚡ Launch Field Test →</Text>
              </Pressable>

              <View style={styles.menuFooterRow}>
                <View style={styles.statusDot} />
                <Text style={styles.menuFooterStatus}>Offline-First Evidentiary Mode Active</Text>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: Platform.OS === 'web' ? 36 : 16,
    backgroundColor: '#F8FAFC',
    zIndex: 100,
  },
  containerMobile: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  containerSmallMobile: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 8,
    width: '100%',
    maxWidth: 1200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  pillContainerMobile: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillContainerSmallMobile: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  /* Mobile Left Group: Hamburger + Brand */
  mobileLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  hamburgerButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hamburgerIcon: {
    fontSize: 20,
    color: '#1E293B',
    fontWeight: '700',
    lineHeight: 22,
  },
  mobileBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileLogo: {
    width: 32,
    height: 32,
  },
  mobileTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.3,
  },
  mobileTitleSub: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FF7F50',
    letterSpacing: 0.4,
  },

  /* Compact Mobile Status Pill */
  compactStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
  },
  compactStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },

  /* Desktop Header Elements */
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
    backgroundColor: '#FF7F50',
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

  /* Mobile Navigation Modal & Drawer */
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-start',
    paddingTop: 16,
    paddingHorizontal: 14,
  },
  menuPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  menuBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCloseIcon: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '700',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  menuItemsList: {
    gap: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
  },
  menuItemActive: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFD8A8',
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  menuItemTextActive: {
    color: '#C2410C',
    fontWeight: '700',
  },
  menuItemActiveDot: {
    fontSize: 10,
    color: '#EA580C',
  },
  menuLaunchCta: {
    backgroundColor: '#FF7F50',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#FF7F50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  menuLaunchCtaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  menuFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 8,
  },
  menuFooterStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
});
