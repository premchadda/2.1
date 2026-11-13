/**
 * @jest-environment node
 */
import {
  useUndoRedo,
  useFormManager,
  useDraggableScroll,
  useStages,
  useExamCategories,
  useTestCategories,
  useProPass,
  useGenericCRUD,
  useWebSocket,
  useDebounce,
  useSearch,
  usePwaInstall,
} from "../src/index.js";

describe("@trstprep/shared-hooks exports", () => {
  test("exports useUndoRedo as a function", () => {
    expect(typeof useUndoRedo).toBe("function");
  });

  test("exports useFormManager as a function", () => {
    expect(typeof useFormManager).toBe("function");
  });

  test("exports useDraggableScroll as a function", () => {
    expect(typeof useDraggableScroll).toBe("function");
  });

  test("exports core catalog & auth hooks as functions", () => {
    expect(typeof useStages).toBe("function");
    expect(typeof useExamCategories).toBe("function");
    expect(typeof useTestCategories).toBe("function");
    expect(typeof useProPass).toBe("function");
    expect(typeof useGenericCRUD).toBe("function");
    expect(typeof useWebSocket).toBe("function");
    expect(typeof useDebounce).toBe("function");
    expect(typeof useSearch).toBe("function");
    expect(typeof usePwaInstall).toBe("function");
  });
});
