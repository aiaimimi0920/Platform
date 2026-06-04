// ---------------------------------------------------------------------------
// Thinking Filter — intelligent filtering of <thinking> tags in streaming responses
// ---------------------------------------------------------------------------

/**
 * Characters that indicate a thinking tag is being quoted/referenced rather than used
 */
const QUOTE_CHARS = new Set([
  "`", // backtick (inline code)
  '"', // double quote
  "'", // single quote
  "\\", // backslash
  "#", // hash
  "!", // exclamation
  "@", // at
  "$", // dollar
  "%", // percent
  "^", // caret
  "&", // ampersand
  "*", // asterisk
  "(", // left paren
  ")", // right paren
  "-", // dash
  "_", // underscore
  "=", // equals
  "+", // plus
  "[", // left bracket
  "]", // right bracket
  "{", // left brace
  "}", // right brace
  ";", // semicolon
  ":", // colon
  "<", // less than (for nested tags)
  ">", // greater than (for nested tags)
  ",", // comma
  ".", // period
  "?", // question mark
  "/", // slash
]);

/**
 * Check if a character at a position is a quote character
 */
function isQuoteChar(text: string, pos: number): boolean {
  if (pos < 0 || pos >= text.length) {
    return false;
  }
  return QUOTE_CHARS.has(text[pos]);
}

/**
 * Find the next occurrence of a thinking tag (start or end)
 *
 * @param text - Text to search
 * @param startPos - Position to start searching from
 * @param tag - Tag to search for ("<thinking>" or "</thinking>")
 * @returns Position of the tag, or -1 if not found
 */
function findThinkingTag(text: string, startPos: number, tag: string): number {
  let searchPos = startPos;

  while (true) {
    const pos = text.indexOf(tag, searchPos);
    if (pos === -1) {
      return -1;
    }

    // Check if tag is quoted (has quote char before or after)
    const hasQuoteBefore = pos > 0 && isQuoteChar(text, pos - 1);
    const hasQuoteAfter = isQuoteChar(text, pos + tag.length);

    if (hasQuoteBefore || hasQuoteAfter) {
      // Tag is quoted, skip it
      searchPos = pos + 1;
      continue;
    }

    return pos;
  }
}

/**
 * Find the real thinking end tag (not quoted, followed by double newline or at buffer end)
 *
 * @param buffer - Text buffer to search
 * @returns Position of the real end tag, or -1 if not found
 */
function findRealThinkingEndTag(buffer: string): number {
  const tag = "</thinking>";
  let searchPos = 0;

  while (true) {
    const pos = findThinkingTag(buffer, searchPos, tag);
    if (pos === -1) {
      return -1;
    }

    const afterPos = pos + tag.length;
    const afterContent = buffer.slice(afterPos);

    // Real thinking end tag is followed by double newline
    if (afterContent.startsWith("\n\n")) {
      return pos;
    }

    // Continue searching
    searchPos = pos + 1;
  }
}

/**
 * Find the real thinking end tag at buffer end (allows only whitespace after tag)
 *
 * Used for "boundary events" where thinking ends immediately before tool_use or stream end.
 *
 * @param buffer - Text buffer to search
 * @returns Position of the real end tag at buffer end, or -1 if not found
 */
function findRealThinkingEndTagAtBufferEnd(buffer: string): number {
  const tag = "</thinking>";
  let searchPos = 0;

  while (true) {
    const pos = findThinkingTag(buffer, searchPos, tag);
    if (pos === -1) {
      return -1;
    }

    const afterPos = pos + tag.length;
    const afterContent = buffer.slice(afterPos);

    // Only whitespace after tag = real end tag at buffer end
    if (afterContent.trim() === "") {
      return pos;
    }

    // Continue searching
    searchPos = pos + 1;
  }
}

/**
 * Find the real thinking start tag (not quoted)
 *
 * @param buffer - Text buffer to search
 * @returns Position of the real start tag, or -1 if not found
 */
