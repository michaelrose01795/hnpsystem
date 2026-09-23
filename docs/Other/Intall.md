# Install Reference

This file tracks the install commands currently relevant to this workspace and how to use the installed agent skills.

## Project npm Installs

Runtime dependencies are currently represented by this install command:

```powershell
npm install @react-three/drei @react-three/fiber @react-three/postprocessing @supabase/supabase-js autoprefixer bcryptjs chart.js class-variance-authority clsx date-fns dotenv gsap jspdf jspdf-autotable jwt-decode next next-auth nodemailer pdfjs-dist postcss postprocessing react stripe react-big-calendar react-chartjs-2 react-dom react-pdf react-select swr tailwindcss three
```

Development dependencies are currently represented by this install command:

```powershell
npm install --save-dev @eslint/eslintrc @playwright/test @types/node baseline-browser-mapping eslint eslint-config-next playwright typescript vitest
```

## Agent Skill Installs

These are the skill install commands used or equivalent to what is installed now:

```powershell
npx skills add https://github.com/pbakaus/impeccable --skill impeccable
npx skills add https://github.com/Leonxlnx/taste-skill
npx skills add ruvnet/ruflo
```

Installed skill locations:

| Skill | Location | Use for |
| --- | --- | --- |
| `impeccable` | `%USERPROFILE%\.codex\skills\impeccable` | Production-grade frontend design, redesign, polish, audits, UX copy, responsive UI, accessibility, and visual hierarchy. |
| `brandkit` | `.agents\skills\brandkit` | Brand-kit image generation and identity boards. |
| `design-taste-frontend` | `.agents\skills\design-taste-frontend` | General anti-slop frontend design and implementation. |
| `design-taste-frontend-v1` | `.agents\skills\design-taste-frontend-v1` | Original Taste Skill v1 behaviour when needed. |
| `full-output-enforcement` | `.agents\skills\full-output-enforcement` | Complete output enforcement when an agent keeps truncating work. |
| `gpt-taste` | `.agents\skills\gpt-taste` | Stricter GPT/Codex frontend taste, layout, motion, and polish. |
| `high-end-visual-design` | `.agents\skills\high-end-visual-design` | Calm, premium, high-end visual direction. |
| `image-to-code` | `.agents\skills\image-to-code` | Image-first website workflow: reference image, analysis, then code. |
| `imagegen-frontend-mobile` | `.agents\skills\imagegen-frontend-mobile` | Mobile app reference image generation. |
| `imagegen-frontend-web` | `.agents\skills\imagegen-frontend-web` | Website reference image generation. |
| `industrial-brutalist-ui` | `.agents\skills\industrial-brutalist-ui` | Swiss, mechanical, brutalist interface direction. |
| `minimalist-ui` | `.agents\skills\minimalist-ui` | Minimal editorial product UI direction. |
| `redesign-existing-projects` | `.agents\skills\redesign-existing-projects` | Auditing and upgrading existing websites or app screens. |
| `stitch-design-taste` | `.agents\skills\stitch-design-taste` | Google Stitch-compatible semantic design system work. |
| `ruvnet/ruflo` skill pack | `.agents\skills\*` | Large workflow, orchestration, coding, automation, SPARC, vector, observability, and agent coordination skill pack. Installed 245 skills from `ruvnet/ruflo`; total project-local skills are now 257. |

## How To Use The Skills

Restart Codex after installing new skills so they are picked up.

Invoke a skill by naming it in your prompt:

```text
Use impeccable to audit the VHC dashboard UI against AGENTS.md.
Use design-taste-frontend to redesign this page with stronger hierarchy.
Use gpt-taste to polish the job card screen and improve motion.
Use redesign-existing-projects to audit the current app and fix the weakest UI areas.
Use image-to-code with this screenshot: analyse the image, then implement the matching page.
Use imagegen-frontend-web to create a reference direction for a service booking page.
Use minimalist-ui to make this settings screen feel quieter and more editorial.
Use agent-coder to implement a focused code change.
Use agent-workflow to design an automated workflow.
Use agent-swarm to plan coordinated multi-agent work.
Use sparc-spec, sparc-implement, or sparc-refine for SPARC-style specification, implementation, or refinement.
```
