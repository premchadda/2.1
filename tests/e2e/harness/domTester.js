/**
 * tests/e2e/harness/domTester.js
 * In-memory headless DOM testing environment with dynamic JSX transpilation and Web API mocks.
 */

import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { register } from "node:module";

// Ensure Node 24 dynamic JSX and asset loader hook is active
const loaderPath = path.resolve(process.cwd(), "tests/e2e/harness/jsxLoader.mjs");
if (fs.existsSync(loaderPath)) {
  try {
    register(pathToFileURL(loaderPath).href, import.meta.url);
  } catch {}
}

let JSDOM;

async function loadJSDOM() {
  if (!JSDOM) {
    const jsdomPath = path.resolve(process.cwd(), "apps/backend/node_modules/jsdom/lib/api.js");
    const module = await import(pathToFileURL(jsdomPath).href);
    JSDOM = module.JSDOM;
  }
  return JSDOM;
}

export class DomEnvironment {
  constructor(html = '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>') {
    this.html = html;
    this.dom = null;
    this.window = null;
    this.document = null;
    this.activeRoot = null;
  }

  async init() {
    const Cls = await loadJSDOM();
    this.dom = new Cls(this.html, {
      url: "http://localhost:3000",
      pretendToBeVisual: true,
      runScripts: "dangerously",
    });

    this.window = this.dom.window;
    this.document = this.window.document;

    // Attach global browser shims
    globalThis.window = this.window;
    globalThis.document = this.document;
    globalThis.HTMLElement = this.window.HTMLElement;
    globalThis.Node = this.window.Node;
    globalThis.Event = this.window.Event;
    globalThis.CustomEvent = this.window.CustomEvent;

    // SpeechSynthesis mock
    this.mockSpeech = {
      speaking: false,
      paused: false,
      pending: false,
      speak: (utterance) => {
        this.mockSpeech.speaking = true;
        this.mockSpeech.lastUtterance = utterance;
        if (utterance.onstart) utterance.onstart();
        setTimeout(() => {
          this.mockSpeech.speaking = false;
          if (utterance.onend) utterance.onend();
        }, 10);
      },
      cancel: () => {
        this.mockSpeech.speaking = false;
        this.mockSpeech.paused = false;
      },
      pause: () => {
        this.mockSpeech.paused = true;
      },
      resume: () => {
        this.mockSpeech.paused = false;
      },
      getVoices: () => [
        { lang: "en-IN", name: "Rishi (English - India)", default: true },
        { lang: "hi-IN", name: "Lekha (Hindi - India)", default: false },
        { lang: "en-US", name: "Alex (English - US)", default: false },
      ],
    };
    this.window.speechSynthesis = this.mockSpeech;
    globalThis.speechSynthesis = this.mockSpeech;

    // IntersectionObserver mock
    this.observerInstances = [];
    const self = this;
    class MockIntersectionObserver {
      constructor(callback, options = {}) {
        this.callback = callback;
        this.options = options;
        this.elements = new Set();
        self.observerInstances.push(this);
      }
      observe(el) {
        this.elements.add(el);
      }
      unobserve(el) {
        this.elements.delete(el);
      }
      disconnect() {
        this.elements.clear();
      }
      triggerIntersect(element, isIntersecting = true) {
        this.callback([{ target: element, isIntersecting, intersectionRatio: isIntersecting ? 1 : 0 }], this);
      }
    }
    this.window.IntersectionObserver = MockIntersectionObserver;
    globalThis.IntersectionObserver = MockIntersectionObserver;

    // window.print mock
    this.printCalls = 0;
    this.window.print = () => {
      this.printCalls++;
    };

    // matchMedia mock
    this.window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });

    return this;
  }

  /**
   * Mount a React component headlessly into #root with optional MemoryRouter wrapping
   */
  async mount(Component, props = {}, options = {}) {
    const React = (await import(pathToFileURL(path.resolve(process.cwd(), "apps/frontend/node_modules/react/index.js")).href)).default;
    const ReactDOM = await import(pathToFileURL(path.resolve(process.cwd(), "apps/frontend/node_modules/react-dom/client.js")).href);

    const rootEl = this.document.getElementById("root") || this.document.body.appendChild(this.document.createElement("div"));
    this.activeRoot = ReactDOM.createRoot(rootEl);

    let element = React.createElement(Component, props);

    if (options.router) {
      const { MemoryRouter, Routes, Route } = await import(
        pathToFileURL(path.resolve(process.cwd(), "apps/frontend/node_modules/react-router-dom/dist/index.js")).href
      );
      const initialEntries = options.router.initialEntries || ["/"];
      const routePath = options.router.routePath || "*";
      element = React.createElement(
        MemoryRouter,
        { initialEntries },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: routePath, element })
        )
      );
    }

    this.activeRoot.render(element);
    // Allow React 18 concurrent microtasks to commit DOM
    await new Promise((r) => setTimeout(r, options.waitMs || 100));

    return { rootEl, container: rootEl };
  }

  /**
   * Render and test a custom React Hook headlessly
   */
  async renderHook(hookFn, initialProps) {
    const React = (await import(pathToFileURL(path.resolve(process.cwd(), "apps/frontend/node_modules/react/index.js")).href)).default;
    const ReactDOM = await import(pathToFileURL(path.resolve(process.cwd(), "apps/frontend/node_modules/react-dom/client.js")).href);

    const result = { current: null };
    function HookHarness({ props }) {
      result.current = hookFn(props);
      return null;
    }

    const container = this.document.createElement("div");
    this.document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);

    root.render(React.createElement(HookHarness, { props: initialProps }));
    await new Promise((r) => setTimeout(r, 50));

    return {
      result,
      unmount: () => {
        root.unmount();
        container.remove();
      },
    };
  }

  triggerAllObservers(isIntersecting = true) {
    for (const observer of this.observerInstances) {
      for (const el of observer.elements) {
        observer.triggerIntersect(el, isIntersecting);
      }
    }
  }

  cleanup() {
    if (this.activeRoot) {
      try {
        this.activeRoot.unmount();
      } catch {}
    }
    if (this.window) {
      this.window.close();
    }
  }
}

