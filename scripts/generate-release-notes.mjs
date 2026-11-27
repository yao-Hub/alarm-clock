import { execFileSync } from "node:child_process";

const currentTag = process.argv[2];
if (!/^v\d+\.\d+\.\d+$/.test(currentTag ?? "")) {
  throw new Error("请提供有效的版本标签，例如 v0.1.8。");
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

let previousTag = "";
try {
  previousTag = git(["describe", "--tags", "--abbrev=0", `${currentTag}^`]);
} catch {
  previousTag = "";
}

const revisionRange = previousTag
  ? `${previousTag}..${currentTag}`
  : currentTag;
const commits = git(["log", revisionRange, "--pretty=format:%s%x09%h"])
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [subject, hash] = line.split("\t");
    const match = /^([a-z]+)(?:\([^)]*\))?!?:\s*(.+)$/.exec(subject);
    return {
      type: match?.[1] ?? "other",
      description: match?.[2] ?? subject,
      hash,
    };
  })
  .filter((commit) => commit.type !== "release");

const groups = [
  { title: "新功能", types: new Set(["feat"]) },
  { title: "问题修复", types: new Set(["fix", "revert"]) },
  { title: "优化调整", types: new Set(["perf", "refactor", "style"]) },
  {
    title: "文档与工程",
    types: new Set(["docs", "test", "build", "ci", "chore", "workflow"]),
  },
];

const sections = groups.flatMap((group) => {
  const items = commits.filter((commit) => group.types.has(commit.type));
  if (items.length === 0) {
    return [];
  }
  return [
    `### ${group.title}`,
    "",
    ...items.map((commit) => `- ${commit.description}（\`${commit.hash}\`）`),
  ];
});

const uncategorized = commits.filter(
  (commit) => !groups.some((group) => group.types.has(commit.type)),
);
if (uncategorized.length > 0) {
  sections.push(
    "### 其他调整",
    "",
    ...uncategorized.map(
      (commit) => `- ${commit.description}（\`${commit.hash}\`）`,
    ),
  );
}

const version = currentTag.slice(1);
const content =
  sections.length > 0
    ? sections.join("\n")
    : "- 本次发布包含日常维护与稳定性改进。";

console.log(`## 更新内容

${content}

## 安装说明

下载 \`Shike.Alarm_${version}_x64-setup.exe\` 安装。`);
