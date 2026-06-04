"use client";

import { Button } from "@/components/ui/button";
import { useAppToast } from "@/components/app-toast-center";

type BenefitDeskActionsProps = {
  activeCodes: string[];
  claimLabel: string;
  familyKey: string;
  title: string;
};

function buildBundleBody(title: string, claimLabel: string, activeCodes: string[]) {
  return [
    `# ${title}`,
    `# 导出时间: ${new Date().toLocaleString("zh-CN")}`,
    `# 单元类型: ${claimLabel}`,
    "",
    ...activeCodes.map((code, index) => `${index + 1}. ${code}`),
    "",
  ].join("\n");
}

function sanitizeFileKey(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "benefit";
}

export function BenefitDeskActions({
  activeCodes,
  claimLabel,
  familyKey,
  title,
}: BenefitDeskActionsProps) {
  const { pushToast } = useAppToast();
  const disabled = activeCodes.length === 0;

  async function handleCopy() {
    if (disabled) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildBundleBody(title, claimLabel, activeCodes));
      pushToast({
        tone: "success",
        title: "已复制",
        message: `${title} 的 ${activeCodes.length} 个${claimLabel}已复制到剪贴板。`,
      });
    } catch {
      pushToast({
        tone: "error",
        title: "复制失败",
        message: "当前浏览器环境未能完成剪贴板写入，请改用下载导出。",
      });
    }
  }

  function handleDownload() {
    if (disabled) {
      return;
    }

    const blob = new Blob([buildBundleBody(title, claimLabel, activeCodes)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sanitizeFileKey(familyKey)}-bundle.txt`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    pushToast({
      tone: "success",
      title: "已导出",
      message: `${title} 的凭证清单已下载。`,
    });
  }

  return (
    <div className="app-benefit-card__actions">
      <Button disabled={disabled} onClick={handleDownload} variant="primary">
        下载凭证包
      </Button>
      <Button disabled={disabled} onClick={handleCopy} variant="glass">
        复制清单
      </Button>
    </div>
  );
}
