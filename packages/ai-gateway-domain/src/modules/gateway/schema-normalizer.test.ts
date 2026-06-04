import { describe, it, expect } from "vitest";
import { normalizeJsonSchema, normalizeToolSchemas } from "./schema-normalizer";

describe("normalizeJsonSchema", () => {
  it("should return minimal valid schema for non-object input", () => {
    expect(normalizeJsonSchema(null)).toEqual({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: true,
    });

    expect(normalizeJsonSchema(undefined)).toEqual({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: true,
    });

    expect(normalizeJsonSchema("string")).toEqual({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: true,
    });

    expect(normalizeJsonSchema([])).toEqual({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: true,
    });
  });

  it("should add missing type field", () => {
    const result = normalizeJsonSchema({
      properties: { name: { type: "string" } },
    });

    expect(result.type).toBe("object");
  });

  it("should replace empty type with 'object'", () => {
    const result = normalizeJsonSchema({
      type: "",
      properties: {},
    });

    expect(result.type).toBe("object");
  });

  it("should normalize null properties to empty object", () => {
    const result = normalizeJsonSchema({
      type: "object",
      properties: null,
    });

    expect(result.properties).toEqual({});
  });

  it("should normalize undefined properties to empty object", () => {
    const result = normalizeJsonSchema({
      type: "object",
    });

    expect(result.properties).toEqual({});
  });

  it("should normalize null required to empty array", () => {
    const result = normalizeJsonSchema({
      type: "object",
      properties: {},
      required: null,
    });

    expect(result.required).toEqual([]);
  });

  it("should filter out non-string values from required array", () => {
    const result = normalizeJsonSchema({
      type: "object",
      properties: {},
      required: ["name", null, 123, "", "age", undefined],
    });

    expect(result.required).toEqual(["name", "age"]);
  });

  it("should normalize invalid additionalProperties to true", () => {
    expect(
      normalizeJsonSchema({
        type: "object",
        properties: {},
        additionalProperties: null,
      }).additionalProperties,
    ).toBe(true);

    expect(
      normalizeJsonSchema({
        type: "object",
        properties: {},
        additionalProperties: [],
      }).additionalProperties,
    ).toBe(true);

    expect(
      normalizeJsonSchema({
        type: "object",
        properties: {},
        additionalProperties: "invalid",
      }).additionalProperties,
    ).toBe(true);
  });

  it("should preserve valid additionalProperties boolean", () => {
    expect(
      normalizeJsonSchema({
        type: "object",
        properties: {},
        additionalProperties: false,
      }).additionalProperties,
    ).toBe(false);
  });

  it("should preserve valid additionalProperties object", () => {
    const schema = {
      type: "object",
      properties: {},
      additionalProperties: { type: "string" },
    };

    const result = normalizeJsonSchema(schema);
    expect(result.additionalProperties).toEqual({ type: "string" });
  });

  it("should handle complete valid schema without changes", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name"],
      additionalProperties: false,
    };

    const result = normalizeJsonSchema(schema);
    expect(result).toEqual(schema);
  });

  it("should handle MCP tool definition with malformed schema", () => {
    const malformedSchema = {
      type: "object",
      properties: null,
      required: null,
      additionalProperties: null,
    };

    const result = normalizeJsonSchema(malformedSchema);

    expect(result).toEqual({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: true,
    });
  });
});

describe("normalizeToolSchemas", () => {
  it("should normalize input_schema for all tools", () => {
    const tools = [
      {
        name: "get_weather",
        description: "Get weather",
        input_schema: {
          type: "object",
          properties: null,
          required: null,
        },
      },
      {
        name: "search",
        description: "Search",
        input_schema: {
          properties: { query: { type: "string" } },
        },
      },
    ];

    const result = normalizeToolSchemas(tools);

    expect(result[0].input_schema).toEqual({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: true,
    });

    expect(result[1].input_schema.type).toBe("object");
    expect(result[1].input_schema.properties).toEqual({
      query: { type: "string" },
    });
  });

  it("should handle tools without input_schema", () => {
    const tools = [
      {
        name: "simple_tool",
        description: "A simple tool",
      },
    ];

    const result = normalizeToolSchemas(tools);
    expect(result).toEqual(tools);
  });

  it("should preserve other tool properties", () => {
    const tools = [
      {
        name: "custom_tool",
        description: "Custom tool",
        custom_field: "value",
        input_schema: {
          type: "object",
          properties: null,
        },
      },
    ];

    const result = normalizeToolSchemas(tools);

    expect(result[0].name).toBe("custom_tool");
    expect(result[0].description).toBe("Custom tool");
    expect(result[0].custom_field).toBe("value");
    expect(result[0].input_schema.properties).toEqual({});
  });
});
