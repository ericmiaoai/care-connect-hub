# CareSync: Product Requirements & System Architecture (MVP)

**Author:** Eric Miao  
**Context:** CIMA 130 - A12 Capstone Project  
**Timeline:** 14-Day Sprint Execution  

---

## 1. Core System Architecture & Regulatory Safety
To hit the deployment deadline and maintain strict clinical safety, we have descoped peripheral features to protect the critical path. The system utilizes Strict Role-Based Access Control (RBAC) to ensure medical integrity.

* **Admin_Caregiver (e.g., Family Lead):** Full Read/Write access across all modules. Sole authority to approve OCR data and modify clinical schedules.
* **Patient:** Read-only visibility into the clinical schedule.
* **Regulatory Disclaimer (FDA SaMD Avoidance):** The UI must prominently display that CareSync is an "administrative organizational tool, not a substitute for professional medical advice." The system dictates no clinical actions autonomously.

## 2. The Clinical Data Ingestion Workflow (The Safety Pipeline)
Data from physical medical documents is processed through a rigid, linear pipeline. The system enforces a mandatory "Human-In-The-Loop" (HITL) architecture; the AI is isolated from direct database access.

1. **AVS Upload:** The `Admin_Caregiver` uploads a photo/PDF of the physical After Visit Summary (AVS).
2. **Gemini Vision OCR:** The file is routed via Netlify Serverless Functions to the Gemini 1.5 Pro Vision model. The model extracts only medication names, dosages, and scheduling times.
3. **JSON Staging UI:** Gemini outputs structured JSON to a temporary staging table. **No data is saved to the database at this point.**
4. **Human Approval:** The `Admin_Caregiver` verifies the staged data against the physical AVS. Once verified, they tap "Approve."
5. **Supabase Write:** Only upon human approval is the sanitized data committed to the Supabase PostgreSQL database.
6. **Caregiver Schedule:** Supabase’s real-time subscriptions instantly push updates to all authorized network nodes.

## 3. Integrated Competitor UI/UX Elements
We are adapting the highest-value, lowest-friction UX patterns to reduce cognitive load.

* **The "My Day" Dashboard (Any.do):** A 24-hour constrained view so caregivers only see immediate tasks.
* **Ruthless Minimalism (Apple HIG):** Dark gray backgrounds and high-contrast typography to reduce visual fatigue.
* **System-Wide Color-Coding (Cozi):** Every user node is assigned a distinct Tailwind color token for instant visual recognition.
* **Frictionless Error Mitigation ("Undo" Architecture):** Every task modification triggers a 5-second localized Framer Motion "Undo" toast to instantly revert the Supabase state.

## 4. The Application Modules (Lean MVP Scope)

* **Module A: The Clinical "My Day" Dashboard:** The 24-hour execution view, strictly populated by approved OCR data. Features large, accessible touch targets for confirming dose administration.
* **Module B: The Shared Care Calendar:** The color-coded, unified schedule for the family network to prevent double-booking.
* **Module C: The Status Update Board:** A simplified, centralized, text-based broadcast channel where Admins can post health updates to the family, replacing fragmented group texts.

## 5. Technology Stack
* **UI/UX Design Engine:** Lovable.dev
* **Frontend:** React 19, Vite, Tailwind CSS, Framer Motion
* **Backend & Database:** Supabase (PostgreSQL, Real-time subscriptions, Auth)
* **Hosting & API:** Netlify (Continuous deployment + Serverless Functions)
* **AI Engine:** Gemini 1.5 Pro (Vision model for OCR)