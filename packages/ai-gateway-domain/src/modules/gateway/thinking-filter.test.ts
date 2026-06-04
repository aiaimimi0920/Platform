import { describe, it, expect } from "vitest";
import {
  createThinkingFilterState,
  processThinkingChunk,
  finalizeThinkingFilter,
  extractThinkingContent,
} from "./thinking-filter";

describe("Thinking Filter", () => {
  describe("Basic filtering", () => {
    it("should filter out complete thinking blocks", () => {
      const state = createThinkingFilterState();

      const chunk1 = "Hello <thinking>internal thoughts</thinking> world";
      const output1 = processThinkingChunk(state, chunk1);

      expect(output1).toBe("Hello  world");
      expect(extractThinkingContent(state)).toBe("internal thoughts");
    });

    it("should handle thinking blocks with double newline", () => {
      const state = createThinkingFilterState();

      const chunk = "Text <thinking>thoughts</thinking>\n\nMore text";
      const output = processThinkingChunk(state, chunk);

      expect(output).toBe("Text More text");
    });

    it("should pass through text without thinking tags", () => {
      const state = createThinkingFilterState();

      const chunk = "Just normal text here";
      const output = processThinkingChunk(state, chunk);

      expect(output).toBe("Just normal text here");
    });
  });

  describe("Streaming scenarios", () => {
    it("should handle thinking block split across chunks", () => {
      const state = createThinkingFilterState();

      const chunk1 = "Start <think";
      const output1 = processThinkingChunk(state, chunk1);
      expect(output1).toBe("Start ");

      const chunk2 = "ing>internal";
      const output2 = processThinkingChunk(state, chunk2);
      expect(output2).toBe("");

      const chunk3 = " thoughts</thinking>\n\n";
      const output3 = processThinkingChunk(state, chunk3);
      expect(output3).toBe("");

      const chunk4 = "After";
      const output4 = processThinkingChunk(state, chunk4);
      expect(output4).toBe("After");

      expect(extractThinkingContent(state)).toBe("internal thoughts");
    });

    it("should handle end tag split across chunks", () => {
      const state = createThinkingFilterState();

      processThinkingChunk(state, "<thinking>thoughts</think");
      processThinkingChunk(state, "ing>\n\nAfter");

      const final = finalizeThinkingFilter(state);
      expect(final).toBe("After");
    });
  });

  describe("Quoted tag handling", () => {
    it("should not filter thinking tags in backticks", () => {
      const state = createThinkingFilterState();

      const chunk = "Use `<thinking>` and `</thinking>` tags";
      const output = processThinkingChunk(state, chunk);

      expect(output).toBe("Use `<thinking>` and `</thinking>` tags");
    });

    it("should not filter thinking tags in quotes", () => {
      const state = createThinkingFilterState();

      const chunk = 'The "</thinking>" tag ends the block';
      const output = processThinkingChunk(state, chunk);

      expect(output).toBe('The "</thinking>" tag ends the block');
    });

    it("should filter real tags but not quoted ones", () => {
      const state = createThinkingFilterState();

      const chunk = 'Before <thinking>real thoughts about "</thinking>" tag</thinking>\n\nAfter';
      const output = processThinkingChunk(state, chunk);

      expect(output).toBe("Before After");
      expect(extractThinkingContent(state)).toContain('"</thinking>" tag');
    });
  });

  describe("Boundary events", () => {
    it("should handle thinking end at buffer end (no double newline)", () => {
      const state = createThinkingFilterState();

      const chunk = "<thinking>thoughts</thinking>";
      const output = processThinkingChunk(state, chunk);

      expect(output).toBe("");
      expect(extractThinkingContent(state)).toBe("thoughts");
    });

    it("should handle thinking end with only whitespace after", () => {
      const state = createThinkingFilterState();

      const chunk = "<thinking>thoughts</thinking>  \n  ";
      const output = processThinkingChunk(state, chunk);

      expect(output).toBe("");
      expect(extractThinkingContent(state)).toBe("thoughts");
    });
  });

  describe("Multiple thinking blocks", () => {
    it("should handle multiple thinking blocks in sequence", () => {
      const state = createThinkingFilterState();

      const chunk = "A <thinking>first</thinking>\n\nB <thinking>second</thinking>\n\nC";
      const output = processThinkingChunk(state, chunk);

      expect(output).toBe("A B C");
    });

    it("should accumulate content from multiple blocks", () => {
      const state = createThinkingFilterState();

      processThinkingChunk(state, "<thinking>first</thinking>\n\n");
      const content1 = extractThinkingContent(state);

      processThinkingChunk(state, "<thinking>second</thinking>\n\n");
      const content2 = extractThinkingContent(state);

      // Only the most recent thinking content is kept
      expect(content2).toBe("second");
    });
  });

  describe("Incomplete blocks", () => {
    it("should preserve incomplete thinking block on finalize", () => {
      const state = createThinkingFilterState();

      processThinkingChunk(state, "Start <thinking>incomplete thoughts");
      const final = finalizeThinkingFilter(state);

      expect(final).toBe("<thinking>incomplete thoughts");
    });

    it("should handle missing start tag", () => {
      const state = createThinkingFilterState();

      const chunk = "Just text without tags";
      const output = processThinkingChunk(state, chunk);

      expect(output).toBe("Just text without tags");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty chunks", () => {
      const state = createThinkingFilterState();

      const output = processThinkingChunk(state, "");

      expect(output).toBe("");
    });

    it("should handle nested angle brackets", () => {
      const state = createThinkingFilterState();

      const chunk = "<thinking>thoughts with <nested> tags</thinking>\n\nAfter";
      const output = processThinkingChunk(state, chunk);

      expect(output).toBe("After");
      expect(extractThinkingContent(state)).toBe("thoughts with <nested> tags");
    });

    it("should handle thinking tags mentioned in thinking content", () => {
      const state = createThinkingFilterState();

      const chunk = '<thinking>I should use `</thinking>` to end</thinking>\n\nDone';
      const output = processThinkingChunk(state, chunk);

      expect(output).toBe("Done");
      expect(extractThinkingContent(state)).toContain("`</thinking>`");
    });

    it("should handle multiple quoted end tags before real one", () => {
      const state = createThinkingFilterState();

      const chunk = '<thinking>About "</thinking>" and `</thinking>` tags</thinking>\n\nAfter';
      const output = processThinkingChunk(state, chunk);

      expect(output).toBe("After");
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle Claude thinking pattern", () => {
      const state = createThinkingFilterState();

      const chunks = [
        "<thinking>\n",
        "Let me analyze this problem...\n",
        "I need to consider:\n",
        "1. The user's request\n",
        "2. The code structure\n",
        "</thinking>\n\n",
        "Here's my response:",
      ];

      let output = "";
      for (const chunk of chunks) {
        output += processThinkingChunk(state, chunk);
      }

      expect(output).toBe("Here's my response:");
      expect(extractThinkingContent(state)).toContain("analyze this problem");
    });

    it("should handle thinking followed by tool use", () => {
      const state = createThinkingFilterState();

      const chunk = "<thinking>I'll use the read tool</thinking>  \n<tool_use>";
      const output = processThinkingChunk(state, chunk);

      expect(output).toBe("<tool_use>");
    });
  });
});
