import {StatusBar, StyleSheet, useColorScheme, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

import {SettingsProvider} from './src/settings/SettingsProvider';
import {ScannerScreen} from './src/presentation/screens/ScannerScreen';

/**
 * Host shell. Providers remount cleanly on full reload; do not early-return
 * around hooks in child screens.
 */
function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <View style={styles.content}>
            <ScannerScreen />
          </View>
        </SafeAreaView>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
  },
});

export default App;
