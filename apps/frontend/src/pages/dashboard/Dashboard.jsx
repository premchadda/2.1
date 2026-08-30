import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../shared/providers/AuthContext";

/** Temporary build-unblock; full Dashboard restore follows in next commit */
export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen p-4 md:p-6">
      <Helmet><title>Dashboard | TrstPrep</title></Helmet>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      <p className="text-gray-600 dark:text-gray-400 mt-2">Full dashboard is being restored. Please refresh in a few minutes.</p>
      <p className="text-sm mt-4 text-gray-500">Signed in as: {user?.name || user?.email || "User"}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/tests" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Browse Tests</Link>
        <Link to="/test-series" className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium">Test Series</Link>
      </div>
    </div>
  );
}
