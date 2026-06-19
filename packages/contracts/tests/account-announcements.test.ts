import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { bootstrapAccountAnnouncements } from "../src/account-announcements";

describe("bootstrapAccountAnnouncements", () => {
  it("keeps every seed announcement structurally publishable", () => {
    assert(bootstrapAccountAnnouncements.length > 0);

    for (const announcement of bootstrapAccountAnnouncements) {
      assert.match(announcement.id, /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
      assert.doesNotThrow(() => new Date(announcement.publishedAt).toISOString(), announcement.id);
      assert(announcement.eyebrow.trim().length > 0, announcement.id);
      assert(announcement.railTitle.trim().length > 0, announcement.id);
      assert(announcement.summary.trim().length > 0, announcement.id);
      assert(announcement.title.trim().length > 0, announcement.id);
      assert(announcement.sections.length > 0, announcement.id);

      for (const section of announcement.sections) {
        assert(section.title.trim().length > 0, announcement.id);
        assert(
          (section.paragraphs?.some((paragraph) => paragraph.trim().length > 0) ?? false) ||
            (section.bullets?.some((bullet) => bullet.trim().length > 0) ?? false),
          `${announcement.id}:${section.title}`,
        );
      }
    }
  });

  it("does not reintroduce legacy layout test announcements", () => {
    const serialized = JSON.stringify(bootstrapAccountAnnouncements);
    const forbiddenFragments = [
      "scroll-test",
      "滚动测试",
      "长公告测试",
      "测试公告",
      "模拟更新详情",
      "二十字标题测试",
    ];

    for (const fragment of forbiddenFragments) {
      assert(!serialized.includes(fragment), fragment);
    }
  });
});
