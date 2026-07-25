import { Platform } from 'react-native';

const getDevServerUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:5000';
  }

  // For mobile development, use your computer's IP address
  // You can find your IP with 'ipconfig' on Windows or 'ifconfig' on Mac/Linux
  const LOCAL_IP = '192.168.1.100'; // Replace with your actual IP address
  return `http://${LOCAL_IP}:5000`;
};

export const Config = {
  API_URL: __DEV__ ? getDevServerUrl() : 'https://your-production-url.com',
  BACKEND_URL: __DEV__ ? getDevServerUrl() + '/api' : 'https://your-production-url.com/api',
  WS_URL: __DEV__ ? getDevServerUrl().replace('http', 'ws') : 'wss://your-production-url.com',

  // Development flags
  IS_DEV: __DEV__,
  IS_MOBILE: Platform.OS !== 'web',
  PLATFORM: Platform.OS,

  // Localhost access configuration
  LOCALHOST_CONFIG: {
    enabled: __DEV__,
    webPort: 3000,
    apiPort: 3001,
    wsPort: 3002,
  }
};

export default Config;