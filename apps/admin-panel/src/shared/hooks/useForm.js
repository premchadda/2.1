import { useState, useCallback } from 'react'

/**
 * useForm — declarative form state + Zod validation hook.
 *
 * @param {Object} options
 * @param {Object} options.initialValues
 * @param {import('zod').ZodSchema} [options.schema] — optional Zod schema
 * @param {Function} [options.onSubmit] — called with validated values
 */
export function useForm({ initialValues = {}, schema, onSubmit } = {}) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState({})

  const setValue = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }))
    // Clear error for the field on change
    setErrors(prev => ({ ...prev, [name]: undefined }))
  }, [])

  const setValuesBatch = useCallback((patch) => {
    setValues(prev => ({ ...prev, ...patch }))
  }, [])

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target
    setValue(name, type === 'checkbox' ? checked : value)
  }, [setValue])

  const handleBlur = useCallback((e) => {
    const { name } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))

    // Single-field validation if schema provided
    if (schema) {
      const fieldSchema = schema.shape?.[name]
      if (fieldSchema) {
        const result = fieldSchema.safeParse(values[name])
        if (!result.success) {
          const fieldError = result.error.errors[0]?.message
          setErrors(prev => ({ ...prev, [name]: fieldError }))
        } else {
          setErrors(prev => ({ ...prev, [name]: undefined }))
        }
      }
    }
  }, [schema, values])

  const resetForm = useCallback((newValues) => {
    setValues(newValues || initialValues)
    setErrors({})
    setTouched({})
    setSubmitting(false)
  }, [initialValues])

  const validate = useCallback(() => {
    if (!schema) return true
    const result = schema.safeParse(values)
    if (!result.success) {
      const fieldErrors = {}
      for (const issue of result.error.errors) {
        const path = issue.path.join('.')
        fieldErrors[path] = issue.message
      }
      setErrors(fieldErrors)
      setTouched(Object.keys(values).reduce((acc, k) => ({ ...acc, [k]: true }), {}))
      return false
    }
    setErrors({})
    return true
  }, [schema, values])

  const handleSubmit = useCallback(async (e) => {
    if (e?.preventDefault) e.preventDefault()
    if (!validate()) return
    if (!onSubmit) return

    setSubmitting(true)
    try {
      await onSubmit(values)
    } finally {
      setSubmitting(false)
    }
  }, [validate, onSubmit, values])

  return {
    values,
    errors,
    submitting,
    touched,
    setValue,
    setValues: setValuesBatch,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    validate,
  }
}
