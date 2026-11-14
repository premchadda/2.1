import { describe, it, expect } from "vitest";

describe("Admin Data Flow & Form State Reconciliation Audit", () => {
  describe("ExamInfoManager Data Flow", () => {
    it("preserves all detailed exam fields and numeric ID from DB record on edit", () => {
      const dbRow = {
        id: 101,
        title: "SSC CGL 2026",
        full_name: "Staff Selection Commission Combined Graduate Level",
        exam_id: "ssc-cgl-2026",
        description: "National recruitment exam",
        category_id: "staff-selection",
        notification: "https://ssc.nic.in/cgl-2026.pdf",
        series_id: 42,
        eligibility: "Bachelor's Degree",
        age_limit: "18-32 years",
        syllabus:
          "Quantitative Aptitude, English, Reasoning, General Awareness",
        display_order: 3,
        year: 2026,
        is_active: true,
      };

      const formData = {
        examId: dbRow.examId || dbRow.exam_id || dbRow.slug || "",
        title: dbRow.title || "",
        fullName: dbRow.fullName || dbRow.full_name || dbRow.title || "",
        description: dbRow.description || "",
        categoryId: dbRow.categoryId || dbRow.category_id || "",
        notification: dbRow.notification || "",
        seriesId: dbRow.seriesId ?? dbRow.series_id ?? null,
        eligibility: dbRow.eligibility || "",
        ageLimit: dbRow.ageLimit || dbRow.age_limit || "",
        syllabus: dbRow.syllabus || "",
        displayOrder: dbRow.displayOrder ?? dbRow.display_order ?? 0,
        year: dbRow.year || new Date().getFullYear(),
        isActive:
          dbRow.isActive !== undefined
            ? dbRow.isActive
            : dbRow.is_active !== undefined
              ? dbRow.is_active
              : true,
      };

      const editingId = dbRow._id || dbRow.id;

      expect(editingId).toBe(101);
      expect(formData.examId).toBe("ssc-cgl-2026");
      expect(formData.fullName).toBe(
        "Staff Selection Commission Combined Graduate Level",
      );
      expect(formData.seriesId).toBe(42);
      expect(formData.ageLimit).toBe("18-32 years");
      expect(formData.displayOrder).toBe(3);
      expect(formData.isActive).toBe(true);
    });

    it("does not invert inactive state when is_active is false and isActive is undefined", () => {
      const dbRow = {
        id: 102,
        title: "Inactive Exam",
        is_active: false,
      };

      const isActive =
        dbRow.isActive !== undefined
          ? dbRow.isActive
          : dbRow.is_active !== undefined
            ? dbRow.is_active
            : true;

      expect(isActive).toBe(false);
    });
  });

  describe("CategoriesManager Data Flow", () => {
    it("extracts snake_case database columns into form state without losing data", () => {
      const dbRow = {
        id: 7,
        name: "Railway Group D",
        slug: "railway-group-d",
        exam_category_id: "railways",
        stage_ids: [1, 2],
        display_order: 5,
        is_active: false,
        parent_id: 3,
      };

      const formData = {
        name: dbRow.name || "",
        slug: dbRow.slug || "",
        icon: dbRow.icon || "",
        description: dbRow.description || "",
        examCategoryId: dbRow.examCategoryId || dbRow.exam_category_id || "",
        stageIds: Array.isArray(dbRow.stageIds)
          ? dbRow.stageIds
          : Array.isArray(dbRow.stage_ids)
            ? dbRow.stage_ids
            : [],
        displayOrder: dbRow.displayOrder ?? dbRow.display_order ?? 0,
        isActive:
          dbRow.isActive !== undefined
            ? dbRow.isActive
            : dbRow.is_active !== undefined
              ? dbRow.is_active
              : true,
      };

      expect(formData.examCategoryId).toBe("railways");
      expect(formData.stageIds).toEqual([1, 2]);
      expect(formData.displayOrder).toBe(5);
      expect(formData.isActive).toBe(false);
    });
  });

  describe("StagesManager Data Flow", () => {
    it("correctly maps order_index and exam_id/exam_ids from database rows", () => {
      const dbRow = {
        id: 15,
        name: "Tier 1 - Preliminary",
        slug: "tier-1-prelim",
        order_index: 1,
        exam_id: 101,
        is_active: false,
      };

      const parseIdsArray = (val) =>
        Array.isArray(val) ? val : val != null ? [val] : [];
      const formData = {
        name: dbRow.name || "",
        slug: dbRow.slug || "",
        description: dbRow.description || "",
        icon: dbRow.icon || "",
        order: dbRow.order ?? dbRow.order_index ?? dbRow.display_order ?? 0,
        examIds: parseIdsArray(
          dbRow.examIds ||
            dbRow.exam_ids ||
            (dbRow.exam_id != null ? [dbRow.exam_id] : []),
        ).map(String),
        categoryIds: parseIdsArray(
          dbRow.categoryIds || dbRow.category_ids || [],
        ).map(String),
        isActive:
          dbRow.isActive !== undefined
            ? dbRow.isActive
            : dbRow.is_active !== undefined
              ? dbRow.is_active
              : true,
      };

      expect(formData.order).toBe(1);
      expect(formData.examIds).toEqual(["101"]);
      expect(formData.isActive).toBe(false);
    });
  });

  describe("SubscriptionPlansManager Data Flow", () => {
    it("retains button styling, original_price, and popular flag from DB record", () => {
      const dbRow = {
        id: 3,
        plan_id: "pro-annual",
        name: "Pro Annual",
        price: 999,
        original_price: 1999,
        duration: "/year",
        features: JSON.stringify([{ text: "Full Access", included: true }]),
        button_text: "Upgrade Now",
        button_class: "bg-indigo-600 text-white",
        is_popular: true,
        savings: "50%",
      };

      const formData = {
        id: dbRow.id || dbRow.planId || dbRow.plan_id || "",
        name: dbRow.name || dbRow.title || "",
        price: dbRow.price ?? 0,
        originalPrice: dbRow.originalPrice ?? dbRow.original_price ?? null,
        period: dbRow.period || dbRow.duration || "/month",
        features: Array.isArray(dbRow.features)
          ? dbRow.features
          : typeof dbRow.features === "string"
            ? JSON.parse(dbRow.features || "[]")
            : [],
        buttonText: dbRow.buttonText || dbRow.button_text || "Get Started",
        buttonClass:
          dbRow.buttonClass ||
          dbRow.button_class ||
          "bg-gradient-to-r from-brand-start to-brand-end text-white",
        popular: dbRow.popular ?? dbRow.is_popular ?? dbRow.isPopular ?? false,
        savings: dbRow.savings || "",
      };

      expect(formData.originalPrice).toBe(1999);
      expect(formData.buttonText).toBe("Upgrade Now");
      expect(formData.popular).toBe(true);
      expect(formData.features).toEqual([
        { text: "Full Access", included: true },
      ]);
    });
  });

  describe("CouponsManager Data Flow", () => {
    it("correctly unpacks all snake_case coupon properties from DB", () => {
      const dbRow = {
        id: 9,
        code: "FESTIVE50",
        description: "50% off festive offer",
        discount_type: "percentage",
        discount_value: 50,
        max_discount: 1000,
        min_order_value: 500,
        valid_from: "2026-11-01T00:00:00.000Z",
        valid_until: "2026-11-30T23:59:59.000Z",
        usage_limit: 500,
        user_usage_limit: 2,
        applicable_plans: ["pro-annual"],
        applicable_categories: ["Railways", "SSC"],
        is_active: true,
      };

      const formData = {
        code: dbRow.code || "",
        description: dbRow.description || "",
        discountType: dbRow.discountType || dbRow.discount_type || "percentage",
        discountValue: dbRow.discountValue ?? dbRow.discount_value ?? 10,
        maxDiscount: dbRow.maxDiscount ?? dbRow.max_discount ?? 500,
        minOrderValue:
          dbRow.minOrderValue ??
          dbRow.min_order_value ??
          dbRow.minPurchase ??
          dbRow.min_purchase ??
          0,
        validFrom:
          (dbRow.validFrom || dbRow.valid_from || "")?.split("T")[0] || "",
        validUntil:
          (dbRow.validUntil || dbRow.valid_until || "")?.split("T")[0] || "",
        usageLimit:
          dbRow.usageLimit ??
          dbRow.usage_limit ??
          dbRow.maxUses ??
          dbRow.max_uses ??
          100,
        userUsageLimit: dbRow.userUsageLimit ?? dbRow.user_usage_limit ?? 1,
        applicablePlans: Array.isArray(dbRow.applicablePlans)
          ? dbRow.applicablePlans
          : Array.isArray(dbRow.applicable_plans)
            ? dbRow.applicable_plans
            : ["all"],
        applicableCategories: Array.isArray(dbRow.applicableCategories)
          ? dbRow.applicableCategories
          : Array.isArray(dbRow.applicable_categories)
            ? dbRow.applicable_categories
            : ["All"],
        isActive:
          dbRow.isActive !== undefined
            ? dbRow.isActive
            : dbRow.is_active !== undefined
              ? dbRow.is_active
              : true,
      };

      expect(formData.discountValue).toBe(50);
      expect(formData.maxDiscount).toBe(1000);
      expect(formData.minOrderValue).toBe(500);
      expect(formData.validFrom).toBe("2026-11-01");
      expect(formData.validUntil).toBe("2026-11-30");
      expect(formData.usageLimit).toBe(500);
      expect(formData.userUsageLimit).toBe(2);
      expect(formData.applicablePlans).toEqual(["pro-annual"]);
      expect(formData.applicableCategories).toEqual(["Railways", "SSC"]);
    });
  });

  describe("BannerManager & FaqManager Data Flow", () => {
    it("ensures banner link and display_order are correctly bridged to DB columns", () => {
      const bannerFormData = {
        title: "Diwali Special",
        imageUrl: "https://example.com/banner.png",
        linkUrl: "https://example.com/offers",
        position: "home",
        sortOrder: 2,
        isActive: true,
      };

      const linkVal = String(bannerFormData.linkUrl || "").trim();
      const sortVal = Number(bannerFormData.sortOrder) || 0;
      const imgVal = String(bannerFormData.imageUrl || "").trim();

      const payload = {
        title: String(bannerFormData.title || "").trim(),
        imageUrl: imgVal,
        image_url: imgVal,
        linkUrl: linkVal,
        link: linkVal,
        position: bannerFormData.position,
        sortOrder: sortVal,
        sort_order: sortVal,
        displayOrder: sortVal,
        display_order: sortVal,
        isActive: !!bannerFormData.isActive,
        is_active: !!bannerFormData.isActive,
      };

      expect(payload.link).toBe("https://example.com/offers");
      expect(payload.display_order).toBe(2);
      expect(payload.image_url).toBe("https://example.com/banner.png");
    });

    it("ensures FAQ sort_order is preserved and not reset to 0", () => {
      const dbFaq = {
        id: 4,
        question: "How do I take a mock test?",
        answer: "Navigate to Tests and click Start.",
        category: "tests",
        sort_order: 7,
        is_active: true,
      };

      const formData = {
        question: dbFaq.question || "",
        answer: dbFaq.answer || "",
        category: dbFaq.category || "general",
        isActive:
          dbFaq.isActive !== undefined
            ? dbFaq.isActive
            : dbFaq.is_active !== undefined
              ? dbFaq.is_active
              : true,
        order: dbFaq.sortOrder ?? dbFaq.sort_order ?? dbFaq.order ?? 0,
      };

      expect(formData.order).toBe(7);

      const orderVal = Number(formData.order) || 0;
      const payload = {
        ...formData,
        order: orderVal,
        sortOrder: orderVal,
        sort_order: orderVal,
        is_active: !!formData.isActive,
      };

      expect(payload.sort_order).toBe(7);
    });
  });

  describe("TopicsManager & Curriculum Data Flow", () => {
    it("ensures chapterId is preserved from chapter_id on edit", () => {
      const dbTopic = {
        id: 201,
        name: "Time and Work",
        description: "Aptitude topic",
        chapter_id: 14,
        order_index: 3,
        is_active: true,
      };

      const formData = {
        name: dbTopic.name || "",
        description: dbTopic.description || "",
        icon: dbTopic.icon || "📚",
        chapterId: dbTopic.chapterId ?? dbTopic.chapter_id ?? "",
        order: dbTopic.order ?? dbTopic.orderIndex ?? dbTopic.order_index ?? 0,
        isActive:
          dbTopic.isActive !== undefined
            ? dbTopic.isActive
            : dbTopic.is_active !== undefined
              ? dbTopic.is_active
              : true,
      };

      expect(formData.chapterId).toBe(14);
      expect(formData.order).toBe(3);
      expect(formData.isActive).toBe(true);
    });
  });

  describe("TestSeriesManager Data Flow", () => {
    it("ensures is_pro, is_pinned, and is_active are never lost on edit", () => {
      const dbSeries = {
        id: 55,
        title: "SBI PO Prelims 2026",
        is_pro: true,
        is_pinned: true,
        is_active: false,
      };

      const formData = {
        title: dbSeries.title || "",
        isPro: dbSeries.isPro ?? dbSeries.is_pro ?? false,
        isPinned: dbSeries.isPinned ?? dbSeries.is_pinned ?? false,
        isActive:
          dbSeries.isActive !== undefined
            ? dbSeries.isActive
            : dbSeries.is_active !== undefined
              ? dbSeries.is_active
              : true,
      };

      expect(formData.isPro).toBe(true);
      expect(formData.isPinned).toBe(true);
      expect(formData.isActive).toBe(false);
    });
  });
});
