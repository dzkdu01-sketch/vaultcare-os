# Vaultcare Requirements Document Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update `20-方案设计/12-一期需求说明书.md` with the approved medium-scope revisions so it better serves as the phase-one top-level requirements document.

**Architecture:** Apply focused edits to the existing markdown document rather than restructuring the file. Add only the approved sections and clarifications, keeping the document concise while aligning order-related rules, Gate 0/Gate 2 requirements, and cross-module dependencies.

**Tech Stack:** Markdown documentation, local filesystem editing tools

---

### Task 1: Add measurable success metrics

**Files:**
- Modify: `20-方案设计/12-一期需求说明书.md`

**Step 1: Read the project goal section**

Read the existing `1. 项目背景与建设目标` section and confirm where `1.3` should be inserted.

**Step 2: Draft the new metrics section**

Add a `1.3 成功指标` subsection after `1.2 建设目标` with a markdown table including 3-5 measurable metrics, target values, and measurement methods.

**Step 3: Verify section numbering and flow**

Confirm the section order remains `1.1`, `1.2`, `1.3`, then `2`.

**Step 4: Review for top-level-document tone**

Ensure the metrics are business-facing and do not drift into implementation detail.

### Task 2: Add lightweight multi-market rules

**Files:**
- Modify: `20-方案设计/12-一期需求说明书.md`

**Step 1: Locate insertion point after the main business flow**

Identify the end of section `4. 端到端业务主链路`.

**Step 2: Add a new market-difference section**

Insert a short section after chapter 4 describing the minimum UAE/TH differences relevant to phase one.

**Step 3: Keep scope constrained**

Ensure the new content only covers fulfillment owner, ownership model, external-supplier routing, and default currency.

**Step 4: Re-read the surrounding chapters**

Confirm the new section connects naturally from chapter 4 into the following module requirements.

### Task 3: Update order sources and exception recovery rules

**Files:**
- Modify: `20-方案设计/12-一期需求说明书.md`

**Step 1: Update order sources in section 7.2**

Add WhatsApp as a third source and clarify it uses manual-entry flow while preserving `order_source` for later analysis.

**Step 2: Update section 7.3**

Add the recovery path for automatically received orders that enter `exception`: complete required fields, manual confirmation, return to `pending_review`.

**Step 3: Re-read sections 7.2-7.4 together**

Confirm source definitions, validation rules, and main status flow remain internally consistent.

### Task 4: Add explicit exception-task definition

**Files:**
- Modify: `20-方案设计/12-一期需求说明书.md`

**Step 1: Identify insertion point after 7.6**

Find the end of `7.6 异常处理能力`.

**Step 2: Add `7.6A 异常任务` subsection**

Define exception tasks as an independent object, describe their purpose, minimum state flow, and relationship to the order.

**Step 3: Keep object boundaries clear**

Make sure the section distinguishes clearly between the order being in `exception` and the exception task used to track handling.

### Task 5: Strengthen rejected-order task requirements

**Files:**
- Modify: `20-方案设计/12-一期需求说明书.md`

**Step 1: Rework section 7.9**

Expand the rejected-task description so it captures pending, processing, settlement-marking, and closed handling in a concise top-level-document style.

**Step 2: Align with settlement-close behavior**

Ensure the text clearly states that closing the rejected task does not directly close the order and instead moves it to `pending_settlement`.

**Step 3: Re-read 7.9 and 7.10 together**

Verify the rejected-task rules and settlement-confirmation rules are not contradictory.

### Task 6: Add cross-module dependency rules

**Files:**
- Modify: `20-方案设计/12-一期需求说明书.md`

**Step 1: Locate chapter 9**

Find the correct place to add `9.8 跨模块状态联动规则`.

**Step 2: Add a concise rule table**

Create a markdown table listing upstream events and downstream effects for product, site, webhook, exception, and rejected-task events.

**Step 3: Validate against existing chapter 9 rules**

Make sure the new table complements rather than duplicates sections `9.1` to `9.7`.

### Task 7: Add migration requirements

**Files:**
- Modify: `20-方案设计/12-一期需求说明书.md`

**Step 1: Locate section 13.1**

Read the existing pending-items section.

**Step 2: Add migration bullet points**

Document which existing data should be migrated, initial-state principles, and whether bulk import support is required.

**Step 3: Keep details minimal**

Leave field-level mapping and migration scripts to later lower-level documents.

### Task 8: Add lightweight non-functional requirements

**Files:**
- Modify: `20-方案设计/12-一期需求说明书.md`

**Step 1: Add chapter 14**

Create a new chapter `14. 非功能性需求` near the end of the document.

**Step 2: Add minimum required subsections**

Include concise bullets or subheadings for performance, security, batch-operation constraints, and availability/backup.

**Step 3: Review against scope discipline**

Ensure the chapter remains lightweight and does not become a full architecture specification.

### Task 9: Review the full document after edits

**Files:**
- Modify: `20-方案设计/12-一期需求说明书.md`

**Step 1: Read all edited regions**

Read back every changed section to verify wording, numbering, and consistency.

**Step 2: Check cross-references**

Make sure references to `pending_settlement`, WhatsApp source, exception tasks, and migration requirements are internally consistent.

**Step 3: Final cleanup pass**

Remove duplicated wording, fix heading hierarchy, and ensure the tone remains that of a top-level requirements document.
