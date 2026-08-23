import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Upload,
  X,
  FileJson,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Shield,
  Info,
  Search,
  ArrowLeft,
  Check,
  Loader2,
  Folder,
  FolderOpen,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { adminAPI } from "../../../../shared/lib/dataService";
import sanitizeHtml from "../../../../shared/lib/sanitizeHtml";

// Custom Checkbox Component supporting Checked, Partial, and Unchecked states
const CustomCheckbox = ({ state, onChange }) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`w-4 h-4 rounded border flex items-center justify-center transition-all focus:outline-none shrink-0 ${
        state === "checked"
          ? "bg-indigo-600 border-indigo-600 text-white"
          : state === "partial"
            ? "bg-indigo-100 border-indigo-500 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-400 dark:text-indigo-400"
            : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-indigo-400"
      }`}
    >
      {state === "checked" && <Check className="w-3 h-3 stroke-[3]" />}
      {state === "partial" && (
        <div className="w-1.5 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
      )}
    </button>
  );
};

const FullTestImportModal = ({ isOpen, onClose, onImported }) => {
  const [step, setStep] = useState(1); // 1: Upload & Validate, 2: Select Tests, 3: Preview Test, 4: Import Progress/Results
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [strict, setStrict] = useState(false);
  const [storageMode, setStorageMode] = useState("database"); // 'database' | 'json-file'

  // Data from backend after upload
  const [tests, setTests] = useState([]);
  const [schemaValidation, setSchemaValidation] = useState(null);

  // Selection & Tree state
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Preview state
  const [previewIndex, setPreviewIndex] = useState(null);
  const [previewTest, setPreviewTest] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [activePreviewSectionIndex, setActivePreviewSectionIndex] = useState(0);
  const [activePreviewTab, setActivePreviewTab] = useState("details"); // 'details' or 'questions'

  // Import results state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
    currentTitle: "",
  });

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFile(null);
      setTests([]);
      setSchemaValidation(null);
      setSelectedIndices([]);
      setSearchQuery("");
      setExpandedNodes(new Set());
      setPreviewIndex(null);
      setPreviewTest(null);
      setImportResult(null);
      setActivePreviewTab("details");
      setImportProgress({ current: 0, total: 0, currentTitle: "" });
      setStorageMode("database");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setTests([]);
    setSchemaValidation(null);
  };

  // Step 1: Upload and get test list + schema validation
  const handleUploadAndValidate = async () => {
    if (!file) {
      toast.error("Please select a JSON file first");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await adminAPI.uploadFullTestJson(fd);

      const { tests: loadedTests, schemaValidation: val } = res.data.data;
      setTests(loadedTests);
      setSchemaValidation(val);

      // Auto-select all by default
      setSelectedIndices(loadedTests.map((t) => t.index));

      // Auto-expand all hierarchy levels
      autoExpandAll(loadedTests);

      toast.success(
        res.data.message || "File uploaded and validated successfully!",
      );
      setStep(2); // Move to selection step
    } catch (error) {
      toast.error(
        error.response?.data?.message || error.message || "Upload failed",
      );
    } finally {
      setUploading(false);
    }
  };

  // Auto-expand all nodes by default
  const autoExpandAll = (testList) => {
    const keys = new Set();
    testList.forEach((t) => {
      const examCat = t.examCategoryId || "Uncategorized";
      const exam = t.examId || "No Exam";
      const series = t.testSeriesId || "No Series";
      const stage = t.stageId || "No Stage";

      const pathParts = [];
      pathParts.push(`cat:${examCat}`);
      pathParts.push(`cat:${examCat}/exam:${exam}`);
      pathParts.push(`cat:${examCat}/exam:${exam}/series:${series}`);
      pathParts.push(
        `cat:${examCat}/exam:${exam}/series:${series}/stage:${stage}`,
      );

      // Add all levels of subcategories
      let currentKey = `cat:${examCat}/exam:${exam}/series:${series}/stage:${stage}`;
      if (t.categoryId) {
        currentKey = `${currentKey}/subcategory:${t.categoryId}`;
        pathParts.push(currentKey);
      }
      if (t.subcategory) {
        currentKey = `${currentKey}/subcategory:${t.subcategory}`;
        pathParts.push(currentKey);
      }
      if (t.pyqYear) {
        currentKey = `${currentKey}/subcategory:${t.pyqYear}`;
        pathParts.push(currentKey);
      }

      pathParts.forEach((k) => keys.add(k));
    });
    setExpandedNodes(keys);
  };

  // Step 2: Fetch single test preview
  const handlePreviewTest = async (index) => {
    setPreviewIndex(index);
    setLoadingPreview(true);
    setStep(3);
    setActivePreviewTab("details");
    try {
      const res = await adminAPI.previewSingleTest(index);
      setPreviewTest(res.data.data);
      setActivePreviewSectionIndex(0);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to load test preview",
      );
      setStep(2);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Step 2: Bulk Import Selected (High-Speed Chunked Concurrent Worker Pool)
  const handleImportSelected = async () => {
    if (selectedIndices.length === 0) {
      toast.error("Please select at least one test to import");
      return;
    }
    setImporting(true);
    setStep(4);

    const total = selectedIndices.length;
    setImportProgress({
      current: 0,
      total,
      currentTitle: "Initializing parallel batch import engine...",
    });

    const accumulatedResults = {
      imported: [],
      failed: [],
    };

    // Chunk selected indices into batches of 5 for optimal DB batching & network efficiency
    const BATCH_SIZE = 5;
    const chunks = [];
    for (let i = 0; i < selectedIndices.length; i += BATCH_SIZE) {
      chunks.push(selectedIndices.slice(i, i + BATCH_SIZE));
    }

    let completedCount = 0;
    const chunkQueue = [...chunks];
    let queueHead = 0;
    // Run 3 concurrent worker pipelines (queueHead increment is synchronous, avoids race)
    const CONCURRENCY = Math.min(3, chunkQueue.length);
    const getNextChunk = () => {
      if (queueHead >= chunkQueue.length) return null;
      return chunkQueue[queueHead++];
    };

    const executeWithRetry = async (payload, maxRetries = 2) => {
      let lastError = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const res = await adminAPI.importSelectedTests(payload);
          return res.data?.data || {};
        } catch (err) {
          lastError = err;
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          }
        }
      }
      throw lastError;
    };

    let abortImport = false;
    const worker = async (workerId) => {
      while (!abortImport) {
        const chunkIndices = getNextChunk();
        if (!chunkIndices) break;
        const firstIdx = chunkIndices[0];
        const testObj = tests.find((t) => t.index === firstIdx);
        const chunkLabel = testObj
          ? testObj.title
          : `Tests (${chunkIndices.length})`;

        const payload = {
          indices: chunkIndices,
          strict,
          storageMode,
        };

        try {
          const resData = await executeWithRetry(payload);
          if (resData.imported && resData.imported.length > 0) {
            accumulatedResults.imported.push(...resData.imported);
          }
          if (resData.failed && resData.failed.length > 0) {
            accumulatedResults.failed.push(...resData.failed);
          }
        } catch (error) {
          console.error(
            `[Import Modal Worker ${workerId}] Batch failed:`,
            error,
          );
          const errorMsg =
            error.response?.data?.message ||
            error.message ||
            "Import request failed";
          chunkIndices.forEach((idx) => {
            const tObj = tests.find((t) => t.index === idx);
            accumulatedResults.failed.push({
              index: idx,
              testTitle: tObj ? tObj.title : `Test #${idx}`,
              error: errorMsg,
            });
          });
        } finally {
          completedCount += chunkIndices.length;
          setImportProgress({
            current: Math.min(completedCount, total),
            total,
            currentTitle: chunkLabel,
          });
        }
      }
    };

    const workers = Array.from({ length: CONCURRENCY }, (_, i) =>
      worker(i + 1),
    );
    await Promise.all(workers);

    setImportResult(accumulatedResults);
    setImporting(false);

    const successCount = accumulatedResults.imported.length;
    const failCount = accumulatedResults.failed.length;

    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} test(s)`);
      onImported?.();
    }
    if (failCount > 0) {
      toast.error(`Failed to import ${failCount} test(s)`);
    }
  };

  // Toggle single selection
  const handleToggleSelect = (index) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  // Group tests into a nested hierarchy tree recursively supporting N-level subcategories
  const buildHierarchy = (testList) => {
    const root = {
      type: "folder",
      name: "Root",
      key: "root",
      children: {},
      tests: [],
    };

    testList.forEach((t) => {
      const pathParts = [];

      if (t.examCategoryId)
        pathParts.push({ type: "examGroup", name: t.examCategoryId });
      if (t.examId) pathParts.push({ type: "exam", name: t.examId });
      if (t.testSeriesId)
        pathParts.push({ type: "series", name: t.testSeriesId });
      if (t.stageId) pathParts.push({ type: "stage", name: t.stageId });

      // Add subcategories dynamically
      if (t.categoryId)
        pathParts.push({ type: "subcategory", name: t.categoryId, level: 0 });
      if (t.subcategory)
        pathParts.push({ type: "subcategory", name: t.subcategory, level: 1 });
      if (t.pyqYear)
        pathParts.push({
          type: "subcategory",
          name: String(t.pyqYear),
          level: 2,
        });

      let current = root;
      let currentKey = "root";

      pathParts.forEach((part) => {
        const key = `${part.type}:${part.name}`;
        currentKey = `${currentKey}/${key}`;

        if (!current.children[key]) {
          current.children[key] = {
            type: "folder",
            nodeType: part.type,
            name: part.name,
            key: currentKey,
            level: part.level,
            children: {},
            tests: [],
          };
        }
        current.children[key].tests.push(t);
        current = current.children[key];
      });

      const leafKey = `test:${t.index}`;
      current.children[leafKey] = {
        type: "test",
        test: t,
        key: `${currentKey}/${leafKey}`,
      };
    });

    return root;
  };

  // Recursively collect all tests inside a subtree node
  const getAllTestsInSubtree = (node) => {
    if (node.type === "test") return [node.test];
    if (node.type === "folder") {
      return node.tests;
    }
    return [];
  };

  // Determine checkbox state for a subtree
  const getNodeSelectionState = (testsInNode) => {
    const indices = testsInNode.map((t) => t.index);
    const selectedCount = indices.filter((idx) =>
      selectedIndices.includes(idx),
    ).length;
    if (selectedCount === 0) return "unchecked";
    if (selectedCount === indices.length) return "checked";
    return "partial";
  };

  // Bulk select/deselect a subtree branch
  const handleToggleSubtree = (testsInNode, currentState) => {
    const indices = testsInNode.map((t) => t.index);
    if (currentState === "checked") {
      setSelectedIndices(
        selectedIndices.filter((idx) => !indices.includes(idx)),
      );
    } else {
      setSelectedIndices(Array.from(new Set([...selectedIndices, ...indices])));
    }
  };

  const toggleNode = (nodeKey) => {
    const next = new Set(expandedNodes);
    if (next.has(nodeKey)) {
      next.delete(nodeKey);
    } else {
      next.add(nodeKey);
    }
    setExpandedNodes(next);
  };

  const filteredTests = tests.filter((t) => {
    const q = (searchQuery || "").toLowerCase();
    const title = (t.title ?? "").toLowerCase();
    const categoryId = (t.categoryId ?? "").toLowerCase();
    const subcategory = (t.subcategory ?? "").toLowerCase();
    const pyqYear = t.pyqYear ? String(t.pyqYear) : "";
    return (
      title.includes(q) ||
      categoryId.includes(q) ||
      subcategory.includes(q) ||
      pyqYear.includes(q)
    );
  });

  const hierarchyTree = buildHierarchy(filteredTests);

  const handleClose = () => {
    setFile(null);
    setTests([]);
    setSchemaValidation(null);
    setSelectedIndices([]);
    setImportResult(null);
    setPreviewTest(null);
    onClose();
  };

  // Render tree nodes recursively with dynamic indentation and custom badges
  const renderNode = (node, depth = 0) => {
    if (node.type === "test") {
      const test = node.test;
      const isTestSelected = selectedIndices.includes(test.index);
      const testState = isTestSelected ? "checked" : "unchecked";

      return (
        <div
          key={node.key}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          className="flex items-center justify-between gap-4 py-1.5 px-3 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10 rounded-lg text-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <CustomCheckbox
              state={testState}
              onChange={() => handleToggleSelect(test.index)}
            />
            <span
              className="font-medium text-gray-700 dark:text-gray-300 truncate"
              title={test.title}
            >
              {test.title}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-gray-400 text-[10px]">
              {test.questionsCount} Qs
            </span>
            <button
              type="button"
              onClick={() => handlePreviewTest(test.index)}
              className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-400 font-bold rounded transition-colors"
            >
              Preview
            </button>
          </div>
        </div>
      );
    }

    // Folder node
    const isExpanded = expandedNodes.has(node.key);
    const nodeState = getNodeSelectionState(node.tests);

    // Icon and badge styling based on nodeType
    let icon = isExpanded ? (
      <FolderOpen className="w-4 h-4 text-indigo-500 shrink-0" />
    ) : (
      <Folder className="w-4 h-4 text-indigo-500 shrink-0" />
    );
    let badgeColor =
      "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    let typeLabel = "Folder";

    switch (node.nodeType) {
      case "examGroup":
        badgeColor =
          "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400";
        typeLabel = "Group";
        break;
      case "exam":
        badgeColor =
          "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400";
        typeLabel = "Exam";
        break;
      case "series":
        badgeColor =
          "bg-teal-50 text-teal-700 dark:bg-teal-950/20 dark:text-teal-400";
        typeLabel = "Series";
        break;
      case "stage":
        badgeColor =
          "bg-sky-50 text-sky-700 dark:bg-sky-950/20 dark:text-sky-400";
        typeLabel = "Stage";
        break;
      case "subcategory":
        badgeColor =
          "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400";
        typeLabel = `Subcat L${node.level}`;
        break;
    }

    return (
      <div key={node.key} className="space-y-1">
        <div
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          onClick={() => toggleNode(node.key)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleNode(node.key);
            }
          }}
          style={{ paddingLeft: `${depth * 16}px` }}
          className="flex items-center gap-2 py-1.5 px-3 hover:bg-gray-100/70 dark:hover:bg-gray-800/20 rounded-lg cursor-pointer select-none font-semibold text-gray-800 dark:text-gray-200 text-xs"
        >
          <span className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors">
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </span>
          <CustomCheckbox
            state={nodeState}
            onChange={() => handleToggleSubtree(node.tests, nodeState)}
          />
          {icon}
          <span
            className={`uppercase text-[9px] tracking-wider px-1.5 py-0.5 rounded font-bold mr-1 ${badgeColor}`}
          >
            {typeLabel}
          </span>
          <span className="capitalize">{node.name.replace(/[-_]/g, " ")}</span>
          <span className="text-[10px] text-gray-400 font-normal">
            ({node.tests.length} tests)
          </span>
        </div>

        {isExpanded && (
          <div className="space-y-1">
            {Object.keys(node.children)
              .sort()
              .map((key) => renderNode(node.children[key], depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Renders the Test Options (Test Edit UI equivalent)
  const renderTestDetails = (test) => {
    return (
      <div className="p-6 space-y-5 max-h-none md:max-h-[50vh] overflow-visible md:overflow-y-auto bg-gray-50 dark:bg-gray-950">
        {/* Basic Info */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Basic Metadata
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-gray-400 block mb-1">Title</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {test.title || "--"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">Short Title</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {test.shortTitle || "--"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">Slug</span>
              <span className="font-semibold text-gray-900 dark:text-white font-mono">
                {test.slug || "--"}
              </span>
            </div>
            <div className="md:col-span-3 border-t border-gray-100 dark:border-gray-800 pt-3">
              <span className="text-gray-400 block mb-1">Description</span>
              <span className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {test.description || "No description provided."}
              </span>
            </div>
          </div>
        </div>

        {/* Scoring & Configurations */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Scoring & Timing Options
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
            <div>
              <span className="text-gray-400 block mb-1">Duration</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {test.duration || 60} mins
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">Total Questions</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {test.totalQuestions || 0} Qs
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">Total Marks</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {test.totalMarks || 0} Marks
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">Negative Marking</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                -{test.negativeMarking || 0}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">Passing Marks</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {test.passingMarks || 0} Marks
              </span>
            </div>
          </div>
        </div>

        {/* UI Features */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Test Player UI Flags
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-gray-400 block mb-1">Show Calculator</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${test.showCalculator ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}
              >
                {test.showCalculator ? "YES" : "NO"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">Show Timer</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${test.showTimer !== false ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}
              >
                {test.showTimer !== false ? "YES" : "NO"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">Allow Bookmarks</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${test.allowBookmark !== false ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}
              >
                {test.allowBookmark !== false ? "YES" : "NO"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">
                Shuffle Questions
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${test.shuffleQuestions ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}
              >
                {test.shuffleQuestions ? "YES" : "NO"}
              </span>
            </div>
          </div>
        </div>

        {/* Proctoring & Security */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Proctoring & Security
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-gray-400 block mb-1">
                Proctoring Enabled
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${test.proctoringEnabled ? "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}
              >
                {test.proctoringEnabled ? "YES" : "NO"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">
                Camera Monitoring
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${test.cameraMonitoring ? "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}
              >
                {test.cameraMonitoring ? "YES" : "NO"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">Tab Switch Limit</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {test.tabSwitchLimit || "No Limit"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">
                Copy/Paste Disabled
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${test.copyPasteDisabled ? "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}
              >
                {test.copyPasteDisabled ? "YES" : "NO"}
              </span>
            </div>
          </div>
        </div>

        {/* Adaptive & Additional Features */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Adaptive & Additional Features
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-gray-400 block mb-1">Adaptive Mode</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {test.adaptiveTest
                  ? test.adaptiveAlgorithm || "Enabled"
                  : "Disabled"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">
                Leaderboard Enabled
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${test.leaderboardEnabled !== false ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}
              >
                {test.leaderboardEnabled !== false ? "YES" : "NO"}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">
                Certificate Enabled
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold inline-block ${test.certificateEnabled ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}
              >
                {test.certificateEnabled ? "YES" : "NO"}
              </span>
            </div>
          </div>
        </div>

        {/* Section Configurations */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            Section Configurations
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-xs text-left">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 font-bold uppercase">
                <tr>
                  <th className="px-4 py-2">Section Name</th>
                  <th className="px-4 py-2">Subject ID</th>
                  <th className="px-4 py-2 text-center">Questions</th>
                  <th className="px-4 py-2 text-center">Marks per Q</th>
                  <th className="px-4 py-2 text-center">Negative Mark</th>
                  <th className="px-4 py-2 text-center">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                {test.sections?.map((sec, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                  >
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">
                      {sec.name}
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      {sec.subjectId || "--"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {sec.questions?.length || 0}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      +{sec.positiveMarks || 2}
                    </td>
                    <td className="px-4 py-2.5 text-center text-red-600">
                      -{sec.negativeMarks || 0.5}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {sec.duration
                        ? `${Math.round(sec.duration / 60)} mins (${sec.duration} sec)`
                        : "No Limit"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const modalContent = (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !importing) handleClose();
      }}
      className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fade-in"
    >
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-5xl overflow-hidden max-h-[94vh] sm:max-h-[90vh] flex flex-col shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0 bg-gray-50/75 dark:bg-gray-800/75">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center shrink-0">
              <FileJson className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                {step === 1 && "Upload Full Test JSON"}
                {step === 2 && "Select Tests to Import"}
                {step === 3 && `Preview: ${previewTest?.title || "Loading..."}`}
                {step === 4 && "Import Progress & Summary"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {step === 1 &&
                  "Upload a single test or a bulk file containing multiple tests"}
                {step === 2 &&
                  `Found ${tests.length} tests in file. Select which ones to import.`}
                {step === 3 &&
                  "Review sections and questions before committing"}
                {step === 4 && "Importing selected papers into database"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={importing}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tab switcher for Step 3 Preview */}
        {step === 3 && previewTest && (
          <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-2 flex gap-4 shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActivePreviewTab("details")}
              className={`pb-2 pt-1 text-xs font-bold border-b-2 transition-all focus:outline-none whitespace-nowrap ${
                activePreviewTab === "details"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              📝 Test Details & Settings
            </button>
            <button
              type="button"
              onClick={() => setActivePreviewTab("questions")}
              className={`pb-2 pt-1 text-xs font-bold border-b-2 transition-all focus:outline-none whitespace-nowrap ${
                activePreviewTab === "questions"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              ❓ Sections & Questions (
              {(previewTest.sections || []).reduce(
                (sum, s) => sum + (s.questions || []).length,
                0,
              )}{" "}
              Qs)
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto flex-1 bg-white dark:bg-gray-900 min-h-0">
          {/* STEP 1: UPLOAD & VALIDATE */}
          {step === 1 && (
            <div className="space-y-6">
              {/* File input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select JSON File
                </label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center hover:border-indigo-500 dark:hover:border-indigo-400 transition-all cursor-pointer bg-gray-50/50 dark:bg-gray-800/20">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                    id="full-test-file-input"
                  />
                  <label
                    htmlFor="full-test-file-input"
                    className="cursor-pointer block"
                  >
                    <FileJson className="w-12 h-12 text-indigo-500 dark:text-indigo-400 mx-auto mb-3" />
                    {file ? (
                      <div>
                        <p className="text-base text-gray-800 dark:text-gray-200 font-semibold truncate max-w-md mx-auto">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Click or drag to select a JSON file
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Accepts full test JSON (single test object or array of
                          tests)
                        </p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Storage mode toggle */}
              <div className="flex items-start gap-3 p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl">
                <FileJson className="w-5 h-5 text-blue-600 dark:text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <label className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                    Storage Mode
                  </label>
                  <p className="text-xs text-blue-700/80 dark:text-blue-300 mt-1 mb-3 leading-relaxed">
                    Choose where to store test content. JSON file mode saves
                    question content to the filesystem (saves DB space on
                    Supabase free plan).
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setStorageMode("database")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                        storageMode === "database"
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 hover:border-blue-400"
                      }`}
                    >
                      Upload to DB
                    </button>
                    <button
                      type="button"
                      onClick={() => setStorageMode("json-file")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                        storageMode === "json-file"
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 hover:border-blue-400"
                      }`}
                    >
                      Save as JSON file
                    </button>
                  </div>
                </div>
              </div>

              {/* Expected structure hint */}
              <details className="bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-800 rounded-xl">
                <summary className="px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 cursor-pointer select-none hover:bg-gray-100/50 dark:hover:bg-gray-800 transition-colors rounded-xl">
                  Expected JSON format details
                </summary>
                <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <pre className="text-[11px] text-gray-500 dark:text-gray-400 overflow-x-auto bg-gray-900 p-3 rounded-lg leading-relaxed">{`[
  {
    "id": "ssc-cgl-2025-paper-1",
    "title": "SSC CGL 2025 Tier 1 - 01 Dec 2022 - Shift 1",
    "examCategoryId": "ssc", "examId": "ssc-cgl", "stageId": "tier-1-pre",
    "testSeriesId": "ssc-cgl-2026", "categoryId": "2025",
    "duration": 60, "totalQuestions": 100, "totalMarks": 200,
    "sections": [
      {
        "name": "General Intelligence", "subjectId": "reasoning",
        "questions": [
          {
            "id": "q-1", "question": "What is 2 + 2?",
            "options": ["3", "4", "5", "6"], "correctAnswer": 2,
            "solution": "2 + 2 is equal to 4."
          }
        ]
      }
    ]
  }
]`}</pre>
                </div>
              </details>
            </div>
          )}

          {/* STEP 2: SELECT TESTS (SPLIT SCREEN: HIERARCHY LEFT, ALERTS RIGHT) */}
          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 h-auto md:h-[55vh]">
              {/* Left Side: Collapsible Hierarchy Tree (3 cols) */}
              <div className="md:col-span-3 flex flex-col h-auto md:h-full overflow-visible md:overflow-hidden space-y-3 pr-2">
                {/* Search & Selection Count */}
                <div className="flex gap-3 items-center justify-between shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by title, subcategory..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 w-full border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 rounded-lg shrink-0">
                    Selected: {selectedIndices.length} / {tests.length}
                  </div>
                </div>

                {/* Tree scrollable container */}
                <div className="flex-1 border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-white dark:bg-gray-900 overflow-y-auto space-y-2">
                  {Object.keys(hierarchyTree.children || {}).length === 0 ? (
                    <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-xs font-medium">
                      No tests match your search query.
                    </div>
                  ) : (
                    Object.keys(hierarchyTree.children)
                      .sort()
                      .map((key) => renderNode(hierarchyTree.children[key], 0))
                  )}
                </div>
              </div>

              {/* Right Side: Schema Validation Alerts & Settings (2 cols) */}
              <div className="md:col-span-2 flex flex-col h-auto md:h-full overflow-visible md:overflow-y-auto border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-800 pt-4 md:pt-0 md:pl-6 space-y-4">
                <div className="shrink-0 border-b border-gray-100 dark:border-gray-800 pb-2">
                  <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Schema Validation Status
                  </h3>
                </div>

                {schemaValidation ? (
                  <div className="space-y-4">
                    {/* Missing Core Fields Alert */}
                    {schemaValidation.missingFields?.test?.length > 0 ? (
                      <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl space-y-2.5">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4.5 h-4.5 text-red-600 dark:text-red-500 shrink-0" />
                          <h4 className="text-xs font-bold text-red-800 dark:text-red-300">
                            Missing Core Fields
                          </h4>
                        </div>
                        <p className="text-[11px] text-red-700 dark:text-red-400 leading-relaxed">
                          The following expected fields are missing. The
                          importer will use default fallbacks:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {schemaValidation.missingFields.test.map((f, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 text-[10px] font-semibold rounded"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-xl flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-500 shrink-0" />
                        <p className="text-[11px] font-semibold text-green-800 dark:text-green-300">
                          All core test fields are present.
                        </p>
                      </div>
                    )}

                    {/* Extra Fields Alert */}
                    {schemaValidation.extraFields?.test?.length > 0 ? (
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Info className="w-4.5 h-4.5 text-blue-600 dark:text-blue-500 shrink-0" />
                          <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300">
                            Extra Fields Ignored
                          </h4>
                        </div>
                        <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
                          These fields are in the JSON but not in the database.
                          They will be ignored:
                        </p>
                        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                          {schemaValidation.extraFields.test.map((f, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-[9px] font-medium rounded"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-xl flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-600 dark:text-blue-500 shrink-0" />
                        <p className="text-[11px] font-semibold text-blue-800 dark:text-blue-300">
                          No extra fields detected in the JSON structure.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400 text-xs">
                    No schema data loaded.
                  </div>
                )}

                {/* Settings Block */}
                <div className="bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3 mt-auto">
                  <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Import Settings
                  </h4>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="strict-import-toggle"
                      checked={strict}
                      onChange={(e) => setStrict(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mt-0.5 cursor-pointer"
                    />
                    <label
                      htmlFor="strict-import-toggle"
                      className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                    >
                      Enable Strict Taxonomy matching
                    </label>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    If checked, the import will fail if any referenced exam,
                    stage, test series, or subject does not already exist in the
                    database.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: DETAILED TEST & QUESTION PREVIEW PANEL */}
          {step === 3 && (
            <div className="h-auto md:h-[55vh] flex flex-col -m-6 bg-gray-50 dark:bg-gray-950 animate-fade-in">
              {loadingPreview ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                    Loading test structure...
                  </p>
                </div>
              ) : previewTest ? (
                activePreviewTab === "details" ? (
                  // TAB 1: Test Details & Settings
                  renderTestDetails(previewTest)
                ) : (
                  // TAB 2: Sections & Questions
                  <div className="flex-1 flex flex-col md:flex-row overflow-visible md:overflow-hidden min-h-0">
                    {/* Left sidebar - Sections */}
                    <div className="w-full md:w-56 bg-white dark:bg-gray-900 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 p-4 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto shrink-0">
                      <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 hidden md:block">
                        Sections
                      </h4>
                      {(previewTest.sections || []).map((sec, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => setActivePreviewSectionIndex(sIdx)}
                          className={`w-auto md:w-full px-3 py-2.5 text-left text-xs font-semibold rounded-xl flex items-center justify-between gap-3 shrink-0 md:shrink transition-all ${
                            activePreviewSectionIndex === sIdx
                              ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                          }`}
                        >
                          <span className="truncate pr-2">
                            {sec.name || `Section ${sIdx + 1}`}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                              activePreviewSectionIndex === sIdx
                                ? "bg-indigo-700 text-white"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            {(sec.questions || []).length}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Right side - Questions list */}
                    <div className="flex-1 p-4 md:p-6 space-y-6 overflow-visible md:overflow-y-auto">
                      <div className="border-b border-gray-200 dark:border-gray-800 pb-3 mb-4 flex justify-between items-center bg-transparent">
                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                          {previewTest.sections?.[activePreviewSectionIndex]
                            ?.name || "Questions"}
                        </h4>
                        <span className="text-xs text-gray-500">
                          Showing{" "}
                          {
                            (
                              previewTest.sections?.[activePreviewSectionIndex]
                                ?.questions || []
                            ).length
                          }{" "}
                          questions
                        </span>
                      </div>

                      {(
                        previewTest.sections?.[activePreviewSectionIndex]
                          ?.questions || []
                      ).map((q, qIdx) => {
                        const qTextEn = q.text?.en || q.question || "";
                        const qTextHi =
                          q.text?.hi || q.text?.hn || q.question_text_hi || "";

                        const qOptionsEn =
                          q.options_bilingual?.en || q.options || [];
                        const qOptionsHi =
                          q.options_bilingual?.hi ||
                          q.options_bilingual?.hn ||
                          [];

                        const qExpEn =
                          q.solution_bilingual?.en ||
                          q.solution ||
                          q.explanation ||
                          "";
                        const qExpHi =
                          q.solution_bilingual?.hi ||
                          q.solution_bilingual?.hn ||
                          "";

                        // correctAnswer is 1-indexed in JSON. Convert to 0-indexed for UI.
                        const correctIdx =
                          typeof q.correctAnswer === "number"
                            ? q.correctAnswer - 1
                            : typeof q.correct_option_id === "number"
                              ? q.correct_option_id
                              : -1;

                        return (
                          <div
                            key={q.id || qIdx}
                            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4 font-sans"
                          >
                            <div className="flex justify-between items-start gap-4">
                              <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 text-xs font-bold rounded-full shrink-0">
                                Q {qIdx + 1}
                              </span>
                              <div className="flex gap-2 text-xs text-gray-500">
                                <span>Marks: {q.marks || 2}</span>
                                <span>•</span>
                                <span className="capitalize">
                                  {q.difficulty || "medium"}
                                </span>
                              </div>
                            </div>

                            {/* Question Text */}
                            <div className="space-y-2">
                              {qTextEn && (
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: sanitizeHtml(qTextEn),
                                  }}
                                  className="text-sm text-gray-800 dark:text-gray-200 font-medium leading-relaxed"
                                />
                              )}
                              {qTextHi && (
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: sanitizeHtml(qTextHi),
                                  }}
                                  className="text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed border-t border-dashed border-gray-200 dark:border-gray-800 pt-2"
                                />
                              )}
                            </div>

                            {/* Options */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                              {qOptionsEn.map((opt, optIdx) => {
                                const isCorrect = optIdx === correctIdx;
                                return (
                                  <div
                                    key={optIdx}
                                    className={`p-3 rounded-lg border text-xs font-medium flex items-center justify-between gap-3 ${
                                      isCorrect
                                        ? "bg-green-50 dark:bg-green-950/20 border-green-500 text-green-900 dark:text-green-300"
                                        : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300"
                                    }`}
                                  >
                                    <div>
                                      <span className="font-bold mr-2">
                                        {String.fromCharCode(65 + optIdx)}.
                                      </span>
                                      <div
                                        dangerouslySetInnerHTML={{
                                          __html: sanitizeHtml(opt),
                                        }}
                                        className="inline-block"
                                      />
                                      {qOptionsHi[optIdx] && (
                                        <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 border-t border-dashed border-gray-100 dark:border-gray-800/60 pt-1">
                                          <div
                                            dangerouslySetInnerHTML={{
                                              __html: sanitizeHtml(
                                                qOptionsHi[optIdx],
                                              ),
                                            }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                    {isCorrect && (
                                      <Check className="w-4 h-4 text-green-600 dark:text-green-500 shrink-0" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Explanation */}
                            {(qExpEn || qExpHi) && (
                              <div className="mt-4 p-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg text-xs leading-relaxed">
                                <span className="font-bold text-gray-800 dark:text-gray-200 block mb-1">
                                  Explanation:
                                </span>
                                {qExpEn && (
                                  <div
                                    dangerouslySetInnerHTML={{
                                      __html: sanitizeHtml(qExpEn),
                                    }}
                                    className="text-gray-600 dark:text-gray-400"
                                  />
                                )}
                                {qExpHi && (
                                  <div
                                    dangerouslySetInnerHTML={{
                                      __html: sanitizeHtml(qExpHi),
                                    }}
                                    className="text-gray-500 mt-2 border-t border-dashed border-gray-200 dark:border-gray-800 pt-2"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  No preview available.
                </div>
              )}
            </div>
          )}

          {/* STEP 4: IMPORT PROGRESS & RESULTS */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              {importing ? (
                <div className="flex flex-col items-center justify-center p-12 gap-5 text-center">
                  <Loader2 className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-spin" />

                  <div className="w-full max-w-md space-y-2">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      Importing: {importProgress.current} /{" "}
                      {importProgress.total} (
                      {Math.round(
                        (importProgress.current / importProgress.total) * 100,
                      )}
                      %)
                    </h3>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-xs mx-auto">
                      {importProgress.currentTitle}
                    </p>

                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${(importProgress.current / importProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">
                    Please do not close this window or navigate away while the
                    import is in progress.
                  </p>
                </div>
              ) : importResult ? (
                <div className="space-y-6">
                  {importResult.failed?.length === 0 ? (
                    <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/30 rounded-xl">
                      <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-500 shrink-0" />
                      <div>
                        <h3 className="text-base font-bold text-green-900 dark:text-green-300">
                          Import Completed Successfully
                        </h3>
                        <p className="text-xs text-green-700 dark:text-green-400/90 mt-0.5">
                          Processed{" "}
                          {importResult.imported?.length +
                            importResult.failed?.length}{" "}
                          tests.
                        </p>
                      </div>
                    </div>
                  ) : importResult.imported?.length === 0 ? (
                    <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/30 rounded-xl">
                      <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500 shrink-0" />
                      <div>
                        <h3 className="text-base font-bold text-red-900 dark:text-red-300">
                          Import Failed — No Tests Imported
                        </h3>
                        <p className="text-xs text-red-700 dark:text-red-400/90 mt-0.5">
                          All {importResult.failed?.length} selected test(s)
                          failed. See errors below.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 rounded-xl">
                      <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-500 shrink-0" />
                      <div>
                        <h3 className="text-base font-bold text-amber-900 dark:text-amber-300">
                          Import Partially Completed
                        </h3>
                        <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-0.5">
                          {importResult.imported?.length} test(s) imported,{" "}
                          {importResult.failed?.length} test(s) failed.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Success list */}
                    <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
                      <div className="px-4 py-2.5 bg-green-50/50 dark:bg-green-950/20 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                        <span className="text-xs font-bold text-green-800 dark:text-green-400">
                          Succeeded ({importResult.imported?.length || 0})
                        </span>
                      </div>
                      <div className="p-4 max-h-48 overflow-y-auto space-y-2.5">
                        {importResult.imported?.length === 0 ? (
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            None
                          </p>
                        ) : (
                          importResult.imported.map((item, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-xs"
                            >
                              <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                              <div>
                                <p className="font-semibold text-gray-800 dark:text-gray-200">
                                  {item.testTitle}
                                </p>
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  Imported {item.questionsCreated} questions in{" "}
                                  {item.sectionsCreated} sections
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Failure list */}
                    <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
                      <div className="px-4 py-2.5 bg-red-50/50 dark:bg-red-950/20 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                        <span className="text-xs font-bold text-red-800 dark:text-red-400">
                          Failed ({importResult.failed?.length || 0})
                        </span>
                      </div>
                      <div className="p-4 max-h-48 overflow-y-auto space-y-2.5">
                        {importResult.failed?.length === 0 ? (
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            None
                          </p>
                        ) : (
                          importResult.failed.map((item, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-xs"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                              <div>
                                <p className="font-semibold text-gray-800 dark:text-gray-200">
                                  {item.testTitle || `Test #${item.index}`}
                                </p>
                                <p className="text-[10px] text-red-500 mt-0.5 font-medium">
                                  {item.error}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col-reverse sm:flex-row sm:justify-between gap-2 sm:gap-3 shrink-0 bg-gray-50/90 dark:bg-gray-800/90">
          <div>
            {step === 3 && (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs sm:text-sm font-semibold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to List
              </button>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={uploading || importing}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors text-center"
            >
              {step === 4 && !importing ? "Close" : "Cancel"}
            </button>

            {step === 1 && (
              <button
                type="button"
                onClick={handleUploadAndValidate}
                disabled={!file || uploading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-xs sm:text-sm font-semibold shadow-md shadow-indigo-100 dark:shadow-none transition-all text-center"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload & Validate
                  </>
                )}
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleImportSelected}
                disabled={selectedIndices.length === 0 || importing}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-xs sm:text-sm font-semibold shadow-md shadow-indigo-100 dark:shadow-none transition-all text-center"
              >
                <CheckCircle className="w-4 h-4" />
                Import Selected ({selectedIndices.length})
                {storageMode === "json-file" ? " → JSON" : ""}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default FullTestImportModal;
