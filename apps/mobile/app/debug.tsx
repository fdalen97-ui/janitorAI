/**
 * Debug Screen
 * 
 * Shows runtime configuration and API health status.
 * Only accessible in development builds (__DEV__ === true).
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { getApiBaseUrl, getApiHealthUrl, getBuildProfile, isDevelopment } from '../src/config/api';

interface HealthCheckResponse {
  status: string;
  [key: string]: unknown;
}

export default function DebugScreen() {
  const router = useRouter();
  const [healthStatus, setHealthStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setHealthStatus('loading');
    setErrorMessage('');
    try {
      const response = await fetch(getApiHealthUrl(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHealthData(data);
        setHealthStatus('ok');
      } else {
        setHealthStatus('error');
        setErrorMessage(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      setHealthStatus('error');
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  // Prevent access in production builds
  if (!isDevelopment()) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Debug screen not available in production builds</Text>
          <Pressable style={styles.button} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Debug Information</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Build Configuration</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Build Profile:</Text>
            <Text style={styles.value}>{getBuildProfile() || 'Not configured'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Development Mode:</Text>
            <Text style={styles.value}>{isDevelopment() ? 'Yes' : 'No'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Configuration</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Base URL:</Text>
            <Text style={styles.value}>{getApiBaseUrl()}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Health URL:</Text>
            <Text style={styles.value}>{getApiHealthUrl()}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Health Check</Text>
          
          {healthStatus === 'loading' && (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="large" color="#2F4A5E" />
              <Text style={styles.statusText}>Checking health...</Text>
            </View>
          )}

          {healthStatus === 'ok' && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusSuccess}>API-et svarer</Text>
              {healthData && (
                <View style={styles.codeBlock}>
                  <Text style={styles.codeText}>{JSON.stringify(healthData, null, 2)}</Text>
                </View>
              )}
            </View>
          )}

          {healthStatus === 'error' && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusError}>✗ Health check failed</Text>
              {errorMessage && (
                <View style={styles.codeBlock}>
                  <Text style={styles.errorDetailText}>{errorMessage}</Text>
                </View>
              )}
            </View>
          )}

          <Pressable style={styles.button} onPress={checkHealth}>
            <Text style={styles.buttonText}>Refresh Health Check</Text>
          </Pressable>
        </View>

        <Pressable style={[styles.button, styles.backButton]} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5F8',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#2F4A5E',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 140,
  },
  value: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  statusContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  statusSuccess: {
    fontSize: 16,
    color: '#2E7D4F',
    fontWeight: '600',
    marginBottom: 10,
  },
  statusError: {
    fontSize: 16,
    color: '#A6453A',
    fontWeight: '600',
    marginBottom: 10,
  },
  codeBlock: {
    backgroundColor: '#E8F5F8',
    borderRadius: 5,
    padding: 10,
    marginTop: 10,
    width: '100%',
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
  },
  errorDetailText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#A6453A',
  },
  button: {
    backgroundColor: '#2F4A5E',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
  },
  backButton: {
    backgroundColor: '#596D71',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#A6453A',
    textAlign: 'center',
    marginBottom: 20,
  },
});
