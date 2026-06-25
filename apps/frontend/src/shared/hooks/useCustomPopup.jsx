import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, CheckCircle, XCircle, X } from 'lucide-react';

export default function useCustomPopup() {
  const [popupConfig, setPopupConfig] = useState({
    isOpen: false,
    type: 'alert', // 'alert' | 'confirm'
    message: '',
    title: '',
    onConfirm: null,
    onCancel: null,
  });

  const showAlert = useCallback((message, title = 'Alert') => {
    return new Promise((resolve) => {
      setPopupConfig({
        isOpen: true,
        type: 'alert',
        message,
        title,
        onConfirm: () => {
          setPopupConfig((prev) => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setPopupConfig((prev) => ({ ...prev, isOpen: false }));
          resolve(true);
        },
      });
    });
  }, []);

  const showConfirm = useCallback((message, title = 'Confirm Action') => {
    return new Promise((resolve) => {
      setPopupConfig({
        isOpen: true,
        type: 'confirm',
        message,
        title,
        onConfirm: () => {
          setPopupConfig((prev) => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setPopupConfig((prev) => ({ ...prev, isOpen: false }));
          resolve(false);
        },
      });
    });
  }, []);

  const PopupComponent = popupConfig.isOpen ? createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              popupConfig.type === 'confirm' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30'
            }`}>
              {popupConfig.type === 'confirm' ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
            </div>
            <div className="flex-1 pt-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{popupConfig.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{popupConfig.message}</p>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-700">
          {popupConfig.type === 'confirm' && (
            <button
              onClick={popupConfig.onCancel}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={popupConfig.onConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors shadow-sm ${
              popupConfig.type === 'confirm' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
            }`}
          >
            {popupConfig.type === 'confirm' ? 'Confirm' : 'OK'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return { showAlert, showConfirm, PopupComponent };
}