export const fireEvent = {
  click(element) {
    if (!element) throw new Error("fireEvent.click called with null element");
    const event = new (globalThis.window?.MouseEvent || Event)("click", {
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
  },
  change(element, { target: { value } }) {
    if (!element) throw new Error("fireEvent.change called with null element");
    element.value = value;
    const event = new (globalThis.window?.Event || Event)("change", {
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
  },
  input(element, { target: { value } }) {
    if (!element) throw new Error("fireEvent.input called with null element");
    element.value = value;
    const event = new (globalThis.window?.Event || Event)("input", {
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
  },
  keyDown(element, options = {}) {
    if (!element) throw new Error("fireEvent.keyDown called with null element");
    const event = new (globalThis.window?.KeyboardEvent || Event)("keydown", {
      bubbles: true,
      cancelable: true,
      key: options.key || "Enter",
      code: options.code || "Enter",
    });
    element.dispatchEvent(event);
  },
  submit(form) {
    if (!form) throw new Error("fireEvent.submit called with null form");
    const event = new (globalThis.window?.Event || Event)("submit", {
      bubbles: true,
      cancelable: true,
    });
    form.dispatchEvent(event);
  },
};

export const screen = {
  getByText(textOrRegex) {
    const doc = globalThis.document;
    const all = Array.from(doc.body.querySelectorAll("*"));
    const found = all.find((el) => {
      const txt = el.textContent || "";
      if (typeof textOrRegex === "string") {
        return txt.includes(textOrRegex);
      }
      return textOrRegex.test(txt);
    });
    if (!found) {
      throw new Error(`Unable to find element with text: ${textOrRegex}`);
    }
    return found;
  },
  queryByText(textOrRegex) {
    try {
      return this.getByText(textOrRegex);
    } catch {
      return null;
    }
  },
  getByTestId(testId) {
    const el = globalThis.document?.querySelector(`[data-testid="${testId}"]`);
    if (!el) {
      throw new Error(`Unable to find element with data-testid: ${testId}`);
    }
    return el;
  },
  queryByTestId(testId) {
    return globalThis.document?.querySelector(`[data-testid="${testId}"]`) || null;
  },
  getAllByTestId(testId) {
    const list = Array.from(globalThis.document?.querySelectorAll(`[data-testid="${testId}"]`) || []);
    return list;
  },
  getByRole(role, options = {}) {
    let selector = role;
    if (role === "button") selector = "button, [role='button'], input[type='button'], input[type='submit']";
    if (role === "dialog") selector = "dialog, [role='dialog']";
    if (role === "radio") selector = "input[type='radio'], [role='radio']";
    if (role === "img") selector = "img, [role='img']";
    if (role === "navigation") selector = "nav, [role='navigation']";
    if (role === "combobox") selector = "select, [role='combobox']";

    const all = Array.from(globalThis.document?.querySelectorAll(selector) || []);
    if (options.name) {
      const regex = typeof options.name === "string" ? new RegExp(options.name, "i") : options.name;
      const filtered = all.filter((el) => {
        const label = el.getAttribute("aria-label") || el.textContent || el.value || "";
        return regex.test(label);
      });
      if (filtered.length === 0) {
        throw new Error(`Unable to find role "${role}" with name: ${options.name}`);
      }
      return filtered[0];
    }
    if (all.length === 0) {
      throw new Error(`Unable to find element with role: ${role}`);
    }
    return all[0];
  },
  getAllByRole(role, options = {}) {
    let selector = role;
    if (role === "button") selector = "button, [role='button']";
    if (role === "link") selector = "a[href], [role='link']";
    if (role === "radio") selector = "input[type='radio'], [role='radio']";
    const all = Array.from(globalThis.document?.querySelectorAll(selector) || []);
    return all;
  },
  getByLabelText(textOrRegex) {
    const regex = typeof textOrRegex === "string" ? new RegExp(textOrRegex, "i") : textOrRegex;
    const labels = Array.from(globalThis.document?.querySelectorAll("label") || []);
    const matching = labels.find((l) => regex.test(l.textContent || ""));
    if (matching && matching.htmlFor) {
      const input = globalThis.document.getElementById(matching.htmlFor);
      if (input) return input;
    }
    const ariaMatch = Array.from(globalThis.document?.querySelectorAll("[aria-label]") || []).find(
      (el) => regex.test(el.getAttribute("aria-label") || "")
    );
    if (ariaMatch) return ariaMatch;
    throw new Error(`Unable to find element by label text: ${textOrRegex}`);
  },
};
