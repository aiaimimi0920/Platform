// SSH carries loopback control/fixture HTTP only; Iroh UDP is never forwarded.
import assert from "node:assert/strict";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { hostname } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { ProjectionRuntime, object, textField } from "../../../Loom/scripts/qr-projection-smoke/runtime.ts";

export class RemoteProjectionRuntime extends ProjectionRuntime {
  private readonly token = randomBytes(32).toString("hex");
  private readonly config = process.env.LOOM_TEST_SSH_CONFIG!;
  private readonly target = process.env.LOOM_TEST_SSH_TARGET!;
  private readonly remoteExe = process.env.LOOM_TEST_REMOTE_DAEMON!;
  private readonly remoteRoot = this.remoteExe.slice(0, this.remoteExe.lastIndexOf("/")).replaceAll("/", "\\") + "\\smoke-" + randomUUID();
  private daemon: ChildProcess | undefined;
  private tunnel: ChildProcess | undefined;
  private remotePid: number | undefined;
  readonly evidence = { host: "", daemonSha256: "", controlViaSsh: true };

  constructor(executable: string, signal: AbortSignal) {
    super(executable, signal);
    assert.ok(this.config && /^[a-zA-Z0-9._-]+$/.test(this.target), "SSH config and alias required");
    assert.match(this.remoteExe, /^[A-Za-z]:\/[A-Za-z0-9_./-]+\/loom-daemon\.exe$/);
    assert.ok(!this.remoteExe.split("/").includes(".."), "remote traversal forbidden");
  }

  override get adminToken(): string { return this.token; }

  private args(script: string): string[] {
    const prelude = "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; ";
    return ["-F", this.config, this.target, "powershell.exe", "-NoProfile", "-NonInteractive",
      "-EncodedCommand", Buffer.from(prelude + script, "utf16le").toString("base64")];
  }

  private command(script: string): string {
    try {
      return execFileSync("ssh", this.args(script), { encoding: "utf8", windowsHide: true, timeout: 20_000,
        maxBuffer: 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }).trim();
    } catch { throw new Error("remote validation command failed (arguments redacted)"); }
  }

  async prepare(centralOrigin: string): Promise<void> {
    const remote = object(JSON.parse(this.command("@{host=$env:COMPUTERNAME; hash=(Get-FileHash -Algorithm SHA256 -LiteralPath '" + this.remoteExe + "').Hash} | ConvertTo-Json -Compress")));
    assert.notEqual(textField(remote.host, "remote hostname").toLowerCase(), hostname().toLowerCase(), "remote must be another host");
    const expected = createHash("sha256").update(readFileSync(this.executable)).digest("hex");
    assert.equal(String(remote.hash).toLowerCase(), expected, "remote candidate differs");
    Object.assign(this.evidence, { host: remote.host, daemonSha256: expected });
    const listener = createServer();
    await new Promise<void>((done) => listener.listen(0, "127.0.0.1", done));
    const address = listener.address();
    assert.ok(address && typeof address === "object");
    const port = address.port;
    await new Promise<void>((done) => listener.close(() => done()));
    this.origin = "http://127.0.0.1:" + port;
    const centralPort = Number(new URL(centralOrigin).port);
    this.tunnel = spawn("ssh", ["-F", this.config, "-o", "ExitOnForwardFailure=yes", "-N",
      "-L", "127.0.0.1:" + port + ":127.0.0.1:" + port,
      "-R", "127.0.0.1:" + centralPort + ":127.0.0.1:" + centralPort, this.target], { windowsHide: true, stdio: "ignore" });
    this.tunnel.on("error", () => {});
    await delay(1500, undefined, { signal: this.signal });
    assert.equal(this.tunnel.exitCode, null, "SSH control forwarding failed");
  }

