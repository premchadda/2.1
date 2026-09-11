import React from "react";
import { createPortal } from "react-dom";
import { Activity, X } from "lucide-react";
import UserActivityLog from "../../users-enrollments/UserActivityLog";

export default function ActivityLogModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              Activity Log
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Monitor user actions and system events
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <UserActivityLog />
        </div>
      </div>
    </div>,
    document.body,
  );
}
