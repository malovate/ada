# Ada — Full Deployment Guide
# ============================================================
# After following this guide:
#   - Ada's brain runs 24/7 on Railway (free)
#   - Ada's interface is live on Netlify (free)
#   - Ada thinks in the background even when you're offline
#   - You can open Ada from any browser or install as a PWA
# ============================================================


## PART 1 — Push your code to GitHub
# GitHub is how Railway and Netlify pull your code.
# They watch your repo and auto-deploy when you push changes.

# 1a. Create a free account at github.com if you don't have one.

# 1b. Create a new PRIVATE repository called 'ada'.
#     Private = only you can see it. This is important because
#     your code references secret keys (even though keys are in .env,
#     not in the code itself — good habit to keep the repo private).

# 1c. In your terminal, from the root 'ada' folder:
git init
git add .
git commit -m "Ada - initial build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ada.git
git push -u origin main

# Replace YOUR_USERNAME with your actual GitHub username.


## PART 2 — Deploy the backend to Railway
# Railway runs your Python server 24/7 in the cloud.

# Step 1: Create account at railway.app (free, use GitHub login)

# Step 2: Click "New Project" → "Deploy from GitHub repo"
#         Select your 'ada' repository.
#         Railway detects it's a Python project automatically.

# Step 3: Set the ROOT DIRECTORY to 'backend'
#         Railway needs to know the backend is not in the root folder.
#         In Railway dashboard: Settings → Source → Root Directory → backend

# Step 4: Add a Persistent Volume (this is critical for Ada's memory)
#         In Railway dashboard: Your service → Volumes tab
#         Click "Add Volume"
#         Mount path: /data
#         This creates a folder that SURVIVES restarts.
#         Ada's database and ChromaDB files will live here.

# Step 5: Set Environment Variables
#         In Railway dashboard: Your service → Variables tab
#         Add each of these (click "New Variable" for each):

ANTHROPIC_API_KEY    = sk-ant-your-actual-key
OPENAI_API_KEY       = sk-your-openai-key
DATA_DIR             = /data
ENVIRONMENT          = production

# Step 6: Railway deploys automatically. Watch the build logs.
#         When you see "Ada is ready." in the logs, she's live.

# Step 7: Copy your Railway URL.
#         In Railway: Settings → Domains → your URL
#         It looks like: https://ada-production-xxxx.railway.app
#         Test it: open that URL in your browser.
#         You should see: {"status": "Ada is alive", "mood": "..."}


## PART 3 — Update the webapp with your Railway URL

# Open: webapp/.env.production
# Replace the placeholder URL:
VITE_BACKEND_URL=https://YOUR-RAILWAY-URL.railway.app
# With your actual Railway URL:
VITE_BACKEND_URL=https://ada-production-xxxx.railway.app

# Save the file.


## PART 4 — Deploy the webapp to Netlify

# Step 1: Create a free account at netlify.com (use GitHub login)

# Step 2: Click "Add new site" → "Import an existing project"
#         → Connect to GitHub → Select your 'ada' repo

# Step 3: Netlify reads netlify.toml automatically.
#         It knows: base=webapp, command=npm run build, publish=dist
#         You don't need to configure anything manually.

# Step 4: Add your environment variable in Netlify:
#         Site settings → Environment variables → Add variable:
#         Key:   VITE_BACKEND_URL
#         Value: https://your-railway-url.railway.app

# Step 5: Click "Deploy site". Netlify builds and deploys.
#         You get a URL like: https://ada-paul.netlify.app

# Step 6 (optional): Rename your Netlify site.
#         Site settings → General → Site name → change to "ada-paul" or similar


## PART 5 — Install Ada as a PWA on your Android phone

# 1. Open Chrome on your Android phone
# 2. Go to your Netlify URL: https://ada-paul.netlify.app
# 3. Tap the three dots menu (⋮) in Chrome
# 4. Tap "Add to Home screen"
# 5. Tap "Add"
# Ada appears on your home screen like a native app.
# Open it — full screen, no browser bar, just Ada.


## PART 6 — Verify everything works

# Checklist:
# [ ] Railway URL returns {"status": "Ada is alive"} in browser
# [ ] Netlify URL shows Ada's chat interface
# [ ] Sending a message gets a reply from Ada
# [ ] Voice recording button works (Chrome only — Firefox blocks mic on non-HTTPS, but Netlify uses HTTPS automatically)
# [ ] PWA is installed on your phone home screen


## AUTO-DEPLOYMENT (the best part)
# After this setup, every time you:
#   git add .
#   git commit -m "updated Ada's personality"
#   git push
#
# BOTH Railway and Netlify detect the push and redeploy automatically.
# Zero manual steps after initial setup.
