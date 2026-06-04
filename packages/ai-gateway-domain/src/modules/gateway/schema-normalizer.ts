// ---------------------------------------------------------------------------
// JSON Schema Normalizer — fixes common schema issues for AI tool definitions
// ---------------------------------------------------------------------------

/**
 * Normalizes JSON Schema to fix common issues in MCP tool definitions.
 *
 * Claude Code / MCP tools occasionally have malformed schemas:
 * - `required: null` or `required: undefined`
 * - `properties: null` or `properties: undefined`
 * - Missing `type` field
 * - Invalid `additionalProperties` values
 *
 * These cause upstream APIs to return 400 "Improperly formed request".
 * This normalizer ensures schemas are well-formed before sending to providers.
 *
 * @param schema - The JSON schema to normalize (can be any JSON value)
 * @returns Normalized schema that conforms to JSON Schema spec
 */
export function normalizeJsonSchema(schema: unknown): Record<string, unknown> {
  // If not an object, return a minimal valid schema
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: true,
    };
  }

  const obj = schema as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...obj };

  // Ensure `type` is a non-empty string (default to "object")
  if (typeof normalized.type !== "string" || !normalized.type.trim()) {
    normalized.type = "object";
  }

  // Ensure `properties` is an object (default to empty object)
  if (
    !normalized.properties ||
    typeof normalized.properties !== "object" ||
    Array.isArray(normalized.properties)
  ) {
    normalized.properties = {};
  }

  // Ensure `required` is an array of strings (default to empty array)
  if (!Array.isArray(normalized.required)) {
    normalized.required = [];
  } else {
    // Filter out non-string values
    normalized.required = normalized.required.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
  }

  // Ensure `additionalProperties` is boolean or object (default to true)
  const additionalProps = normalized.additionalProperties;
  if (
    typeof additionalProps !== "boolean" &&
    (typeof additionalProps !== "object" || additionalProps === null || Array.isArray(additionalProps))
  ) {
    normalized.additionalProperties = true;
  }

  return normalized;
}

/**
 * Normalizes an array of tool definitions by fixing their input schemas.
 *
 * @param tools - Array of tool definitions with `input_schema` fields
 * @returns Array of tools with normalized schemas
 */
export function normalizeToolSchemas<T extends { input_schema?: unknown }>(
  tools: T[],
): T[] {
  return tools.map((tool) => {
    if (!tool.input_schema) {
      return tool;
    }

    return {
      ...tool,
      input_schema: normalizeJsonSchema(tool.input_schema),
    };
  });
}
