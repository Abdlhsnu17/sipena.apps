const targetUrl = process.env.LOAD_TEST_URL || "http://127.0.0.1:3000/api/auth/login";
const concurrency = Number.parseInt(process.env.LOAD_TEST_CONCURRENCY || "10", 10);
const totalRequests = Number.parseInt(process.env.LOAD_TEST_TOTAL || "50", 10);
const payload = {
  nip: process.env.LOAD_TEST_NIP || "invalid-user",
  password: process.env.LOAD_TEST_PASSWORD || "invalid-password",
};

const startedAt = Date.now();
let successCount = 0;
let rateLimitedCount = 0;
let unauthorizedCount = 0;
let otherFailureCount = 0;
const latencySamples = [];

const requestOnce = async () => {
  const requestStartedAt = performance.now();

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const latency = performance.now() - requestStartedAt;
    latencySamples.push(latency);

    if (response.ok) {
      successCount += 1;
      return;
    }

    if (response.status === 429) {
      rateLimitedCount += 1;
      return;
    }

    if (response.status === 401 || response.status === 404) {
      unauthorizedCount += 1;
      return;
    }

    otherFailureCount += 1;
  } catch {
    otherFailureCount += 1;
  }
};

const worker = async (iterations) => {
  for (let index = 0; index < iterations; index += 1) {
    await requestOnce();
  }
};

const run = async () => {
  if (!Number.isFinite(concurrency) || concurrency <= 0) {
    throw new Error("LOAD_TEST_CONCURRENCY harus lebih besar dari 0.");
  }

  if (!Number.isFinite(totalRequests) || totalRequests <= 0) {
    throw new Error("LOAD_TEST_TOTAL harus lebih besar dari 0.");
  }

  const workerCount = Math.min(concurrency, totalRequests);
  const baseIterations = Math.floor(totalRequests / workerCount);
  const remainder = totalRequests % workerCount;
  const workers = Array.from({ length: workerCount }, (_, workerIndex) => {
    const iterations = baseIterations + (workerIndex < remainder ? 1 : 0);
    return worker(iterations);
  });

  await Promise.all(workers);

  const durationMs = Date.now() - startedAt;
  const averageLatencyMs =
    latencySamples.length > 0
      ? latencySamples.reduce((sum, sample) => sum + sample, 0) / latencySamples.length
      : 0;

  console.log("Load test login selesai");
  console.log(`Target: ${targetUrl}`);
  console.log(`Total request: ${totalRequests}`);
  console.log(`Concurrency: ${workerCount}`);
  console.log(`Durasi: ${durationMs} ms`);
  console.log(`Rata-rata latency: ${averageLatencyMs.toFixed(2)} ms`);
  console.log(`Sukses: ${successCount}`);
  console.log(`401/404: ${unauthorizedCount}`);
  console.log(`429: ${rateLimitedCount}`);
  console.log(`Lainnya: ${otherFailureCount}`);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