  override async start(): Promise<void> {
    assert.ok(!this.daemon && this.origin, "remote runtime must be prepared and stopped");
    const assignments: Record<string, string> = {
      LOOM_DAEMON_HOST: "127.0.0.1", LOOM_DAEMON_PORT: new URL(this.origin).port,
      LOOM_DAEMON_TOKEN: this.token, LOOM_CONTROL_PLANE_ROOT: this.remoteRoot + "\\control",
      LOOM_CONFIGURATION_ROOT: this.remoteRoot + "\\configuration", LOOM_RUN_STORE_PATH: this.remoteRoot + "\\runs.sqlite3",
    };
    const script = "Get-ChildItem Env: | Where-Object Name -Like 'LOOM_*' | Remove-Item; " +
      Object.entries(assignments).map(([key, value]) => "$env:" + key + "='" + value + "'; ").join("") +
      "New-Item -ItemType Directory -Force -Path '" + this.remoteRoot + "\\capabilities' | Out-Null; " +
      "$p=Start-Process -WindowStyle Hidden -FilePath '" + this.remoteExe + "' -WorkingDirectory '" + this.remoteRoot +
      "' -ArgumentList '--manifest-dir','" + this.remoteRoot + "\\capabilities' -PassThru " +
      "-RedirectStandardOutput '" + this.remoteRoot + "\\stdout.log' -RedirectStandardError '" + this.remoteRoot + "\\stderr.log'; " +
      "Write-Output $p.Id; $p.WaitForExit(); if($p.ExitCode -ne 0){Get-Content -LiteralPath '" + this.remoteRoot + "\\stderr.log' -Tail 8}; exit $p.ExitCode;";
    const guarded = "try { " + script + " } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }";
    this.daemon = spawn("ssh", this.args(guarded), { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    this.daemon.on("error", () => {});
    let diagnostic = "";
    this.daemon.stderr?.on("data", (chunk: Buffer) => { diagnostic = (diagnostic + chunk.toString("utf8")).slice(0, 2048); });
    let output = "";
    this.daemon.stdout?.on("data", (chunk: Buffer) => {
      output = (output + chunk.toString("utf8")).slice(0, 512);
      const match = output.match(/^\s*(\d+)\r?\n/);
      if (match && !this.remotePid) { this.remotePid = Number(match[1]); this.pids.push(this.remotePid); }
    });
    const until = Date.now() + 20_000;
    while (Date.now() < until) {
      this.signal.throwIfAborted();
      assert.equal(this.daemon.exitCode, null, "remote candidate exited before readiness: " + (diagnostic + output).replaceAll(this.token, "[redacted]"));
      try {
        const response = await this.request("/health");
        if (response.status === 200 && response.body.status === "ok" && this.remotePid) return;
      } catch { /* Forwarded port can precede daemon readiness. */ }
      await delay(100, undefined, { signal: this.signal });
    }
    throw new Error("remote daemon readiness timed out");
  }

  override async stop(): Promise<void> {
    if (!this.daemon) return;
    // Match unique manifest and executable, including partial startup failures.
    this.command("Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq '" +
      this.remoteExe.replaceAll("/", "\\") + "' -and $_.CommandLine -like '*" + this.remoteRoot +
      "\\capabilities*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; " +
      "Wait-Process -Id $_.ProcessId -Timeout 5 -ErrorAction SilentlyContinue }");
    this.daemon.kill();
    this.daemon = undefined;
    this.remotePid = undefined;
  }

  override async dispose(): Promise<void> {
    try {
      await this.stop();
      this.command("$p=[IO.Path]::GetFullPath('" + this.remoteRoot + "'); if($p -ne '" +
        this.remoteRoot.replaceAll("/", "\\") + "'){throw 'cleanup path mismatch'}; " +
        "if(Test-Path -LiteralPath $p){ if((Get-Item -LiteralPath $p).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'unexpected reparse point'}; " +
        "Remove-Item -LiteralPath $p -Recurse -Force }; if(Test-Path -LiteralPath $p){throw 'remote cleanup failed'}");
    } finally {
      this.tunnel?.kill();
      await super.dispose();
    }
  }
}
