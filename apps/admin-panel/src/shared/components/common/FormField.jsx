import { useId } from 'react'

const inputBaseClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition'

const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
const errorClass = 'text-xs text-red-600 mt-1'
const helpClass = 'text-xs text-gray-500 mt-1'

export const FormInput = ({
  id,
  label,
  error,
  helpText,
  required = false,
  className = '',
  wrapperClassName = '',
  ...props
}) => {
  const autoId = useId()
  const fieldId = id || autoId
  const describedBy = [error ? `${fieldId}-error` : '', helpText && !error ? `${fieldId}-help` : ''].filter(Boolean).join(' ') || undefined

  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={fieldId} className={labelClass}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        id={fieldId}
        aria-describedby={describedBy}
        className={`${inputBaseClass} ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p id={`${fieldId}-error`} className={errorClass}>{error}</p>}
      {helpText && !error && <p id={`${fieldId}-help`} className={helpClass}>{helpText}</p>}
    </div>
  )
}

export const FormTextarea = ({
  id,
  label,
  error,
  helpText,
  required = false,
  rows = 3,
  className = '',
  wrapperClassName = '',
  ...props
}) => {
  const autoId = useId()
  const fieldId = id || autoId
  const describedBy = [error ? `${fieldId}-error` : '', helpText && !error ? `${fieldId}-help` : ''].filter(Boolean).join(' ') || undefined

  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={fieldId} className={labelClass}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        id={fieldId}
        rows={rows}
        aria-describedby={describedBy}
        className={`${inputBaseClass} resize-y ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p id={`${fieldId}-error`} className={errorClass}>{error}</p>}
      {helpText && !error && <p id={`${fieldId}-help`} className={helpClass}>{helpText}</p>}
    </div>
  )
}

export const FormSelect = ({
  id,
  label,
  error,
  helpText,
  required = false,
  options = [],
  placeholder = 'Select...',
  className = '',
  wrapperClassName = '',
  ...props
}) => {
  const autoId = useId()
  const fieldId = id || autoId
  const describedBy = [error ? `${fieldId}-error` : '', helpText && !error ? `${fieldId}-help` : ''].filter(Boolean).join(' ') || undefined

  const renderOptions = (opts, depth = 0) => {
    return opts.flatMap((opt) => {
      if (opt.group) {
        return [
          <optgroup key={opt.group} label={opt.group}>
            {renderOptions(opt.options, depth)}
          </optgroup>
        ]
      }
      return (
        <option
          key={opt.value}
          value={opt.value}
          disabled={opt.disabled}
          className={depth > 0 ? 'pl-4' : ''}
        >
          {depth > 0 ? `${'  '.repeat(depth)}${opt.label}` : opt.label}
        </option>
      )
    })
  }

  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={fieldId} className={labelClass}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        id={fieldId}
        aria-describedby={describedBy}
        className={`${inputBaseClass} ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {renderOptions(options)}
      </select>
      {error && <p id={`${fieldId}-error`} className={errorClass}>{error}</p>}
      {helpText && !error && <p id={`${fieldId}-help`} className={helpClass}>{helpText}</p>}
    </div>
  )
}

export const FormCheckbox = ({
  id,
  label,
  error,
  wrapperClassName = '',
  className = '',
  ...props
}) => {
  const autoId = useId()
  const fieldId = id || autoId
  const describedBy = error ? `${fieldId}-error` : undefined

  return (
    <div className={wrapperClassName}>
      <label htmlFor={fieldId} className="flex items-center gap-2 cursor-pointer">
        <input
          id={fieldId}
          type="checkbox"
          aria-describedby={describedBy}
          className={`w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 ${className}`}
          {...props}
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      </label>
      {error && <p id={`${fieldId}-error`} className={errorClass}>{error}</p>}
    </div>
  )
}

export const FormRadio = ({
  id,
  label,
  error,
  wrapperClassName = '',
  className = '',
  name,
  ...props
}) => {
  const autoId = useId()
  const fieldId = id || autoId
  const describedBy = error ? `${fieldId}-error` : undefined

  return (
    <div className={wrapperClassName}>
      <label htmlFor={fieldId} className="flex items-center gap-2 cursor-pointer">
        <input
          id={fieldId}
          type="radio"
          name={name}
          aria-describedby={describedBy}
          className={`w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500 ${className}`}
          {...props}
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      </label>
      {error && <p id={`${fieldId}-error`} className={errorClass}>{error}</p>}
    </div>
  )
}

export const FormSwitch = ({
  id,
  label,
  error,
  wrapperClassName = '',
  className = '',
  checked = false,
  onChange,
  ...props
}) => {
  const autoId = useId()
  const fieldId = id || autoId
  const describedBy = error ? `${fieldId}-error` : undefined

  return (
    <div className={wrapperClassName}>
      <label htmlFor={fieldId} className="flex items-center gap-3 cursor-pointer">
        <div className="relative">
          <input
            id={fieldId}
            type="checkbox"
            className="sr-only peer"
            checked={checked}
            onChange={onChange}
            aria-describedby={describedBy}
            {...props}
          />
          <div className={`w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-indigo-600 peer-focus:ring-2 peer-focus:ring-indigo-500 transition-colors ${className}`}></div>
          <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4"></div>
        </div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      </label>
      {error && <p id={`${fieldId}-error`} className={errorClass}>{error}</p>}
    </div>
  )
}

export const FormDatePicker = ({
  id,
  label,
  error,
  helpText,
  required = false,
  className = '',
  wrapperClassName = '',
  ...props
}) => {
  const autoId = useId()
  const fieldId = id || autoId
  const describedBy = [error ? `${fieldId}-error` : '', helpText && !error ? `${fieldId}-help` : ''].filter(Boolean).join(' ') || undefined

  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={fieldId} className={labelClass}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        id={fieldId}
        type="date"
        aria-describedby={describedBy}
        className={`${inputBaseClass} ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p id={`${fieldId}-error`} className={errorClass}>{error}</p>}
      {helpText && !error && <p id={`${fieldId}-help`} className={helpClass}>{helpText}</p>}
    </div>
  )
}

