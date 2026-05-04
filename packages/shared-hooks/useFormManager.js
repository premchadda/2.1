import { useState, useCallback, useMemo } from 'react';

/**
 * Form Manager Hook
 * Eliminates form handling duplication across 25+ manager components
 *
 * @param {Object} initialData - Initial form data
 * @param {Object} validationRules - Validation rules object
 * @returns {Object} Form state and handlers
 */
export const useFormManager = (initialData = {}, validationRules = {}) => {
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form field
  const updateField = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  }, [errors]);

  // Handle input change
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;
    updateField(name, fieldValue);
  }, [updateField]);

  // Handle field blur (mark as touched)
  const handleBlur = useCallback((field) => {
    setTouched(prev => ({
      ...prev,
      [field]: true
    }));

    // Validate field on blur
    if (validationRules[field]) {
      const error = validateField(field, formData[field]);
      setErrors(prev => ({
        ...prev,
        [field]: error
      }));
    }
  }, [formData, validationRules]);

  // Validate single field
  const validateField = useCallback((field, value) => {
    const rules = validationRules[field];
    if (!rules) return null;

    if (rules.required && (!value || value.toString().trim() === '')) {
      return rules.requiredMessage || `${field} is required`;
    }

    if (rules.minLength && value && value.length < rules.minLength) {
      return `Minimum ${rules.minLength} characters required`;
    }

    if (rules.maxLength && value && value.length > rules.maxLength) {
      return `Maximum ${rules.maxLength} characters allowed`;
    }

    if (rules.pattern && value && !rules.pattern.test(value)) {
      return rules.patternMessage || 'Invalid format';
    }

    if (rules.custom && typeof rules.custom === 'function') {
      return rules.custom(value, formData);
    }

    return null;
  }, [formData, validationRules]);

  // Validate all fields
  const validateForm = useCallback(() => {
    const newErrors = {};
    let isValid = true;

    Object.keys(validationRules).forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [formData, validationRules, validateField]);

  // Reset form
  const resetForm = useCallback(() => {
    setFormData(initialData);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialData]);

  // Populate form with data (for editing)
  const populateForm = useCallback((data) => {
    setFormData({ ...initialData, ...data });
    setErrors({});
    setTouched({});
  }, [initialData]);

  // Submit handler wrapper
  const handleSubmit = useCallback(async (submitFn) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const isValid = validateForm();
      if (!isValid) {
        setIsSubmitting(false);
        return false;
      }

      const result = await submitFn(formData);
      if (result !== false) {
        resetForm();
      }
      return result;
    } catch (error) {
      console.error('Form submission error:', error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, resetForm, isSubmitting]);

  // Computed values
  const isValid = useMemo(() => {
    return Object.keys(validationRules).every(field => !errors[field]);
  }, [errors, validationRules]);

  const hasErrors = useMemo(() => {
    return Object.keys(errors).some(field => errors[field]);
  }, [errors]);

  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialData);
  }, [formData, initialData]);

  return {
    // State
    formData,
    errors,
    touched,
    isSubmitting,
    isValid,
    hasErrors,
    isDirty,

    // Actions
    updateField,
    handleChange,
    handleBlur,
    validateForm,
    resetForm,
    populateForm,
    handleSubmit,
    setFormData,
    setErrors
  };
};