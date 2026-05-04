import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function YearComparison({ data = [] }) {
  const [expandedYear, setExpandedYear] = useState(null)
  const displayData = data

  if (!displayData || displayData.length === 0) {
    return null
  }

  const getMax = (key) => Math.max(...displayData.map(d => d[key]))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-900 mb-6">Year-by-Year Comparison</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Year</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Vacancy</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Applied</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Selected</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Cutoff</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayData.map((row, idx) => (
              <>
                <tr 
                  key={idx} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedYear(expandedYear === idx ? null : idx)}
                >
                  <td className="py-3 px-4 font-medium text-gray-900 flex items-center gap-2">
                    {expandedYear === idx ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                    {row.year}
                  </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-gray-900">{row.vacancy?.toLocaleString()}</span>
                    <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full" 
                        style={{ width: `${(row.vacancy / getMax('vacancy')) * 100}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-gray-900">{row.applied?.toLocaleString()}</span>
                    <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full" 
                        style={{ width: `${(row.applied / getMax('applied')) * 100}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-green-600 font-medium">{row.selected?.toLocaleString()}</span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-sm font-medium">
                    {row.cutoff || 'N/A'}
                  </span>
                </td>
              </tr>
              {expandedYear === idx && (
                <tr key={`${idx}-expanded`} className="bg-gray-50">
                  <td colSpan={5} className="py-3 px-4">
                    <div className="flex items-center justify-around text-sm text-gray-600">
                      <div className="text-center">
                        <span className="block text-xs text-gray-400">Application Rate</span>
                        <span className="font-semibold text-indigo-600">
                          {row.applied && row.vacancy ? ((row.applied / row.vacancy) * 100).toFixed(1) + '%' : 'N/A'}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="block text-xs text-gray-400">Selection Rate</span>
                        <span className="font-semibold text-green-600">
                          {row.selected && row.applied ? ((row.selected / row.applied) * 100).toFixed(1) + '%' : 'N/A'}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="block text-xs text-gray-400">Vacancies/Selected</span>
                        <span className="font-semibold text-gray-900">
                          {row.vacancy && row.selected ? (row.vacancy / row.selected).toFixed(1) + 'x' : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
