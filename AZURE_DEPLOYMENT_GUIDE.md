# Microsoft Azure Deployment Guide for eReceipt System

This guide outlines step-by-step instructions for hosting the **eReceipt** full-stack system on **Microsoft Azure**.

The application consists of:
1. **Frontend**: React 19 + TypeScript SPA served via high-performance Nginx on port 80 with reverse proxy for `/api/`.
2. **Backend**: Node.js 20 + Express TypeScript REST API on port 5000.
3. **Database**: PostgreSQL 16 (Azure Database for PostgreSQL Flexible Server or containerized).
4. **Storage**: Persistent storage for merchant license document uploads (`/app/uploads/licenses`) and JSON persistence (`/app/data`).

---

## Deployment Architecture Overview

```
                          Internet (HTTPS)
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │ Azure Container Apps  │
                     │  (or App Service)     │
                     │  Frontend (Nginx)     │
                     │  Port 80 (Public URL) │
                     └───────────┬───────────┘
                                 │ Reverse Proxy (/api/*)
                                 ▼
                     ┌───────────────────────┐
                     │ Azure Container Apps  │
                     │   Backend API (Node)  │
                     │  Port 5000 (Internal) │
                     └───────────┬───────────┘
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
┌─────────────────────────┐               ┌─────────────────────────┐
│ Azure Database for      │               │ Azure Files Storage     │
│ PostgreSQL Flexible     │               │ (Persistent Mounts:     │
│ Server (Port 5432)      │               │  /app/uploads/licenses) │
└─────────────────────────┘               └─────────────────────────┘
```

---

## Prerequisites

