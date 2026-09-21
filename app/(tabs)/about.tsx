import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AboutScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.heading}>About VeriTrace AI</Text>
          <Text style={styles.description}>
            VeriTrace AI is a next-generation field testing platform developed for the Smart India Hackathon. 
            It seamlessly integrates mobile edge-computing, cryptographic Chain of Custody hashing, and Computer Vision (YOLOv8) 
            to mathematically verify chemical diagnostic tests and rapid diagnostic cassettes directly in the field.
          </Text>
          
          <Text style={styles.subheading}>Key Features</Text>
          <Text style={styles.bullet}>• Offline-first SQLite database for remote environments</Text>
          <Text style={styles.bullet}>• SHA-256 Hash-linked evidence verification</Text>
          <Text style={styles.bullet}>• FastAPI cloud-sync dashboard</Text>
          <Text style={styles.bullet}>• Edge Computer Vision integration for cassette telemetry</Text>
          
          <Text style={styles.footer}>Developed for SIH 2026</Text>
        </View>
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
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 600,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 20,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#142536',
    marginBottom: 16,
  },
  subheading: {
    fontSize: 18,
    fontWeight: '600',
    color: '#142536',
    marginTop: 24,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
  },
  bullet: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 24,
    marginBottom: 8,
  },
  footer: {
    marginTop: 40,
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '600',
  }
});
