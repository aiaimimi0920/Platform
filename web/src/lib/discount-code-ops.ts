import type {
  DiscountCodeOperatorView,
  UpsertDiscountCodeInput,
} from "@neuro/contracts";

const discountCodeCsvHeaders = [
  "discountCodeId",
  "code",
  "namespace",
  "batchLabel",
  "enabled",
  "scope",
  "targetProductCategory",
  "targetProductId",
  "audienceScope",
  "audienceGroupKey",
  "audienceUserId",
  "valueKind",
  "valueAmount",
  "totalMaxUses",
  "perUserLimit",
  "startsAt",
  "expiresAt",
] as const;

function normalizeOptionalText(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalIso(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function escapeCsvCell(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

export function serializeDiscountCodesToCsv(discountCodes: DiscountCodeOperatorView[]) {
  const rows = [
    discountCodeCsvHeaders.join(","),
    ...discountCodes.map((discountCode) =>
      [
        discountCode.id,
        discountCode.code,
        discountCode.namespace ?? "",
        discountCode.batchLabel ?? "",
        String(discountCode.enabled),
        discountCode.scope,
        discountCode.targetProductCategory ?? "",
        discountCode.targetProductId ?? "",
        discountCode.audienceScope,
        discountCode.audienceGroupKey ?? "",
        discountCode.audienceUserId ?? "",
        discountCode.valueKind,
        String(discountCode.valueAmount),
        discountCode.totalMaxUses === null ? "" : String(discountCode.totalMaxUses),
        discountCode.perUserLimit === null ? "" : String(discountCode.perUserLimit),
        discountCode.startsAt ?? "",
        discountCode.expiresAt ?? "",
      ]
        .map((value) => escapeCsvCell(value))
        .join(","),
    ),
  ];

  return rows.join("\n");
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        currentCell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function parseCsvBoolean(value: string, header: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`${header} 必须是 true 或 false。`);
}

function parseCsvOptionalPositiveInt(value: string, header: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${header} 必须是正整数。`);
  }
  return Math.floor(parsed);
}

function parseCsvRequiredPositiveInt(value: string, header: string) {
  const parsed = parseCsvOptionalPositiveInt(value, header);
  if (parsed === null) {
    throw new Error(`${header} 不能为空。`);
  }
  return parsed;
}

function parseCsvOptionalIso(value: string, header: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${header} 不是合法时间。`);
  }
  return parsed.toISOString();
}

export function parseDiscountCodesCsv(text: string) {
  const normalizedText = text.replace(/^\uFEFF/, "");
  const rows = parseCsv(normalizedText);
  if (rows.length < 2) {
    throw new Error("CSV 至少需要标题行和一条数据。");
  }

  const headers = rows[0].map((header) => header.trim());
  const missingHeaders = discountCodeCsvHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`CSV 缺少必要列：${missingHeaders.join("、")}。`);
  }

  const headerIndex = new Map(headers.map((header, index) => [header, index]));

  return rows.slice(1).map((row, rowIndex) => {
    const read = (header: (typeof discountCodeCsvHeaders)[number]) => row[headerIndex.get(header) ?? -1] ?? "";
    const discountCodeId = read("discountCodeId").trim();
    const code = read("code").trim();

    if (!discountCodeId || !code) {
      throw new Error(`CSV 第 ${rowIndex + 2} 行缺少 discountCodeId 或 code。`);
    }

    return {
      discountCodeId,
      input: {
        code,
        namespace: normalizeOptionalText(read("namespace")),
        batchLabel: normalizeOptionalText(read("batchLabel")),
        enabled: parseCsvBoolean(read("enabled"), `CSV 第 ${rowIndex + 2} 行 enabled`),
        scope: read("scope").trim() as UpsertDiscountCodeInput["scope"],
        targetProductCategory: normalizeOptionalText(read("targetProductCategory")),
        targetProductId: normalizeOptionalText(read("targetProductId")),
        audienceScope: read("audienceScope").trim() as UpsertDiscountCodeInput["audienceScope"],
        audienceGroupKey: normalizeOptionalText(read("audienceGroupKey")),
        audienceUserId: normalizeOptionalText(read("audienceUserId")),
        valueKind: read("valueKind").trim() as UpsertDiscountCodeInput["valueKind"],
        valueAmount: parseCsvRequiredPositiveInt(read("valueAmount"), `CSV 第 ${rowIndex + 2} 行 valueAmount`),
        totalMaxUses: parseCsvOptionalPositiveInt(read("totalMaxUses"), `CSV 第 ${rowIndex + 2} 行 totalMaxUses`),
        perUserLimit: parseCsvOptionalPositiveInt(read("perUserLimit"), `CSV 第 ${rowIndex + 2} 行 perUserLimit`),
        startsAt: parseCsvOptionalIso(read("startsAt"), `CSV 第 ${rowIndex + 2} 行 startsAt`),
        expiresAt: parseCsvOptionalIso(read("expiresAt"), `CSV 第 ${rowIndex + 2} 行 expiresAt`),
      } satisfies UpsertDiscountCodeInput,
    };
  });
}

export type DiscountCodeImportPreviewItem = {
  discountCodeId: string;
  code: string;
  status: "create" | "update" | "unchanged";
  changedFields: string[];
  fieldDiffs: Array<{
    field: keyof UpsertDiscountCodeInput | "new_record";
    before: string | null;
    after: string | null;
  }>;
};

