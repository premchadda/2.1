import { Link } from 'react-router-dom'
import { ChevronRight, ChevronDown, Plus, Crown } from 'lucide-react'
import { useState } from 'react'
import { isSeriesEnrolled } from '../../lib/enrollment.js'
import { getCategoryEmoji } from '../../../assets/config/emoji.js'
import Card from '../ui/Card.jsx'
import Badge from '../ui/Badge.jsx'
import ProgressRing from '../ui/ProgressRing.jsx'

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
      return <Link to={`/test-series/${seriesId}`} className="w-full py-1.5 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1 bg-gradient-to-r from-brand-start to-brand-end">{showProgress ? 'Continue' : 'View'}</Link>;
    }
    if (requiresPro && !hasProPass) {
      return <Link to="/pass" className="w-full py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1"><Crown className="w-3 h-3" />Get Pro</Link>;
    }
    if ((hasFreeTests || hasProPass) && user) {
      return <button onClick={handleEnrollClick} className="w-full py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1"><Plus className="w-3 h-3" />Add</button>;
    }
    return <Link to={`/test-series/${seriesId}`} className="w-full py-1.5 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1 bg-gradient-to-r from-brand-start to-brand-end">View</Link>;
  };

  return (
    <div className="test-series-card flex-shrink-0 w-[280px]">
      <Card variant="default" padding="p-0" hover className="h-full overflow-hidden group">
        <Link to={`/test-series/${seriesId}`} className="block p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xl">{getCategoryEmoji(categoryName || category)}</div>
            <div className="flex items-center gap-2">
              {isComingSoon && <Badge variant="warning" size="xs">COMING SOON</Badge>}
              {requiresPro && <Badge variant="pro" size="xs" className="flex items-center gap-1"><Crown className="w-3 h-3" />PRO</Badge>}
              <span className="text-xs text-gray-500 dark:text-gray-400">👥 {formatUserCount(users)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 mb-2 text-[10px] text-gray-500 dark:text-gray-400 flex-wrap">
            {categoryName && <Badge variant="primary" size="xs">{categoryName}</Badge>}
            {examName && <><ChevronRight className="w-2.5 h-2.5" /><Badge variant="primary" size="xs">{examName}</Badge></>}
            {(stageNames || stageName) && <><ChevronRight className="w-2.5 h-2.5" /><Badge variant="success" size="xs">{(stageNames || [stageName]).join(', ')}</Badge></>}
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
        <div className="px-3 pb-3 flex items-center gap-2">
          {showProgress && progressPercentage > 0 && <ProgressRing percentage={progressPercentage} size={28} strokeWidth={3}><span className="text-[8px] font-bold">{progressPercentage}%</span></ProgressRing>}
          <div className="flex-1">{renderActionButton()}</div>
        </div>
      </Card>
    </div>
  );
}

export default TestSeriesCard
