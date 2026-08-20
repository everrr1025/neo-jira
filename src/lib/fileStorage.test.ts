import assert from "node:assert/strict";

import { formatStorageSize, getStoragePeriodStart } from "./fileStorage";

assert.equal(formatStorageSize(0), "0 B");
assert.equal(formatStorageSize(1023), "1023 B");
assert.equal(formatStorageSize(1024), "1.00 KB");
assert.equal(formatStorageSize(12 * 1024 * 1024), "12.0 MB");
assert.equal(formatStorageSize(3 * 1024 * 1024 * 1024), "3.00 GB");
assert.equal(getStoragePeriodStart(30, new Date("2026-08-20T04:00:00.000Z")).toISOString(), "2026-07-21T16:00:00.000Z");

console.log("fileStorage tests passed");
