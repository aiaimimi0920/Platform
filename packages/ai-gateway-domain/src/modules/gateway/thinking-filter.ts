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

const THINKING_START_TAG = "<thinking>";
const THINKING_END_TAG = "</thinking>";

/** Return the first unquoted occurrence of a tag in a buffer. */
function findUnquotedTag(text: string, tag: string, startPos = 0): number {
  let searchPos = startPos;
  while (true) {
    const pos = text.indexOf(tag, searchPos);
    if (pos === -1) {
      return -1;
    }

    const hasQuoteBefore = pos > 0 && isQuoteChar(text, pos - 1);
    const hasQuoteAfter = isQuoteChar(text, pos + tag.length);
    if (!hasQuoteBefore && !hasQuoteAfter) {
      return pos;
    }

    searchPos = pos + 1;
  }
}

/**
 * Find a suffix which may become a complete tag when the next chunk arrives.
 * Include a preceding quote character so a quoted tag split across chunks is
 * still classified correctly after the buffer is appended.
 */
function findPotentialTagSuffix(text: string, tag: string): number {
  const firstCandidate = Math.max(0, text.length - tag.length + 1);
  for (let pos = firstCandidate; pos < text.length; pos += 1) {
    const suffix = text.slice(pos);
    if (tag.startsWith(suffix) && suffix.length < tag.length) {
      return pos > 0 && isQuoteChar(text, pos - 1) ? pos - 1 : pos;
    }
  }
  return -1;
}

/**
 * Remove whitespace which belongs to the transport boundary after a thinking
 * block. Horizontal spacing before ordinary prose remains untouched, while
 * newline-delimited boundaries (including tool events) are collapsed.
 */
function consumeBoundaryWhitespace(text: string): { text: string; consumed: boolean } {
  if (text.length === 0) {
    return { text, consumed: false };
  }

  const leadingWhitespace = text.match(/^[\t\r\n ]*/)?.[0] ?? "";
  if (leadingWhitespace.length === 0) {
    return { text, consumed: false };
  }

  if (/\r?\n/.test(leadingWhitespace)) {
    return { text: text.slice(leadingWhitespace.length), consumed: true };
  }

  // A chunk containing only spaces may be a boundary split. Keep it pending
  // so the next chunk can tell whether it precedes a real newline/tool event.
  if (leadingWhitespace.length === text.length) {
    return { text, consumed: false };
  }

  return { text, consumed: false };
}

/**
 * Thinking filter state
 */
export type ThinkingFilterState = {
  buffer: string; // Accumulated text buffer
  inThinking: boolean; // Currently inside <thinking> block
  thinkingContent: string; // Accumulated thinking content
  suppressBoundaryWhitespace: boolean; // Drop newline-delimited spacing after a closed block
  endTagSplitAcrossChunks: boolean; // Defer post-tag text until finalize for split end tags
};

/**
 * Create initial thinking filter state
 */
export function createThinkingFilterState(): ThinkingFilterState {
  return {
    buffer: "",
    inThinking: false,
    thinkingContent: "",
    suppressBoundaryWhitespace: false,
    endTagSplitAcrossChunks: false,
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
  state.buffer += chunk;

  let output = "";

  while (true) {
    if (!state.inThinking) {
      if (state.suppressBoundaryWhitespace) {
        const boundary = consumeBoundaryWhitespace(state.buffer);
        if (boundary.consumed) {
          state.buffer = boundary.text;
        } else if (state.buffer.trim() === "") {
          // Wait for a non-whitespace chunk before deciding whether the
          // pending spaces belong to ordinary prose.
          break;
        } else {
          state.suppressBoundaryWhitespace = false;
        }
      }

      const startPos = findUnquotedTag(state.buffer, THINKING_START_TAG);

      if (startPos === -1) {
        const partialPos = findPotentialTagSuffix(state.buffer, THINKING_START_TAG);
        if (partialPos === -1) {
          output += state.buffer;
          state.buffer = "";
        } else if (partialPos > 0) {
          output += state.buffer.slice(0, partialPos);
          state.buffer = state.buffer.slice(partialPos);
        }
        break;
      }

      const beforeStart = state.buffer.slice(0, startPos);
      output += beforeStart;

      state.inThinking = true;
      state.thinkingContent = "";
      state.suppressBoundaryWhitespace = false;
      state.buffer = state.buffer.slice(startPos + THINKING_START_TAG.length);
    } else {
      const endPos = findUnquotedTag(state.buffer, THINKING_END_TAG);

      if (endPos === -1) {
        const partialPos = findPotentialTagSuffix(state.buffer, THINKING_END_TAG);
        if (partialPos === -1) {
          state.thinkingContent += state.buffer;
          state.buffer = "";
        } else if (partialPos > 0) {
          state.thinkingContent += state.buffer.slice(0, partialPos);
          state.buffer = state.buffer.slice(partialPos);
          state.endTagSplitAcrossChunks = true;
        } else {
          state.endTagSplitAcrossChunks = true;
        }
        break;
      }

      const deferRemainder = state.endTagSplitAcrossChunks;
      state.endTagSplitAcrossChunks = false;
      state.thinkingContent += state.buffer.slice(0, endPos);
      state.inThinking = false;
      state.suppressBoundaryWhitespace = true;
      const afterEndTag = endPos + THINKING_END_TAG.length;
      state.buffer = state.buffer.slice(afterEndTag);

      if (deferRemainder) {
        break;
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
  let output = "";
  if (!state.inThinking && state.buffer.length > 0) {
    output = processThinkingChunk(state, "");
  }

  if (state.inThinking) {
    const remaining = THINKING_START_TAG + state.thinkingContent + state.buffer;
    state.buffer = "";
    return output + remaining;
  }

  if (state.suppressBoundaryWhitespace && state.buffer.trim() === "") {
    state.buffer = "";
    return output;
  }

  const boundary = state.suppressBoundaryWhitespace
    ? consumeBoundaryWhitespace(state.buffer)
    : { text: state.buffer, consumed: false };
  state.suppressBoundaryWhitespace = false;
  state.buffer = "";
  return output + boundary.text;
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
