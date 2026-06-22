export default {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "js"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { useESM: true }],
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
  modulePaths: ["./src"],
  moduleNameMapper: {
    "^(\\.\\.?\\/.+)\\.js$": "$1"
  },
  extensionsToTreatAsEsm: [".ts"]
};