import test from "node:test";
import assert from "node:assert/strict";
import { scanFile } from "../src/scanner.mjs";

test("scanner rejects a missing scanner binary instead of treating it as clean", async () => {
  await assert.rejects(
    scanFile("/tmp/not-used", { binary: "/definitely/missing/clamscan", database: "/tmp" }),
    (error) => error.code === "SCANNER_UNAVAILABLE",
  );
});

test("scanner rejects non-clean scanner exit codes as unavailable", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const dir = await mkdtemp(path.join(tmpdir(), "socialos-scanner-test-"));
  try {
    const fake = path.join(dir, "clamscan");
    await writeFile(fake, "#!/bin/sh\nexit 2\n", { mode: 0o700 });
    await assert.rejects(
      scanFile("/tmp/not-used", { binary: fake, database: dir }),
      (error) => error.code === "SCANNER_UNAVAILABLE",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("scanner classifies ClamAV infected exit code as quarantinable", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const dir = await mkdtemp(path.join(tmpdir(), "socialos-scanner-test-"));
  try {
    const fake = path.join(dir, "clamscan");
    await writeFile(fake, "#!/bin/sh\necho 'Eicar-Test-Signature FOUND'\nexit 1\n", {
      mode: 0o700,
    });
    await assert.rejects(
      scanFile("/tmp/not-used", { binary: fake, database: dir }),
      (error) => error.code === "MALWARE_DETECTED" && error.quarantine === true,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