1. An active [Azure Account](https://azure.microsoft.com/).
2. You do **not** need Docker installed locally on Windows. You can use **Azure Cloud Shell** (in your browser) or the **Azure Portal**.

---

## Method 1: Azure Container Apps (Recommended & Cost-Effective)

Azure Container Apps provides a serverless container platform with automatic HTTPS, custom domains, and free monthly tier.

### Step 1: Open Azure Cloud Shell
1. Log in to [portal.azure.com](https://portal.azure.com).
2. Click the **Cloud Shell** icon `>_` at the top right of the Azure portal (choose **Bash**).

### Step 2: Set Environment Variables
In the Cloud Shell terminal, configure your deployment variables:
```bash
RESOURCE_GROUP="rg-ereceipt-prod"
LOCATION="eastus"                      # or northeurope, westeurope, etc.
ACR_NAME="acrereceipt$RANDOM"          # must be globally unique alphanumeric
ENVIRONMENT_NAME="cae-ereceipt-env"
```

### Step 3: Create Resource Group & Azure Container Registry (ACR)
```bash
# 1. Create Resource Group
az group create --name $RESOURCE_GROUP --location $LOCATION

# 2. Create Container Registry (Basic SKU)
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true

# 3. Get ACR Credentials
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer --output tsv)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" --output tsv)
```

### Step 4: Clone Your Repository in Azure Cloud Shell & Build Images in the Cloud
Because Azure builds the containers in the cloud using ACR Tasks, you do **not** need Docker on your Windows machine:
```bash
# Clone the repository
git clone https://github.com/<your-username>/<your-repo>.git ereceipt
cd ereceipt

# Checkout your latest branch
git checkout Fani

# Build Backend Image in Azure Cloud
az acr build --registry $ACR_NAME --image ereceipt-backend:latest ./Backend

# Build Frontend Image in Azure Cloud
az acr build --registry $ACR_NAME --image ereceipt-frontend:latest ./Frontend/ereceipt
```

### Step 5: Provision Azure Database for PostgreSQL Flexible Server
```bash
DB_SERVER_NAME="psql-ereceipt-$RANDOM"
DB_ADMIN="ereceiptadmin"
DB_PASSWORD="ChangeThisStrongPassword123!"

az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --location $LOCATION \
  --admin-user $DB_ADMIN \
  --admin-password $DB_PASSWORD \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16 \
  --yes

# Allow Azure Services to connect to PostgreSQL
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --rule-name AllowAllAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Create application database
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $DB_SERVER_NAME \
  --database-name ereceipt
```

Connection string format:
`postgresql://ereceiptadmin:ChangeThisStrongPassword123!@psql-ereceipt-xxxxx.postgres.database.azure.com:5432/ereceipt?sslmode=require`

### Step 6: Create Container Apps Environment & Deploy Services
```bash
# 1. Create Container Apps Managed Environment
az containerapp env create \
  --name $ENVIRONMENT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# 2. Deploy Backend Container App
DATABASE_URL="postgresql://${DB_ADMIN}:${DB_PASSWORD}@${DB_SERVER_NAME}.postgres.database.azure.com:5432/ereceipt?sslmode=require"

az containerapp create \
  --name ereceipt-backend \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image ${ACR_LOGIN_SERVER}/ereceipt-backend:latest \
  --registry-server $ACR_LOGIN_SERVER \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --target-port 5000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars \
    PORT=5000 \
    NODE_ENV=production \
    CORS_ORIGIN="*" \
    DATABASE_URL="$DATABASE_URL" \
    RESEND_API_KEY="" \
    RESEND_FROM_EMAIL="eReceipt Tax Portal <onboarding@resend.dev>"

# Get the Backend Public FQDN
BACKEND_URL=$(az containerapp show --name ereceipt-backend --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)
echo "Backend URL: https://${BACKEND_URL}"

# 3. Deploy Frontend Container App
az containerapp create \
  --name ereceipt-frontend \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image ${ACR_LOGIN_SERVER}/ereceipt-frontend:latest \
  --registry-server $ACR_LOGIN_SERVER \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --target-port 80 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi

# Get the Frontend Public URL
FRONTEND_URL=$(az containerapp show --name ereceipt-frontend --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)
echo "Your live eReceipt App is ready at: https://${FRONTEND_URL}"
```

---

## Method 2: Azure App Service for Containers (Docker Compose)

Azure App Service allows deploying the entire stack in one unit using `docker-compose.yml`.

### Step 1: Create an App Service Plan (Linux)
```bash
az appservice plan create \
  --name plan-ereceipt-prod \
  --resource-group $RESOURCE_GROUP \
  --is-linux \
  --sku B1
```

### Step 2: Deploy Multi-Container App
```bash
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan plan-ereceipt-prod \
  --name ereceipt-portal-prod \
  --multicontainer-config-type COMPOSE \
  --multicontainer-config-file docker-compose.yml
```

### Step 3: Configure Application Settings
In Azure Portal:
1. Navigate to your Web App (`ereceipt-portal-prod`).
2. Go to **Settings** > **Environment variables**.
3. Add:
   - `DATABASE_URL`: `postgresql://...`
   - `NODE_ENV`: `production`
   - `WEBSITES_PORT`: `80`

---

## Method 3: Azure Portal GUI (No Command Line Needed)

If you prefer using the browser without typing commands:

1. **Create Resource Group**:
   - Go to [Azure Portal](https://portal.azure.com) -> Search **Resource groups** -> **Create**.
2. **Create Azure Container Registry**:
   - Search **Container registries** -> **Create** -> Name it (e.g. `acrereceipt123`).
3. **Create Database**:
   - Search **Azure Database for PostgreSQL flexible servers** -> **Create**.
   - Note the username, password, and host.
4. **Deploy Web App for Containers**:
   - Search **App Services** -> **Create** -> **Web App**.
   - Select **Docker Container** -> **Linux**.
   - Under the **Docker** tab, select **Docker Compose** or **Single Container** pointing to your ACR image.
   - Enter your environment variables (`DATABASE_URL`, `PORT=5000`).

---

## Initializing Database Schema & Seed Data

Once PostgreSQL is running on Azure, apply the schema and seed files located in `Backend/src/database/`:
- `Backend/src/database/schema.sql`
- `Backend/src/database/seed.sql`

In Cloud Shell:
```bash
psql "$DATABASE_URL" -f ./Backend/src/database/schema.sql
psql "$DATABASE_URL" -f ./Backend/src/database/seed.sql
```

---

## Custom Domain & Free SSL on Azure

1. In the Azure Portal, open your Frontend **Container App** or **App Service**.
2. Under **Settings**, select **Custom domains**.
3. Add your custom domain (e.g., `receipts.yourorganization.gov.et` or `app.yourdomain.com`).
4. Select **Add Managed Certificate** to get a free, auto-renewing Microsoft Azure SSL/TLS certificate.
