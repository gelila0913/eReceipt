# eReceipt — Digital Receipt Management System

**eReceipt** is a digital receipt management system designed to modernize receipt issuance, improve transaction transparency, and simplify merchant registration and tax administration. The platform aims to reduce reliance on paper receipts while making receipts easier to access, verify, and manage.

---

## 🚀 Live Releases & Production Deployments

The system is fully containerized and hosted live on **Microsoft Azure Container Apps** with automated GitHub Actions CI/CD:

| Portal | Live Release URL | Description | Default Credentials |
|---|---|---|---|
| 👑 **Admin Portal** | [**tinyurl.com/admin-erecipt**](https://tinyurl.com/admin-erecipt) | Tax Authority & Revenue Officer Portal for reviewing merchant applications, approving licenses, and auditing tax invoices | `officer@revenue.gov.et`<br>`Admin#2026` |
| 🛒 **Merchant Portal** | [**tinyurl.com/eReciptL**](https://tinyurl.com/eReciptL) | Business Workspace for merchant onboarding, sales registration, product catalogs, and POS digital receipt issuance | Registered Merchant TIN & Password |
| 🔍 **Public QR Verification** | [**Verify Receipt**](https://ereceipt-frontend.salmonwater-89ba5a67.southafricanorth.azurecontainerapps.io/verify) | Public scanner to view, authenticate, and verify cleared tax receipts | Any scannable receipt QR code |

> [!NOTE]
> All services run on Docker containers orchestrated via Nginx and Express on Azure Container Apps, backed by Azure Database for PostgreSQL Flexible Server.

---

## Team Members

Add the names of the project members below.

| No. | Full Name | Role / Responsibility |
|---:|---|---|
| 1 | *Fanuel Goitom* | *Add role* |
| 2 | *Fiema Yaregal* | *Add role* |
| 3 | *Fikirte Gebretsadik* | *Add role* |
| 4 | *Fuad Aman* | *Add role* |
| 5 | *Gelila Sintayehu* | *Add role* |
| 6 | *Gemechu Teso* | *Add role* |

## Overview

eReceipt provides a platform where merchants can manage their businesses and issue digital receipts, while authorized tax administrators (Gebiwoch) review merchant registrations and oversee compliance-related activities.

The system has two primary interfaces:

- **Merchant Portal:** For business registration, receipt issuance, and transaction management.
- **Admin Portal:** For reviewing merchant applications, managing merchant accounts, and overseeing receipt-related activities.

## Objectives

- Digitize the receipt issuance and management process.
- Reduce paper-based receipt handling and recordkeeping.
- Make receipts easier to verify using QR codes.
- Enable tax administrators to review and approve merchant registrations.
- Improve transaction traceability and record management.
- Support more transparent and efficient tax administration.

## Core Features

### 1. Merchant Portal

- Merchant registration and authentication.
- Business profile and tax identification number (TIN) management.
- Digital receipt creation and issuance.
- Transaction and receipt history.
- QR-code-based receipt verification.
- Receipt status tracking, including voided receipts where applicable.
- Access to business and transaction records.

### 2. Admin Portal

- Secure administrator login.
- Dashboard displaying merchant registration and approval statistics.
- List of pending merchant applications.
- Merchant information and submitted-document review.
- Merchant application approval or rejection.
- Rejection reasons and application status management.
- Merchant account management.
- Receipt oversight and verification support.

### 3. Digital Receipt Management

- Generate digital receipts for completed transactions.
- Assign a unique identifier to each receipt.
- Generate QR codes for receipt verification.
- Store and retrieve receipt records.
- Display receipt details, including merchant information, items, quantities, totals, applicable taxes, and customer identification (mandatory 10-digit TIN for B2B; optional TIN and Fayda FIN for B2C).
- Track receipt status and retain appropriate records of voided receipts.

### 4. Receipt Verification & Visual Receipt Image QR Scanning

Customers and authorized users can scan the receipt's QR code with any smartphone camera to immediately load the authentic **visual receipt image** rather than raw text.

The QR code generator supports two output modes:
- **Embedded Web Receipt Viewer (`/?view=receipt-image&irn=...&data=...`):** Full interactive viewer with theme toggle (Modern Invoice / 80mm POS Thermal Slip), Amharic/English bilingual toggle, PNG/SVG download, and thermal printing. The full receipt payload is encoded directly into query parameters, guaranteeing instant rendering even if the device cannot access the backend database.
- **Direct SVG Data URI (`data:image/svg+xml,...`):** Completely self-contained vector graphic encoded directly inside the QR code matrix. When scanned by camera or barcode scanners, it opens natively as a crisp visual receipt image with zero network or server requests.
- **Cross-Device Mobile Access (`0.0.0.0` Binding):** Both the Vite frontend dev server (port 5173) and Express backend (port 5000) bind to `0.0.0.0`, allowing phones and tablets on the same Wi-Fi network to connect via the detected LAN IP address (e.g. `http://192.168.x.x:5173`).
- **MoR Vector Image Endpoint (`/api/receipts/:irn/image`):** Dynamic SVG endpoint rendering high-resolution fiscal receipts on-demand with official Ministry of Revenues clearance stamps and SHA-256 cryptographic signatures.

## System Workflow

### Merchant Registration and Approval

1. A merchant creates an account and submits the required business information.
2. The application is stored with a pending status.
3. An authorized tax administrator signs in to the admin portal.
4. The administrator reviews the merchant's information and supporting documents.
5. The administrator approves the application or rejects it with a reason.
6. The merchant can view the updated application status.
7. Approved merchants gain access to the receipt issuance features permitted by the system.

### Receipt Issuance and Verification

1. An approved merchant records a transaction.
2. The system calculates the transaction total and applicable taxes according to the configured tax rules.
3. The system generates a unique digital receipt and its QR code.
4. The receipt is stored and made available to authorized users.
5. A customer or authorized user scans the QR code.
6. The system retrieves the receipt record and displays its current status and relevant details.

## User Roles

| Role | Responsibilities |
|---|---|
| Merchant | Register a business, manage permitted business information, issue receipts, and view transaction history. |
| Tax Administrator (Gebiwoch) | Review merchant applications, manage merchant approval status, and oversee relevant receipt records. |
| Customer / Receipt Verifier | Scan QR codes and verify receipt information and status. |

Access to administrative operations must be restricted to authorized users.

## Docker Deployment

The entire eReceipt platform is fully containerized with **Docker** and **Docker Compose**, orchestrating PostgreSQL, the Express API backend, and the Nginx-powered React SPA frontend.

### Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │              Docker Host                     │
                      │                                              │
                      │   ┌──────────────────────────────────────┐   │
   Browser :80 / :5173│──▶│  Frontend Container (Nginx + React)  │   │
                      │   └──────────────────┬───────────────────┘   │
                      │                      │ /api/ reverse proxy   │
                      │                      ▼                       │
                      │   ┌──────────────────────────────────────┐   │
   API Client :5000   │──▶│      Backend Container (Express)     │   │
                      │   └──────────────────┬───────────────────┘   │
                      │                      │ SQL connection        │
                      │                      ▼                       │
                      │   ┌──────────────────────────────────────┐   │
   PostgreSQL :5432   │──▶│      PostgreSQL 16 Database          │   │
                      │   │  (Auto-initialized Schema & Seed)    │   │
                      │   └──────────────────────────────────────┘   │
                      └──────────────────────────────────────────────┘
```

### Quick Start with Docker Compose

1. **Clone the repository:**
   ```bash
   git clone https://github.com/gelila0913/eReceipt.git
   cd eReceipt
   ```

2. **Configure environment variables (optional):**
   ```bash
   cp .env.docker.example .env
   ```

3. **Build and start all services:**
   ```bash
   docker compose up --build -d
   ```

4. **Access the application:**
   - **Frontend (Web Application):** [http://localhost](http://localhost) or [http://localhost:5173](http://localhost:5173)
   - **Backend API:** [http://localhost:5000/api](http://localhost:5000/api)
   - **API Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)
   - **PostgreSQL Database:** `localhost:5432` (`db: ereceipt`, `user: postgres`, `pass: postgres`)

5. **Stop containers:**
   ```bash
   docker compose down
   ```
   *(To wipe database volumes and re-seed from scratch, use `docker compose down -v`)*

---

## Merchant Email Verification & Resend Setup

The merchant registration workflow requires 6-digit email OTP verification at Step 1 before advancing to Step 2 (Tax Identity & TIN).

### 1. Development Simulation Mode (Zero Configuration)
By default, if `RESEND_API_KEY` is not provided in `Backend/.env`:
- The backend automatically runs in **simulation mode**.
- The 6-digit verification code is printed to the backend terminal log.
- The registration modal displays a **Simulation / Dev Mode** banner containing the code and an **"Autofill & Verify"** button, ensuring developers and testers are never blocked.
- Verification codes expire after 10 minutes and have a 45-second resend cooldown.

### 2. Live Email Delivery via Resend
To send live verification emails to real inboxes:

1. Create a free account at [resend.com](https://resend.com) and generate an API key.
2. In `Backend/.env`, configure:
   ```env
   RESEND_API_KEY=re_your_api_key_here
   RESEND_FROM_EMAIL=eReceipt <onboarding@resend.dev>
   ```
3. **Important Sandbox Limitation:**
   - Free Resend accounts using the default domain `onboarding@resend.dev` can **only send to the verified account owner email**.
   - If a test user registers with any other email address, the backend gracefully catches the restriction, logs the diagnostic reason, and activates simulation fallback so registration continues seamlessly.
4. **Custom Domain (Production):**
   - Verify your custom domain at [resend.com/domains](https://resend.com/domains) (e.g. `mail.ereceipt.et`).
   - Set `RESEND_FROM_EMAIL=eReceipt Verification <noreply@mail.ereceipt.et>`.
   - Real emails will be delivered to any recipient worldwide.

### 3. OTP API Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/otp/send` | Dispatches 6-digit verification code to email (or generates simulation code) |
| `POST` | `/api/otp/verify` | Validates submitted 6-digit OTP code against session store |
| `POST` | `/api/otp/resend` | Dispatches a new code respecting 45s cooldown |
| `GET` | `/api/otp/status` | Checks if an email has an active verification or pending code |

---

## Revenue Officer & Admin Onboarding

Authorized tax officers and administrators can access the portal via `http://localhost:5173/?view=admin` or by clicking **"Admin"** in the navigation header.

### 1. Officer Registration
New Ministry officers can onboard using the **"Officer Registration"** tab:
- **Full Legal Name**: Official name (minimum 3 characters).
- **Officer Username**: Alphanumeric identifier (3-30 characters).
- **Badge / Employee ID**: Official government badge (e.g. `RO-401`, unique).
- **Official Email**: Government email address (e.g. `officer@mor.gov.et`, unique).
- **Branch & Role**: Assignable branches and roles (`REVENUE_OFFICER`, `SENIOR_AUDITOR`, `ADMIN`).
- **Authorization Declaration**: Mandatory certification checkbox.
- Upon successful submission, an active 24-hour session token is issued, recorded to the audit log, and the officer transitions directly to the workspace.

### 2. Built-in Demo Credentials
| Account | Username | Password | Role |
|---|---|---|---|
| **Fanuel** | `officer.fani` | `Password123` | Revenue Officer |
| **Abebe** | `officer.demo` | `Revenue123` | Senior Tax Auditor |
| **Admin** | `admin` | `Admin123` | System Administrator |

### 3. Admin Authentication Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/auth/register` | Onboards new officer and issues session token |
| `POST` | `/api/admin/auth/login` | Authenticates username/password and dispatches 2FA OTP |
| `POST` | `/api/admin/auth/verify-2fa` | Validates 2FA code and issues bearer token |
| `POST` | `/api/admin/auth/resend-2fa` | Resends 2FA code respecting cooldown |
| `GET` | `/api/admin/auth/check-availability` | Verifies availability of username, badge, or email |
| `GET` | `/api/admin/auth/me` | Returns authenticated officer session details |
| `POST` | `/api/admin/auth/logout` | Invalidates active officer session |

---

## Technology Stack

The following technologies should be updated to reflect the tools actually selected and configured in the repository.

- **UI/UX Design:** Figma
- **Frontend:** *Add technology*
- **Backend:** *Add technology*
- **Database:** *Add technology*
- **Authentication:** Secure role-based authentication
- **QR Code:** QR generation and server-side receipt verification
- **Version Control:** Git and GitHub

## Security and Data Integrity

The system should follow security practices appropriate for a receipt and tax administration platform:

- Secure authentication and authorization.
- Role-based access control for merchants and administrators.
- Server-side validation of transaction and receipt data.
- Secure storage and handling of business information.
- Unique receipt identifiers and reliable QR-code verification.
- Audit records for sensitive administrative actions.
- Protection against unauthorized receipt modification and duplicate issuance.
- Appropriate handling of voided receipts, preserving the original record and its status history.

## Project Status

**Current focus:** UI/UX design and implementation planning.

The merchant interface is being designed in Figma, with the administrator interface planned as a separate set of screens within the same design project. Development will connect the interfaces to a shared backend and database.

Planned development milestones:

- [x] Establish the project concept and core requirements.
- [x] Design merchant-side and admin-side UI/UX.
- [x] Design the admin login, overview, and directory dashboard.
- [x] Design merchant application review, license inspection, and approval workflows.
- [x] Implement authentication and role-based access control.
- [x] Implement merchant registration, email OTP verification, and profile management.
- [x] Implement digital receipt generation, thermal print previews, and persistent storage.
- [x] Implement QR-code-based receipt verification with scannable clear URL.
- [x] Test security, validation, idempotency, and end-to-end workflows.
- [x] Containerize with Docker and deploy to Microsoft Azure with automated CI/CD.

## Future Improvements

Potential future enhancements include:

- Analytics and reporting dashboards.
- Advanced receipt search and filtering.
- Merchant performance and transaction summaries.
- Downloadable digital receipts.
- Notifications for application status changes.
- Integration with authorized tax administration systems, subject to approval and API availability.
- Additional fraud-detection and transaction-monitoring capabilities.

## Contributing

Contributions should follow the repository's development workflow.

1. Fork or clone the repository.
2. Create a feature branch.
3. Make changes and test them locally.
4. Commit changes with clear messages.
5. Open a pull request for review.

Changes to protected branches should go through the configured review and approval process.

## License

The project's license has not yet been specified. A license should be added once the project owner determines the terms under which the source code may be used, modified, and distributed.

---

**eReceipt — Making digital receipts easier to issue, manage, and verify.**