function findRealThinkingStartTag(buffer: string): number {
  return findThinkingTag(buffer, 0, "<thinking>");
}

/**
 * Find the nearest valid UTF-8 character boundary at or before target position
 *
 * UTF-8 characters can be 1-4 bytes. Cutting at an arbitrary byte position
 * can split a multi-byte character, causing errors.
 *
 * @param text - Text to search
 * @param target - Target position
 * @returns Nearest valid character boundary
 */
function findCharBoundary(text: string, target: number): number {
  if (target >= text.length) {
    return text.length;
  }
  if (target === 0) {
    return 0;
  }

  // Search backwards for valid character boundary
  let pos = target;
  while (pos > 0 && !text.substring(0, pos + 1).endsWith(text[pos])) {
    pos -= 1;
  }
  return pos;
}

/**
 * Thinking filter state
 */
export type ThinkingFilterState = {
  buffer: string; // Accumulated text buffer
  inThinking: boolean; // Currently inside <thinking> block
  thinkingContent: string; // Accumulated thinking content
};

/**
 * Create initial thinking filter state
 */
export function createThinkingFilterState(): ThinkingFilterState {
  return {
    buffer: "",
    inThinking: false,
    thinkingContent: "",
  };
}

/**
 * Process a chunk of streaming text through the thinking filter
 *
 * @param state - Current filter state (will be mutated)
 * @param chunk - New text chunk to process
 * @returns Filtered text to emit (thinking blocks removed)
 */
export function processThinkingChunk(state: ThinkingFilterState, chunk: string): string {
  // Add chunk to buffer
  state.buffer += chunk;

  let output = "";

  while (true) {
    if (!state.inThinking) {
      // Look for thinking start tag
      const startPos = findRealThinkingStartTag(state.buffer);

      if (startPos === -1) {
        // No start tag found, emit all buffer content
        output += state.buffer;
        state.buffer = "";
        break;
      }

      // Found start tag, emit content before it
      const beforeStart = state.buffer.slice(0, startPos);
      output += beforeStart;

      // Enter thinking mode
      state.inThinking = true;
      state.thinkingContent = "";
      state.buffer = state.buffer.slice(startPos + "<thinking>".length);
    } else {
      // Inside thinking block, look for end tag
      let endPos = findRealThinkingEndTag(state.buffer);

      if (endPos === -1) {
        // Try finding end tag at buffer end (boundary event)
        endPos = findRealThinkingEndTagAtBufferEnd(state.buffer);
      }

      if (endPos === -1) {
        // No end tag found yet, accumulate thinking content
        state.thinkingContent += state.buffer;
        state.buffer = "";
        break;
      }

      // Found end tag, skip thinking content
      state.thinkingContent += state.buffer.slice(0, endPos);

      // Exit thinking mode
      state.inThinking = false;

      // Skip the end tag and continue processing
      const afterEndTag = endPos + "</thinking>".length;
      state.buffer = state.buffer.slice(afterEndTag);

      // If followed by double newline, skip it too
      if (state.buffer.startsWith("\n\n")) {
        state.buffer = state.buffer.slice(2);
      }
    }
  }

  return output;
}

/**
 * Finalize thinking filter state (call when stream ends)
 *
 * @param state - Current filter state
 * @returns Any remaining filtered text to emit
 */
export function finalizeThinkingFilter(state: ThinkingFilterState): string {
  // If still in thinking mode, the thinking block was incomplete
  // Emit the buffer as-is (don't filter incomplete blocks)
  if (state.inThinking) {
    return "<thinking>" + state.thinkingContent + state.buffer;
  }

  // Emit any remaining buffer content
  return state.buffer;
}

/**
 * Extract thinking content from filter state
 *
 * @param state - Current filter state
 * @returns Accumulated thinking content (empty if not in thinking mode)
 */
export function extractThinkingContent(state: ThinkingFilterState): string {
  return state.thinkingContent;
}
