import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

export default function TestResult() {
  const { attemptId } = useParams();
  return (
    <div className="min-h-screen p-4 md:p-6">
      <Helmet><title>Test Result | TrstPrep</title></Helmet>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Test Result</h1>
      <p className="text-gray-600 dark:text-gray-400 mt-2">Result view is being restored. Attempt: {attemptId || "—"}</p>
      <Link to="/dashboard" className="text-indigo-600 underline mt-4 inline-block">Back to Dashboard</Link>
    </div>
  );
}