export type DiscountCodeImportPreviewSummary = {
  totalRows: number;
  createCount: number;
  updateCount: number;
  unchangedCount: number;
  previewItems: DiscountCodeImportPreviewItem[];
};

const discountCodeComparableFields: Array<keyof UpsertDiscountCodeInput> = [
  "code",
  "namespace",
  "batchLabel",
  "enabled",
  "scope",
  "targetProductCategory",
  "targetProductId",
  "audienceScope",
  "audienceGroupKey",
  "audienceUserId",
  "valueKind",
  "valueAmount",
  "totalMaxUses",
  "perUserLimit",
  "startsAt",
  "expiresAt",
];

function normalizePreviewInput(input: UpsertDiscountCodeInput) {
  return {
    ...input,
    code: input.code.trim().toUpperCase(),
    namespace: normalizeOptionalText(input.namespace),
    batchLabel: normalizeOptionalText(input.batchLabel),
    targetProductCategory: normalizeOptionalText(input.targetProductCategory),
    targetProductId: normalizeOptionalText(input.targetProductId),
    audienceGroupKey: normalizeOptionalText(input.audienceGroupKey),
    audienceUserId: normalizeOptionalText(input.audienceUserId),
    startsAt: normalizeOptionalIso(input.startsAt),
    expiresAt: normalizeOptionalIso(input.expiresAt),
  };
}

function getDiscountCodePreviewChangedFields(
  existing: DiscountCodeOperatorView,
  input: UpsertDiscountCodeInput,
) {
  const normalized = normalizePreviewInput(input);
  return discountCodeComparableFields.filter((field) => existing[field] !== normalized[field]);
}

function toPreviewDisplayValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function buildDiscountCodePreviewFieldDiffs(args: {
  existing: DiscountCodeOperatorView | null;
  input: UpsertDiscountCodeInput;
  changedFields?: Array<keyof UpsertDiscountCodeInput>;
}) {
  const normalized = normalizePreviewInput(args.input);
  if (!args.existing) {
    return discountCodeComparableFields
      .map((field) => ({
        field,
        before: null,
        after: toPreviewDisplayValue(normalized[field]),
      }))
      .filter((fieldDiff) => fieldDiff.after !== null);
  }

  const changedFields = args.changedFields ?? getDiscountCodePreviewChangedFields(args.existing, args.input);
  return changedFields.map((field) => ({
    field,
    before: toPreviewDisplayValue(args.existing?.[field]),
    after: toPreviewDisplayValue(normalized[field]),
  }));
}

export function buildDiscountCodeImportPreview(args: {
  rows: Array<{ discountCodeId: string; input: UpsertDiscountCodeInput }>;
  existingDiscountCodes: DiscountCodeOperatorView[];
  previewLimit?: number;
}) {
  const existingById = new Map(args.existingDiscountCodes.map((discountCode) => [discountCode.id, discountCode]));
  const previewItems: DiscountCodeImportPreviewItem[] = [];
  const previewLimit = Math.max(1, Math.min(args.previewLimit ?? 12, 50));
  let createCount = 0;
  let updateCount = 0;
  let unchangedCount = 0;

  for (const row of args.rows) {
    const existing = existingById.get(row.discountCodeId);
    if (!existing) {
      createCount += 1;
      if (previewItems.length < previewLimit) {
        previewItems.push({
          discountCodeId: row.discountCodeId,
          code: row.input.code.trim().toUpperCase(),
          status: "create",
          changedFields: ["new_record"],
          fieldDiffs: buildDiscountCodePreviewFieldDiffs({
            existing: null,
            input: row.input,
          }),
        });
      }
      continue;
    }

    const changedFields = getDiscountCodePreviewChangedFields(existing, row.input);
    if (changedFields.length === 0) {
      unchangedCount += 1;
      if (previewItems.length < previewLimit) {
        previewItems.push({
          discountCodeId: row.discountCodeId,
          code: existing.code,
          status: "unchanged",
          changedFields: [],
          fieldDiffs: [],
        });
      }
      continue;
    }

    updateCount += 1;
    if (previewItems.length < previewLimit) {
      previewItems.push({
        discountCodeId: row.discountCodeId,
        code: row.input.code.trim().toUpperCase(),
        status: "update",
        changedFields,
        fieldDiffs: buildDiscountCodePreviewFieldDiffs({
          existing,
          input: row.input,
          changedFields,
        }),
      });
    }
  }

  return {
    totalRows: args.rows.length,
    createCount,
    updateCount,
    unchangedCount,
    previewItems,
  } satisfies DiscountCodeImportPreviewSummary;
}

export function serializeDiscountCodePreviewToCsv(summary: DiscountCodeImportPreviewSummary) {
  const header = ["discountCodeId", "code", "status", "field", "before", "after"].join(",");
  const rows = summary.previewItems.flatMap((item) => {
    if (item.fieldDiffs.length === 0) {
      return [
        [item.discountCodeId, item.code, item.status, "none", "", ""]
          .map((value) => escapeCsvCell(value))
          .join(","),
      ];
    }
    return item.fieldDiffs.map((fieldDiff) =>
      [
        item.discountCodeId,
        item.code,
        item.status,
        String(fieldDiff.field),
        fieldDiff.before ?? "",
        fieldDiff.after ?? "",
      ]
        .map((value) => escapeCsvCell(value))
        .join(","),
    );
  });
  return [header, ...rows].join("\n");
}
