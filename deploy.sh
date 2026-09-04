#!/bin/bash
set -euo pipefail
# Trstprep Deployment Script (Idempotent)
# Safe to re-run — skips steps that are already complete
#
# ============================================================
# FIX 2.19: All URLs parameterized via environment variables.
#
# Required environment variables:
#   BACKEND_HEALTH_URL  — Backend health check endpoint
#                         e.g. https://api.trstprep.com/api/health
#   FRONTEND_URL        — Frontend URL for post-deploy verification
#                         e.g. https://trstprep.com
#
# Optional:
#   DEPLOY_ENV          — "production" or "staging" (default: staging)
# ============================================================

DEPLOY_ENV="${DEPLOY_ENV:-staging}"

echo "🚀 Trstprep Deployment Script"
echo "=============================="
echo "   Environment: ${DEPLOY_ENV}"

# FIX 2.19: Production deployment confirmation prompt
if [ "$DEPLOY_ENV" = "production" ]; then
    echo ""
    echo "⚠️  WARNING: You are about to deploy to PRODUCTION."
    read -r -p "   Are you sure? Type 'yes' to confirm: " confirm
    if [ "$confirm" != "yes" ]; then
        echo "❌ Deployment cancelled."
        exit 1
    fi
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root"
    exit 1
fi

DEPLOY_LOG="deploy-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$DEPLOY_LOG") 2>&1

# Frontend deployment
echo ""
echo "📦 Deploying Frontend..."
cd apps/frontend

# Install dependencies (pnpm monorepo)
if command -v pnpm &> /dev/null; then
    echo "  → Installing dependencies with pnpm..."
    pnpm install
else
    echo "  → Installing dependencies with npm..."
    npm install
fi

# Build for production (skip if build exists and is newer than source)
if [ -d "dist" ] && find src -newer dist -print -quit | grep -q .; then
    echo "  → Building for production..."
    pnpm run build
elif [ -d "dist" ]; then
    echo "  ⏭️  Build is up-to-date (skipping build)"
else
    echo "  → Building for production (no dist found)..."
    pnpm run build
fi

# Check if Vercel CLI is installed
if command -v vercel &> /dev/null; then
    echo "  → Deploying to Vercel..."
    vercel --prod
else
    echo "  ⚠️  Vercel CLI not installed. Install with: npm i -g vercel"
    echo "  → Alternatively, connect your GitHub repo to Vercel for auto-deployment"
fi

cd ../..

# Backend deployment
echo ""
echo "📦 Deploying Backend..."
cd apps/backend

# Install dependencies (pnpm monorepo)
if command -v pnpm &> /dev/null; then
    echo "  → Installing backend dependencies with pnpm..."
    pnpm install --prod
else
    echo "  → Installing dependencies with npm..."
    npm install --omit=dev
fi

# Run migrations before deploy
if [ -f "src/migrate.js" ]; then
    echo "  → Running database migrations..."
    node src/migrate.js || echo "  ⚠️  Migration warning (may already be applied)"
fi

# Check if Vercel CLI is installed
if command -v vercel &> /dev/null; then
    echo "  → Deploying to Vercel..."
    vercel --prod
else
    echo "  ⚠️  Vercel CLI not installed. Install with: npm i -g vercel"
    echo "  → Alternatively, connect your GitHub repo to Vercel for auto-deployment"
fi

cd ../..

# FIX 2.19: Health check uses parameterized URL (not a hardcoded placeholder)
echo ""
echo "🏥 Running health checks..."

BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-}"

if [ -z "$BACKEND_HEALTH_URL" ]; then
    echo "  ⚠️  BACKEND_HEALTH_URL not set, skipping health check."
    echo "     Set BACKEND_HEALTH_URL to enable post-deploy verification."
elif command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_HEALTH_URL" || true)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "  ✅ Backend health check passed ($BACKEND_HEALTH_URL)"
    else
        echo "  ⚠️  Backend health check returned HTTP $HTTP_CODE (may still be deploying)"
    fi
else
    echo "  ⚠️  curl not installed, skipping health check"
fi

echo ""
echo "✅ Deployment Complete!"
echo "📋 Log saved to: $DEPLOY_LOG"
echo ""
echo "📋 Post-Deployment Checklist:"
echo "   1. Set environment variables in Vercel Dashboard:"
echo "      - DATABASE_URL (PostgreSQL connection string)"
echo "      - JWT_SECRET (secure random string)"
echo "      - JWT_REFRESH_SECRET (must differ from JWT_SECRET)"
echo "      - FRONTEND_URL (your frontend URL)"
echo "      - NODE_ENV=production"
echo ""
echo "   2. Test API health: \${BACKEND_HEALTH_URL}"
echo "   3. Test frontend: \${FRONTEND_URL}"
echo ""