export const FormFileUpload = ({
  id,
  label,
  error,
  helpText,
  required = false,
  accept,
  className = '',
  wrapperClassName = '',
  onChange,
}) => {
  const autoId = useId()
  const fieldId = id || autoId
  const describedBy = [error ? `${fieldId}-error` : '', helpText && !error ? `${fieldId}-help` : ''].filter(Boolean).join(' ') || undefined

  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={fieldId} className={labelClass}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <label htmlFor={fieldId} className={`flex flex-col items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition ${className}`}>
        <input
          id={fieldId}
          type="file"
          accept={accept}
          className="hidden"
          aria-describedby={describedBy}
          onChange={onChange}
        />
        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3" />
        </svg>
        <span className="text-xs text-gray-500">Click or drag file to upload</span>
      </label>
      {error && <p id={`${fieldId}-error`} className={errorClass}>{error}</p>}
      {helpText && !error && <p id={`${fieldId}-help`} className={helpClass}>{helpText}</p>}
    </div>
  )
}

export const FormMultiSelect = ({
  id,
  label,
  error,
  helpText,
  required = false,
  options = [],
  placeholder = 'Select...',
  value = [],
  onChange,
  className = '',
  wrapperClassName = '',
}) => {
  const autoId = useId()
  const fieldId = id || autoId
  const describedBy = [error ? `${fieldId}-error` : '', helpText && !error ? `${fieldId}-help` : ''].filter(Boolean).join(' ') || undefined

  const handleChange = (e) => {
    const selected = Array.from(e.target.selectedOptions, (opt) => opt.value)
    onChange?.(selected)
  }

  return (
    <div className={wrapperClassName}>
      {label && (
        <label htmlFor={fieldId} className={labelClass}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        id={fieldId}
        multiple
        value={value}
        onChange={handleChange}
        aria-describedby={describedBy}
        className={`${inputBaseClass} h-32 ${error ? 'border-red-500 focus:ring-red-500' : ''} ${className}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p id={`${fieldId}-error`} className={errorClass}>{error}</p>}
      {helpText && !error && <p id={`${fieldId}-help`} className={helpClass}>{helpText}</p>}
    </div>
  )
}

export const FormGrid = ({ children, cols = 2, className = '' }) => {
  const colClasses = {
    2: 'grid grid-cols-1 sm:grid-cols-2 gap-4',
    3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
    4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
  }
  return <div className={`${colClasses[cols]} ${className}`}>{children}</div>
}

export const FormSection = ({ title, children, className = '' }) => (
  <div className={`pt-4 border-t border-gray-200 ${className}`}>
    {title && (
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{title}</h4>
    )}
    {children}
  </div>
)