import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  testEnvironment: 'node',
  verbose: true,
  modulePaths: ["<rootDir>/src"],
  moduleNameMapper: {
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@ui/(.*)$": "<rootDir>/src/app/modules/ui/$1",
  },
  transform: {
    "^.+\\.[tj]sx?$": "babel-jest",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(ts-utils)/)",
  ],
  setupFiles: [
    "<rootDir>/tests/jest.setup.ts",
  ],
  moduleFileExtensions: [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "node"
  ],
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(ts|js)$",
}

export default config;
