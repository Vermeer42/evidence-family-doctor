# 中国人的家庭医生 (Family Doctor for Chinese Families)

> 基于专业医学证据的健康问答助手

## 项目目标
为中国中老年家庭提供基于循证医学的健康问答助手。回答来源于权威医学指南（RAG知识库），而非模型记忆或网络营销内容。标注证据强度，必要时引导就医。

## 产品内核
- **核心差异化**：大模型参考的是专业医学证据库（RAG），不是没有推广意义的经验
- **证据展示**：每个建议都标注来源和可信度等级
- **安全兜底**：识别危险信号时强制引导就医

## 技术架构
- 前端：Next.js + PWA（移动端优先、适老化）
- 后端：Cloudflare Workers（国内外可达，用户无需翻墙）
- 大模型：Claude API（通过 Workers 调用）
- 知识库：Cloudflare Vectorize + R2（权威医学指南向量化存储）

## 项目结构
```
docs/
  00-research/        # 竞品调研、用户研究、市场分析
  01-product/         # PRD、需求定义、功能规格
  02-design/          # 交互设计、信息架构、证据分级体系
  03-technical/       # 架构设计、API设计、RAG方案
scripts/              # 数据采集、处理脚本
config/               # 配置文件（API key等，gitignore）
data/
  raw/                # 原始指南文档
  processed/          # 清洗后的结构化文本
  vectors/            # 向量化中间产物
src/
  worker/             # Cloudflare Workers 后端
  frontend/           # Next.js 前端
tests/                # 质量评测、安全测试
output/               # 产出物（截图、演示等）
```

## 开发流程（大厂产品节奏）
Phase 0: 竞品调研 + 用户洞察
Phase 1: 产品定义（PRD）
Phase 2: 设计（交互 + 证据体系）
Phase 3: 开发（后端 → RAG → 前端）
Phase 4: 测试与质量评估
Phase 5: 部署上线 + GitHub展示

## 当前进度
- [x] 项目初始化 + 框架确定
- [ ] Phase 0: 竞品调研（下一步）

## 运行方式
（待开发阶段补充）

## 关键决策记录
| 日期 | 决策 | 原因 |
|------|------|------|
| 2026-06-15 | 底层模型选 Claude API | 多模态强、幻觉低、Workers天然可调用 |
| 2026-06-15 | 部署用 Cloudflare Workers | 国内外都可达、与向量库同生态、零成本 |
| 2026-06-15 | 先做网页不做小程序 | 避开医疗类目审核，demo阶段更灵活 |
| 2026-06-15 | 核心差异化是RAG证据库 | 区别于模型记忆，来源可追溯可验证 |
| 2026-06-15 | GitHub名：中国人的家庭医生 | 对外亲切，用户侧再包装 |
