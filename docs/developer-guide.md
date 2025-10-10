# Developer Guide: Humphries & Parks DMS

## Purpose
This document provides developers with the technical structure, logic flow, and setup details for maintaining and expanding the Humphries & Parks Dealer Management System (hnpsystem).

---

## 1. Project Setup
- Framework: **Next.js (React-based)**
- Backend: **Node.js / Express (planned for API integration)**
- Database: **Cloud-hosted MongoDB**
- Authentication: **Keycloak (SSO, cloud-hosted)**
- Hosting: **Cloud (Vercel or AWS)**
- UI Libraries: **Tailwind CSS + custom components**

---

## 2. Folder Structure
/src
├── components/         # UI and logic components
│    ├── Layout.js
│    ├── JobCards/
│    ├── Clocking/
│    ├── Parts/
│    ├── Dashboard/
│    └── Messaging/
│
├── context/            # Global context providers (User, Jobs, Parts)
│    ├── UserContext.js
│    ├── JobsContext.js
│    └── PartsContext.js
│
├── pages/
│    ├── index.js
│    ├── accounts/
│    │    ├── Account.js
│    │    └── EditProfile.js
│    ├── job-cards/
│    │    ├── create/
│    │    └── [jobNumber].js
│    ├── parts/
│    ├── dashboard/
│    └── messaging/
│
└── utils/              # Helper functions and constants
---

## 3. Authentication & Roles
- **Keycloak SSO** handles login and user identity.
- Role-based permissions:
  - **Admin:** Full access, manage users, view logs.
  - **Manager:** Approve jobs and parts, view reports.
  - **Technician:** Create and manage job cards, clock in/out.
  - **Parts Staff:** Handle parts requests, manage inventory.
  - **Sales Staff:** Manage sales tracking and car data.

---

## 4. Core Modules
1. **Job Cards**
   - Create job cards with optional “Add Check Sheet” pop-up.
   - Allows vehicle, customer, and technician details.
   - VHC checklists (brakes, tyres, underside, under bonnet, cosmetics, electronics).
2. **Clocking System**
   - Tracks live time per technician.
   - Real-time status shown in dashboard.
3. **Parts Management**
   - Request, approve, or deny parts.
   - Notifies technician via in-app + email.
   - Logs all parts actions.
4. **Sales Tracking**
   - Tracks sales by user.
   - Video creation stats.
5. **Messaging**
   - In-app messaging between users and departments.
   - Notification-based (pop-ups and alerts).
6. **Dashboard**
   - Displays job counts, user activity, and KPIs.
   - Role-based display (e.g. managers see totals, techs see active jobs).
7. **User Management**
   - Admin-only page to add/remove users.
   - View logs and assign roles.

---

## 5. Notifications
- In-app alerts + email integration.
- Triggers:
  - Parts ready
  - Job updates
  - User mentions
  - System alerts

---

## 6. Data Logging
Every user action is stored:
- Job creation/edit/deletion
- Parts requests
- Clocking changes
- Messaging actions
- Admin updates

---

## 7. Integration Points
- **Navigation Integration:** Technician clock times.
- **Auto Stock Integration:** Vehicle tracking through the process.

---

## 8. Deployment
- Cloud-hosted via Vercel or AWS.
- Environment variables for:
  - DB connection
  - Keycloak credentials
  - SMTP (notifications)

---

## 9. UI/UX Standards
- Modern, clean interface.
- Red accent color.
- Responsive (mobile + desktop).
- Consistent modal and popup layout.

---

## 10. Development Tips
- Keep UI modular and reusable.
- Use contexts for shared state (Jobs, Parts, User).
- Always log actions for traceability.
- Follow role-based access rules when creating new pages.

---

## 11. Future Expansion
- AI-assisted diagnostics (optional).
- Real-time performance graphs.
- Parts barcode scanning.
- Service history per VIN.
- Reporting module for management KPIs.

---

## 12. Quick Summary of Key System Points
1. Cloud-based DMS for all departments.
2. Fully paper-free job workflow.
3. Real-time job and parts tracking.
4. Role-based permissions.
5. Keycloak SSO integration.
6. Digital job cards with optional check sheets.
7. Technician clocking system.
8. VHC checklists with customizable fields.
9. Separate parts department workflow.
10. Dashboard with live stats.
11. Sales tracking per salesperson.
12. Messaging and notifications.
13. Action logging and transparency.
14. Admin user management.
15. Red-accent UI with clean design.
16. Mobile + web accessibility.
17. Integration with Navigation and Auto Stock.
18. Cloud deployment for scalability.