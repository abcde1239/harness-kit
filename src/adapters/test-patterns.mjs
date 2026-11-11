// Static classification only. Native runners still decide what to execute.
export const defaultTestPatterns = Object.freeze([
  '**/*.test.*', '**/*.spec.*', '**/*_test.go',
  '**/test_*.py', '**/*_test.py', '**/test_*.rb', '**/*_spec.rb',
  '**/*Test.java', '**/*Tests.java', '**/*Test.kt', '**/*Tests.kt',
  '**/*Test.cs', '**/*Tests.cs', '**/*Test.fs', '**/*Tests.fs',
  '**/*Test.php', '**/*Tests.php', '**/tests/**/*.rs',
  '**/*_test.dart', '**/*_test.exs', '**/*Tests.swift',
  '**/test_*.c', '**/test_*.cpp', '**/*_test.c', '**/*_test.cpp',
]);
