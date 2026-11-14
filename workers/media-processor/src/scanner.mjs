import { spawn } from "node:child_process";

export async function scanFile(file, {
  binary = process.env.CLAMSCAN_BIN || "clamscan",
  database = process.env.CLAMAV_DATABASE || "/var/lib/clamav",
  timeoutMs = 120_000
} = {}) {
  return new Promise((resolve, reject) => {
    const args = ["--database=" + database, "--no-summary", "--infected", file];
    const child = spawn(binary, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", chunk => { stdout = (stdout + chunk.toString()).slice(-4000); });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk.toString()).slice(-4000); });
    // A missing or unlaunchable scanner must fail closed with a classified code,
    // never as an unclassified error and never as a clean result.
    child.on("error", error => {
      clearTimeout(timer);
      reject(Object.assign(new Error("ClamAV scanner could not be started: " + error.message), {
        code: "SCANNER_UNAVAILABLE", cause: error
      }));
    });
    child.on("close", code => {
      clearTimeout(timer);
      if (code === 0) return resolve({ status: "clean", output: stdout });
      if (code === 1) return reject(Object.assign(new Error("Malware detected by ClamAV"), {
        code: "MALWARE_DETECTED", quarantine: true
      }));
      reject(Object.assign(new Error("ClamAV scan failed: " + (stderr || stdout || "exit " + code)), {
        code: "SCANNER_UNAVAILABLE"
      }));
    });
  });
}
