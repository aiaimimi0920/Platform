// Some embedded service dependencies call process.exit(0) from beforeExit.
// Restore only an incorrectly cleared failure after their async cleanup runs.
export function installCliExitCodeGuard() {
  let intendedExitCode = 1;
  process.once("exit", () => {
    if (intendedExitCode !== 0 && (process.exitCode === undefined || Number(process.exitCode) === 0)) {
      process.exitCode = intendedExitCode;
    }
  });
  return (code) => {
    if (!Number.isInteger(code) || code < 0 || code > 255) throw new Error("Invalid CLI exit code");
    intendedExitCode = code;
    process.exitCode = code;
  };
}
