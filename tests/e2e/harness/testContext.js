/**
 * tests/e2e/harness/testContext.js
 * Unified assertion library, test registry, and runner lifecycle for E2E test suites.
 */

class AssertionError extends Error {
  constructor(message, actual, expected) {
    super(message);
    this.name = "AssertionError";
    this.actual = actual;
    this.expected = expected;
  }
}

function deepEqual(a, b, visited = new Map()) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }

  // Cycle detection: track pairs of objects currently being compared
  if (visited.has(a)) {
    return visited.get(a) === b;
  }
  visited.set(a, b);

  // Date equality
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }

  // RegExp equality
  if (a instanceof RegExp || b instanceof RegExp) {
    return (
      a instanceof RegExp &&
      b instanceof RegExp &&
      a.source === b.source &&
      a.flags === b.flags
    );
  }

  // Set equality
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set && b instanceof Set)) return false;
    if (a.size !== b.size) return false;
    for (const aItem of a) {
      let matched = false;
      for (const bItem of b) {
        if (deepEqual(aItem, bItem, visited)) {
          matched = true;
          break;
        }
      }
      if (!matched) return false;
    }
    return true;
  }

  // Map equality
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map && b instanceof Map)) return false;
    if (a.size !== b.size) return false;
    for (const [aKey, aVal] of a) {
      let matched = false;
      if (b.has(aKey)) {
        if (deepEqual(aVal, b.get(aKey), visited)) {
          matched = true;
        }
      } else {
        for (const [bKey, bVal] of b) {
          if (deepEqual(aKey, bKey, visited) && deepEqual(aVal, bVal, visited)) {
            matched = true;
            break;
          }
        }
      }
      if (!matched) return false;
    }
    return true;
  }

  // Array equality
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i], visited)) return false;
    }
    return true;
  }

  // TypedArray / ArrayBuffer views
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b) || a.byteLength !== b.byteLength) {
      return false;
    }
    const uA = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const uB = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    for (let i = 0; i < uA.length; i++) {
      if (uA[i] !== uB[i]) return false;
    }
    return true;
  }

  // Error equality
  if (a instanceof Error || b instanceof Error) {
    return (
      a instanceof Error &&
      b instanceof Error &&
      a.message === b.message &&
      a.name === b.name
    );
  }

  // Prototype & Own Keys equality
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) {
    return false;
  }

  const keysA = Reflect.ownKeys(a);
  const keysB = Reflect.ownKeys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual(a[key], b[key], visited)) {
      return false;
    }
  }

  return true;
}

