/**
 * ResearchMate AI — in-memory async job registry (single-node deployment).
 *
 * Long AI tasks (full review, reference verification, response letter, …)
 * are executed in the background so the HTTP request returns immediately.
 * Clients poll GET /api/jobs/[id] until done. This keeps every HTTP request
 * short-lived and immune to reverse-proxy / gateway timeouts (502/504).
 */

export type JobState = {
  id: string;
  done: boolean;
  error?: string;
  payload?: any;
  startedAt: number;
};

const jobs = new Map<string, JobState>();
const JOB_TTL_MS = 30 * 60 * 1000; // keep finished jobs 30 min for late pollers

function gc() {
  const now = Date.now();
  for (const [k, v] of jobs) {
    if (now - v.startedAt > JOB_TTL_MS) jobs.delete(k);
  }
}

export function createJob(): string {
  gc();
  const id = crypto.randomUUID();
  jobs.set(id, { id, done: false, startedAt: Date.now() });
  return id;
}

export function finishJob(id: string, payload?: any, error?: string): void {
  const job = jobs.get(id);
  if (!job) return;
  job.done = true;
  job.payload = payload;
  job.error = error;
  setTimeout(() => jobs.delete(id), JOB_TTL_MS).unref?.();
}

export function getJob(id: string): JobState | null {
  return jobs.get(id) ?? null;
}

/**
 * Run work in the background under a fresh job id.
 * The returned promise resolves when the work settles (for optional awaiting
 * in legacy sync mode); it never rejects.
 */
export function runAsync<T>(work: () => Promise<T>): { jobId: string; promise: Promise<void> } {
  const jobId = createJob();
  const promise = (async () => {
    try {
      const payload = await work();
      finishJob(jobId, payload);
    } catch (e: any) {
      finishJob(jobId, undefined, String(e?.message || e).slice(0, 500));
    }
  })();
  return { jobId, promise };
}
