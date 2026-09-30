import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.{test,spec}.ts'],
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, '.'),
      '@react-native-async-storage/async-storage': path.resolve(
        __dirname,
        'tests/mocks/async-storage.ts',
      ),
      'react-native': path.resolve(__dirname, 'tests/mocks/react-native.ts'),
      one: path.resolve(__dirname, 'tests/mocks/one.ts'),
      'expo-web-browser': path.resolve(__dirname, 'tests/mocks/expo-web-browser.ts'),
    },
  },
})
