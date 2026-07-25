import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { FaceVerificationProvider } from '../src/contexts/FaceVerificationContext.jsx';

export default function RootLayout() {
  return (
    <FaceVerificationProvider>
      <StatusBar style="light" backgroundColor="#FF6B35" />
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: Platform.OS === 'ios',
          animation: Platform.OS === 'ios' ? 'slide_from_right' : 'fade',
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Singapore Science Centre',
          }}
        />
        <Stack.Screen
          name="ai-text"
          options={{
            title: 'AI Text Experience',
            headerShown: true,
            headerStyle: {
              backgroundColor: '#FF6B35',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
        <Stack.Screen
          name="ai-vision"
          options={{
            title: 'AI Vision Experience',
            headerShown: true,
            headerStyle: {
              backgroundColor: '#FF6B35',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
        <Stack.Screen
          name="ai-exhibit"
          options={{
            title: 'AI Exhibit',
            headerShown: true,
            headerStyle: {
              backgroundColor: '#FF6B35',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
      </Stack>
    </FaceVerificationProvider>
  );
}