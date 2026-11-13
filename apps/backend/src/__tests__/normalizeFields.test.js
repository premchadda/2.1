import { describe, it, expect } from "@jest/globals";
import {
  normalizeRequestBody,
  normalizeFields,
} from "../middleware/normalize-fields.js";

describe("normalizeFields & normalizeRequestBody", () => {
  it("preserves both camelCase and snake_case for known admin fields", () => {
    const input = {
      parentCategoryId: 42,
      stageIds: [1, 2, 3],
      smtpHost: "smtp.example.com",
      smtpPassword: "secretPassword",
      planId: "pro_yearly",
      buttonText: "Subscribe Now",
      isActive: true,
      originalPrice: 1999,
    };

    const normalized = normalizeRequestBody(input);

    // Canonical snake_case keys must exist
    expect(normalized.parent_category_id).toBe(42);
    expect(normalized.stage_ids).toEqual([1, 2, 3]);
    expect(normalized.smtp_host).toBe("smtp.example.com");
    expect(normalized.smtp_password).toBe("secretPassword");
    expect(normalized.plan_id).toBe("pro_yearly");
    expect(normalized.button_text).toBe("Subscribe Now");
    expect(normalized.is_active).toBe(true);
    expect(normalized.original_price).toBe(1999);

    // Dual-aliased camelCase keys must ALSO exist to avoid starving handlers
    expect(normalized.parentCategoryId).toBe(42);
    expect(normalized.stageIds).toEqual([1, 2, 3]);
    expect(normalized.smtpHost).toBe("smtp.example.com");
    expect(normalized.smtpPassword).toBe("secretPassword");
    expect(normalized.planId).toBe("pro_yearly");
    expect(normalized.buttonText).toBe("Subscribe Now");
    expect(normalized.isActive).toBe(true);
    expect(normalized.originalPrice).toBe(1999);
  });

  it("handles incoming snake_case and creates camelCase aliases", () => {
    const input = {
      parent_category_id: 10,
      stage_ids: [4, 5],
      button_text: "Join",
    };

    const normalized = normalizeRequestBody(input);

    expect(normalized.parent_category_id).toBe(10);
    expect(normalized.stage_ids).toEqual([4, 5]);
    expect(normalized.button_text).toBe("Join");

    expect(normalized.parentCategoryId).toBe(10);
    expect(normalized.stageIds).toEqual([4, 5]);
    expect(normalized.buttonText).toBe("Join");
  });

  it("normalizes nested objects and arrays recursively with dual-aliasing", () => {
    const input = {
      testData: {
        stageIds: [100],
        configItem: "value",
      },
      listItems: [
        { itemId: 1, itemLabel: "First" },
        { itemId: 2, itemLabel: "Second" },
      ],
    };

    const normalized = normalizeRequestBody(input);

    expect(normalized.test_data.stage_ids).toEqual([100]);
    expect(normalized.test_data.stageIds).toEqual([100]);
    expect(normalized.testData.stage_ids).toEqual([100]);
    expect(normalized.testData.stageIds).toEqual([100]);

    expect(normalized.list_items[0].item_id).toBe(1);
    expect(normalized.list_items[0].itemId).toBe(1);
    expect(normalized.listItems[1].item_label).toBe("Second");
    expect(normalized.listItems[1].itemLabel).toBe("Second");
  });

  it("middleware normalizes req.body for POST, PUT, PATCH", () => {
    const middleware = normalizeFields();
    const req = {
      method: "POST",
      body: {
        parentCategoryId: 99,
      },
    };
    const res = {};
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    middleware(req, res, next);

    expect(nextCalled).toBe(true);
    expect(req.body.parent_category_id).toBe(99);
    expect(req.body.parentCategoryId).toBe(99);
  });
});