function stringify(val) {
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

export function expect(actual) {
  const matchers = (isNot = false) => ({
    toBe(expected) {
      const pass = Object.is(actual, expected);
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected ${stringify(actual)} ${isNot ? "NOT to be" : "to be"} ${stringify(expected)}`,
          actual,
          expected
        );
      }
    },
    toEqual(expected) {
      const pass = deepEqual(actual, expected);
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected ${stringify(actual)} ${isNot ? "NOT to equal" : "to equal"} ${stringify(expected)}`,
          actual,
          expected
        );
      }
    },
    toBeDefined() {
      const pass = actual !== undefined;
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected value ${isNot ? "to be undefined" : "to be defined"}, got ${stringify(actual)}`,
          actual,
          undefined
        );
      }
    },
    toBeUndefined() {
      const pass = actual === undefined;
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected value ${isNot ? "to be defined" : "to be undefined"}, got ${stringify(actual)}`,
          actual,
          undefined
        );
      }
    },
    toBeNull() {
      const pass = actual === null;
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected value ${isNot ? "NOT to be null" : "to be null"}, got ${stringify(actual)}`,
          actual,
          null
        );
      }
    },
    toBeTruthy() {
      const pass = Boolean(actual);
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected ${stringify(actual)} ${isNot ? "to be falsy" : "to be truthy"}`,
          actual,
          true
        );
      }
    },
    toBeFalsy() {
      const pass = !Boolean(actual);
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected ${stringify(actual)} ${isNot ? "to be truthy" : "to be falsy"}`,
          actual,
          false
        );
      }
    },
    toBeGreaterThan(expected) {
      const pass = actual > expected;
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected ${actual} ${isNot ? "NOT to be greater than" : "to be greater than"} ${expected}`,
          actual,
          expected
        );
      }
    },
    toBeGreaterThanOrEqual(expected) {
      const pass = actual >= expected;
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected ${actual} ${isNot ? "to be less than" : "to be greater than or equal to"} ${expected}`,
          actual,
          expected
        );
      }
    },
    toBeLessThan(expected) {
      const pass = actual < expected;
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected ${actual} ${isNot ? "NOT to be less than" : "to be less than"} ${expected}`,
          actual,
          expected
        );
      }
    },
    toBeLessThanOrEqual(expected) {
      const pass = actual <= expected;
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected ${actual} ${isNot ? "to be greater than" : "to be less than or equal to"} ${expected}`,
          actual,
          expected
        );
      }
    },
    toBeCloseTo(expected, numDigits = 2) {
      const pass = Math.abs(actual - expected) < Math.pow(10, -numDigits) / 2;
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected ${actual} ${isNot ? "NOT to be close to" : "to be close to"} ${expected} (${numDigits} digits)`,
          actual,
          expected
        );
      }
    },
    toContain(item) {
      let pass = false;
      if (typeof actual === "string") {
        pass = actual.includes(String(item));
      } else if (Array.isArray(actual)) {
        pass = actual.some((elem) => deepEqual(elem, item));
      } else if (actual instanceof Set) {
        pass = actual.has(item);
      } else if (actual && typeof actual === "object") {
        pass = Object.prototype.hasOwnProperty.call(actual, item);
      }
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected ${stringify(actual)} ${isNot ? "NOT to contain" : "to contain"} ${stringify(item)}`,
          actual,
          item
        );
      }
    },
    toHaveLength(expectedLen) {
      const len = actual?.length ?? (actual instanceof Set || actual instanceof Map ? actual.size : undefined);
      const pass = len === expectedLen;
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected length ${isNot ? "NOT to be" : "to be"} ${expectedLen}, got ${len}`,
          len,
          expectedLen
        );
      }
    },
    toHaveProperty(prop, value) {
      const hasProp = actual != null && Object.prototype.hasOwnProperty.call(actual, prop);
      let pass = hasProp;
      if (hasProp && value !== undefined) {
        pass = deepEqual(actual[prop], value);
      }
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected object ${isNot ? "NOT to have property" : "to have property"} "${prop}"${value !== undefined ? ` with value ${stringify(value)}` : ""}`,
          actual?.[prop],
          value
        );
      }
    },
    toMatch(pattern) {
      const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
      const pass = regex.test(String(actual));
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected ${stringify(actual)} ${isNot ? "NOT to match" : "to match"} ${regex}`,
          actual,
          pattern
        );
      }
    },
    toThrow(expectedError) {
      let threw = false;
      let errorThrown = null;
      try {
        if (typeof actual !== "function") {
          throw new Error("expect(fn).toThrow requires actual to be a function");
        }
        actual();
      } catch (err) {
        threw = true;
        errorThrown = err;
      }
      let pass = threw;
      if (threw && expectedError) {
        if (typeof expectedError === "string") {
          pass = errorThrown.message.includes(expectedError);
        } else if (expectedError instanceof RegExp) {
          pass = expectedError.test(errorThrown.message);
        } else if (typeof expectedError === "function") {
          pass = errorThrown instanceof expectedError;
        }
      }
      if (isNot ? pass : !pass) {
        throw new AssertionError(
          `Expected function ${isNot ? "NOT to throw" : "to throw"}${expectedError ? ` matching ${expectedError}` : ""}`,
          errorThrown,
          expectedError
        );
      }
    },
  });

  const base = matchers(false);
  base.not = matchers(true);
  return base;
}

