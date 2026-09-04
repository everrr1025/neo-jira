import assert from "node:assert/strict";

import { getListActionColumnWidth } from "./listColumnSizing";

assert.equal(getListActionColumnWidth(0), 0);
assert.equal(getListActionColumnWidth(1), 56);
assert.equal(getListActionColumnWidth(2), 88);
assert.equal(getListActionColumnWidth(3), 120);
assert.equal(getListActionColumnWidth(4), 152);

console.log("list column sizing checks passed");
