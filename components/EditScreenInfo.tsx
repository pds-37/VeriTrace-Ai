import { StyleSheet } from 'react-native';
import { Text, View } from './Themed';

export default function EditScreenInfo({ path }: { path: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>VeriTrace AI — Digital Field Companion</Text>
      <Text style={styles.subtitle}>Team DOOMDAY | Problem Statement SIH26231</Text>
      <Text style={styles.disclaimer}>Presumptive field-test result only; confirmatory laboratory testing (GC-MS / HPLC) remains essential.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  disclaimer: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },
});
