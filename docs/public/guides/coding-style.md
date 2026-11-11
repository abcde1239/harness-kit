# 提炼自己的编码习惯

从你维护的项目中整理编码风格和架构惯例，让 Agent 在后续开发中有明确的参考。可以给一个项目，也可以给包含多个项目的目录；Agent 会先确认范围并抽取有代表性的代码。

## 开始使用

安装 Harness Kit Skill 或插件后，在会话中说：

```text
Distill my coding style and architecture habits from the projects in <source-directory>.
Save code evidence, scope and counterexamples, then summarize concise rules. Keep sample projects read-only.
```

会查看现有格式配置和实际代码，包括命名、类型与契约、模块边界、数据访问、错误处理和测试方式。不同语言、框架及项目的差异会分别保留；团队代码、克隆与生成内容不会直接算成个人习惯。

这项功能由 Agent 阅读和归纳，不需要运行额外的初始化命令，也不会训练模型。Git 作者和维护历史只是来源线索，无法证明每段代码的实际设计者。

## 保存什么

有现成规范时沿用原文档；否则默认写入本次工作目录：

```text
docs/decision/coding-style/
├── PROFILE.md    项目来源、代码定位、文件摘要、观察、差异与局限
└── RULES.md      简短规则、适用范围、采用状态和检查方式
```

两份文档默认是内部资料，尤其 PROFILE 可能包含本机路径和私有项目细节。公开项目可以指定私有伴随目录，不需要把个人画像加入公开仓库。总结不会向所有样本项目批量写文件。

## 用在后续开发中

先查看规则，再提出采用要求：

```text
Apply the rules from this profile that fit the current project, preserving its configuration and framework.
Record adoption scope, cite violated rule IDs during review, and run existing relevant checks.
```

规则有三个状态：candidate 是候选观察，adopted 是已要求在指定范围采用，retired 是已停用。归纳得很确定也不会自动变成适用于所有项目的强制规范。

通过 Harness Kit 开发时，Agent 读取适用的 adopted 规则并用于实现与复核。新生成的宿主入口也包含条件读取约定；旧项目重新接入时按原冲突保护机制更新。其他 Agent 是否读取规则仍取决于实际加载的项目指令；不会自动修改用户全局配置。

格式与类型规则优先使用项目原有工具；架构规则通过实际改动和调用链复核。普通 `harness check` 不会自动执行文档里的每条风格要求，需要机械门禁时再接入能够准确表达规则的现有检查。

## 更新画像

```text
Update this coding profile using the additional projects, preserving my edits and adopted rules.
List new evidence, counterexamples, stale sources and rules that may need adjustment.
```

更新按规则 ID 合并，不会以重新生成的文案覆盖个人修改。完整的提炼与采用方法见[Skill 参考](../../../skills/harness-kit/references/coding-style.md)。
