// Test preload: every network call fails the way an offline machine does.
globalThis.fetch = async () => { throw new TypeError('fetch failed (stubbed offline)'); };