// Suite and Test Registry
class Suite {
  constructor(name, parent = null) {
    this.name = name;
    this.parent = parent;
    this.beforeAllHooks = [];
    this.afterAllHooks = [];
    this.beforeEachHooks = [];
    this.afterEachHooks = [];
    this.tests = [];
    this.subSuites = [];
  }
}

let rootSuite = new Suite("root");
let currentSuite = rootSuite;

export function describe(name, fn) {
  const previousSuite = currentSuite;
  const suite = new Suite(name, currentSuite);
  currentSuite.subSuites.push(suite);
  currentSuite = suite;
  try {
    fn();
  } finally {
    currentSuite = previousSuite;
  }
}

export function it(name, fn) {
  currentSuite.tests.push({ name, fn, suite: currentSuite });
}
export const test = it;

export function beforeAll(fn) {
  currentSuite.beforeAllHooks.push(fn);
}

export function afterAll(fn) {
  currentSuite.afterAllHooks.push(fn);
}

export function beforeEach(fn) {
  currentSuite.beforeEachHooks.push(fn);
}

export function afterEach(fn) {
  currentSuite.afterEachHooks.push(fn);
}

export function resetRegistry() {
  rootSuite = new Suite("root");
  currentSuite = rootSuite;
}

export function getRegistry() {
  return rootSuite;
}

function getAncestryHooks(suite, hookName) {
  const chain = [];
  let curr = suite;
  while (curr) {
    if (curr[hookName]) {
      chain.unshift(...curr[hookName]);
    }
    curr = curr.parent;
  }
  return chain;
}

export async function runSuites(options = {}) {
  const { bail = false, onTestResult = null } = options;
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    failures: [],
    suites: [],
    durationMs: 0,
  };

  const startTime = Date.now();

  async function executeSuite(suite) {
    const suiteResult = {
      name: suite.name,
      tests: [],
      passed: true,
    };

    // Run beforeAll
    for (const hook of suite.beforeAllHooks) {
      await hook();
    }

    // Run tests
    for (const t of suite.tests) {
      results.total++;
      const testResult = {
        name: t.name,
        suiteName: suite.name,
        passed: false,
        durationMs: 0,
        error: null,
      };

      const tStart = Date.now();
      let testError = null;
      try {
        // Run beforeEach hooks from root down to this suite
        const beHooks = getAncestryHooks(suite, "beforeEachHooks");
        for (const hook of beHooks) {
          await hook();
        }

        await t.fn();
      } catch (err) {
        testError = err;
      } finally {
        // Guaranteed afterEach teardown in finally block
        // Execute in reverse order: leaf suite hooks first, then parent suites
        const aeHooks = getAncestryHooks(suite, "afterEachHooks").reverse();
        for (const hook of aeHooks) {
          try {
            await hook();
          } catch (aeErr) {
            console.error(`Error in afterEach hook for test "${t.name}":`, aeErr);
            if (!testError) {
              testError = aeErr;
            }
          }
        }
        testResult.durationMs = Date.now() - tStart;
      }

      if (testError) {
        testResult.passed = false;
        testResult.error = testError;
        results.failed++;
        results.failures.push({
          test: t.name,
          suite: suite.name,
          error: testError,
        });
        suiteResult.passed = false;
      } else {
        testResult.passed = true;
        results.passed++;
      }

      suiteResult.tests.push(testResult);
      if (onTestResult) {
        onTestResult(testResult);
      }

      if (bail && !testResult.passed) {
        break;
      }
    }

    // Run subSuites
    for (const sub of suite.subSuites) {
      if (bail && results.failed > 0) break;
      const subRes = await executeSuite(sub);
      if (!subRes.passed) {
        suiteResult.passed = false;
      }
    }

    // Run afterAll
    for (const hook of suite.afterAllHooks) {
      try {
        await hook();
      } catch (e) {
        console.error(`Error in afterAll for suite ${suite.name}:`, e);
      }
    }

    results.suites.push(suiteResult);
    return suiteResult;
  }

  for (const child of rootSuite.subSuites) {
    if (bail && results.failed > 0) break;
    await executeSuite(child);
  }

  results.durationMs = Date.now() - startTime;
  return results;
}
