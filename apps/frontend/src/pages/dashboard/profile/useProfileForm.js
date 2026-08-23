import { useState, useRef, useCallback } from "react";
import { toast } from "react-hot-toast";
import { userAPI } from "../../../shared/lib/dataService";

export function useProfileForm({ user, refreshUser, setPersonalInfo }) {
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    dateOfBirth: "",
    location: "",
    education: "",
    bio: "",
  });
  const [editErrors, setEditErrors] = useState({});
  const [editSuccess, setEditSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const editTimerRef = useRef(null);

  const syncFromUser = useCallback((source) => {
    if (!source) return;
    setEditForm({
      name: source.name || "",
      phone: source.phone || source.mobile || "",
      dateOfBirth: source.dateOfBirth || source.date_of_birth || "",
      location: source.location || "",
      education: source.education || "",
      bio: source.bio || "",
    });
  }, []);

  const handleEditChange = useCallback((field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
    setEditErrors((prev) => {
      if (prev[field]) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return prev;
    });
  }, []);

  const validateEditForm = useCallback(() => {
    const errors = {};
    if (!editForm.name || editForm.name.trim().length < 2)
      errors.name = "Name must be at least 2 characters";
    if (editForm.phone && !/^[6-9]\d{9}$/.test(editForm.phone))
      errors.phone = "Please enter a valid Indian phone number";
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }, [editForm]);

  const handleSaveProfile = useCallback(async () => {
    if (!validateEditForm()) return false;
    try {
      setSaving(true);
      setEditSuccess(false);
      const response = await userAPI.updateProfile({
        name: editForm.name.trim(),
        mobile: editForm.phone?.trim() || "",
        dateOfBirth: editForm.dateOfBirth?.trim() || "",
        location: editForm.location?.trim() || "",
        education: editForm.education?.trim() || "",
        bio: editForm.bio?.trim() || "",
      });
      if (response.data?.success) {
        if (setPersonalInfo) {
          setPersonalInfo({
            fullName: editForm.name,
            email: user?.email || "",
            phone: editForm.phone,
            dateOfBirth: editForm.dateOfBirth,
            location: editForm.location,
            education: editForm.education,
            bio: editForm.bio,
          });
        }
        if (refreshUser) await refreshUser();
        setEditSuccess(true);
        if (editTimerRef.current) clearTimeout(editTimerRef.current);
        editTimerRef.current = setTimeout(() => {
          setIsEditing(false);
          setEditSuccess(false);
        }, 1500);
        return true;
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error("Failed to update profile.");
    } finally {
      setSaving(false);
    }
    return false;
  }, [editForm, validateEditForm, user, refreshUser, setPersonalInfo]);

  return {
    editForm,
    setEditForm,
    editErrors,
    setEditErrors,
    editSuccess,
    saving,
    isEditing,
    setIsEditing,
    editTimerRef,
    syncFromUser,
    handleEditChange,
    validateEditForm,
    handleSaveProfile,
  };
}

export default useProfileForm;
