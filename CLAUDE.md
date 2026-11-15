# CLAUDE.md

Context for Claude Code sessions on this repo. Two co-founders work on it. Keep this file current.

## The business

A 100% self-serve, credit-based web app: a merchant picks a template, uploads 1 product photo,
gets a text-free, silent vertical video ad in ~60 seconds. First market: Saudi
Salla/Zid merchants. Full plan: `docs/PLAN.md`.

## Hard rules

- No agency work: no client servicing, calls or custom edits. Everything must be self-serve.
- The merchant's product never goes through the video model: it is cut out and composited,
  unchanged, onto an AI-generated background scene. Labels, logos and Arabic text must never be altered.
- Background scenes are product-independent and reused from a library; don't re-render per order.
- Videos have no text and no music by default. Captions are a separate optional feature; music is added by the merchant in TikTok/Instagram.
- Prepaid credits only, no unlimited plans.

## Current stage

Week 1 render test (Nov 16-22 2026): a command-line script, photo + template -> mp4.
No web app, accounts or database yet.

## Conventions

- Ask the user before adding any dependency.
- API keys only in environment variables, never committed or printed. Never commit `.env`.
- Sample businesses and products in the repo are fictional; example domains only.
- Small commits with clear messages.

## Skills

- `.claude/skills/llm-council/`, `claude-council/`: "council this: <decision>" for real trade-offs. Starts many sub-agents.
- `.claude/skills/business-model/` (phuryn/pm-skills): Business Model Canvas.
- `.claude/skills/grill-me/` (mattpocock/skills): needs the `grilling` skill, not installed yet.
- `.claude/skills/verify/`: empty, purpose not decided yet.
