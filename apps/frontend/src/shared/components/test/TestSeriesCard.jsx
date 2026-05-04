import { Link } from 'react-router-dom'
import { ChevronRight, ChevronDown, Plus, Crown, Lock } from 'lucide-react'
import { useState } from 'react'
import { isSeriesEnrolled } from '../../lib/enrollment.js'
import { getCategoryEmoji, getTestTypeEmoji } from '../../../assets/config/emoji.js'

function TestSeriesCard({ series, user, showProgress = false, onEnroll, showCategories = true }) {
  const {
    _id, id, slug, title, category, categoryName, examName, stageName, stageNames,
    totalTests, freeTests, users, isPro, isComingSoon,
    testTypes = [], attemptedTests = 0, testCounts = {}, languages = ['Eng', 'Hin']
  } = series;

  const seriesId = slug || id || _id;
  const enrolledSeries = user?.enrolledSeries || [];
  const isEnrolled = isSeriesEnrolled(enrolledSeries, series);
  const hasProPass = user?.hasProPass || false;
  const hasFreeTests = freeTests > 0;
  const requiresPro = isPro || (freeTests === 0 && totalTests > 0);

  const [expanded, setExpanded] = useState(false);
  const progressPercentage = showProgress && totalTests > 0 ? Math.round(((attemptedTests || 0) / totalTests) * 100) : 0;

  const formatUserCount = (count) => {
    if (typeof count === 'string') return count;
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count?.toString() || '0';
  };

  // Using centralized emoji config

  const isShortTitle = title?.length < 25;
  const categoriesToShow = isShortTitle ? 5 : 4;
  const mainCategories = (testTypes || []).slice(0, categoriesToShow);
  const extraCategories = (testTypes || []).slice(categoriesToShow);

  const handleEnrollClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onEnroll) onEnroll(series);
  };

  const handleExpandClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const renderActionButton = () => {
    if (isEnrolled) {
      return <Link to={`/test-series/${seriesId}`} className="w-full py-1.5 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>{showProgress ? 'Continue' : 'View'}</Link>;
    }
    if (requiresPro && !hasProPass) {
      return <Link to="/pass" className="w-full py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1"><Crown className="w-3 h-3" />Get Pro</Link>;
    }
    if ((hasFreeTests || hasProPass) && user) {
      return <button onClick={handleEnrollClick} className="w-full py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1"><Plus className="w-3 h-3" />Add</button>;
    }
    return <Link to={`/test-series/${seriesId}`} className="w-full py-1.5 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>View</Link>;
  };

  return (
    <div className="test-series-card flex-shrink-0 w-[280px]">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-start dark:hover:border-indigo-500 hover:shadow-lg transition-all duration-300 h-full">
        <Link to={`/test-series/${seriesId}`} className="block p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xl">{getCategoryEmoji(categoryName || category)}</div>
            <div className="flex items-center gap-2">
              {isComingSoon && <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">COMING SOON</span>}
              {requiresPro && <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1"><Crown className="w-3 h-3" />PRO</span>}
              <span className="text-xs text-gray-500 dark:text-gray-400">👥 {formatUserCount(users)}</span>
            </div>
          </div>
          {/* Hierarchy Display: Category > Exam > Stage > Test Series */}
          <div className="flex items-center gap-1 mb-2 text-[10px] text-gray-500 dark:text-gray-400 flex-wrap">
            {categoryName && (
              <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-medium">
                {categoryName}
              </span>
            )}
            {examName && (
              <>
                <ChevronRight className="w-2.5 h-2.5" />
                <span className="bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded font-medium">
                  {examName}
                </span>
              </>
            )}
            {stageNames && stageNames.length > 0 && (
              <>
                <ChevronRight className="w-2.5 h-2.5" />
                <span className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded font-medium">
                  {stageNames.join(', ')}
                </span>
              </>
            )}
            {stageName && !stageNames && (
              <>
                <ChevronRight className="w-2.5 h-2.5" />
                <span className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded font-medium">
                  {stageName}
                </span>
              </>
            )}
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-tight line-clamp-2 mb-2">{title}</h3>
          <div className="flex items-center justify-between text-xs border-t border-b border-gray-100 dark:border-gray-700 py-2 mb-2">
            <span className="font-semibold text-gray-900 dark:text-white">{totalTests || 0} Tests</span>
            <span className="text-green-600 dark:text-green-400 font-semibold">{freeTests || 0} Free</span>
            <span className="text-cyan-500 dark:text-cyan-400">{languages?.join(', ') || 'Eng, Hin'}</span>
          </div>
          {showCategories && mainCategories.length > 0 && (
            <div className="space-y-1">
              {mainCategories.slice(0, 4).map((type, i) => {
                const count = testCounts?.[type] ?? 0;
                return <div key={i} className="flex items-center justify-between text-xs py-1 px-2 bg-gray-50 dark:bg-gray-700/50 rounded"><span className="text-gray-700 dark:text-gray-300">{type}</span><span className="font-bold">{count > 0 ? count : '-'}</span></div>;
              })}
              {extraCategories.length > 0 && !expanded && <button type="button" onClick={handleExpandClick} className="text-[10px] text-brand-start dark:text-indigo-400 w-full text-left px-2">+{extraCategories.length} more</button>}
              {expanded && extraCategories.map((type, i) => { const count = testCounts?.[type] ?? 0; return <div key={i} className="flex items-center justify-between text-xs py-1 px-2 bg-gray-50 dark:bg-gray-700/50 rounded"><span className="text-gray-700 dark:text-gray-300">{type}</span><span className="font-bold">{count > 0 ? count : '-'}</span></div>; })}
              {expanded && <button type="button" onClick={handleExpandClick} className="text-[10px] text-brand-start dark:text-indigo-400 w-full text-left px-2">Show less</button>}
            </div>
          )}
        </Link>
        <div className="px-3 pb-3">{renderActionButton()}</div>
      </div>
    </div>
  );
}

export default TestSeriesCard
