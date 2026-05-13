// TODO: Apple Watch support requires a separate watchOS app written in Swift/SwiftUI.
// This cannot be implemented in React Native / Expo managed workflow alone.
//
// When ready to implement:
//   1. Use @bacons/apple-targets to add a watchOS target to the Expo project
//   2. Write the watch UI in Swift/SwiftUI (macro summary, water logging, weight logging)
//   3. Use react-native-watch-connectivity for the iOS-side bridge
//   4. Wire sendTodayDataToWatch in app/(tabs)/index.tsx after loadTodayData completes
export {};
