#!/bin/bash
# Trstprep Deployment Script
# Run this script to deploy frontend and backend

echo "🚀 Trstprep Deployment Script"
echo "=============================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root"
    exit 1
fi

# Frontend deployment
echo ""
echo "📦 Deploying Frontend..."
cd apps/frontend

# Install dependencies
echo "  → Installing dependencies..."
npm install

# Build for production
echo "  → Building for production..."
npm run build

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

# Install dependencies
echo "  → Installing dependencies..."
npm install

# Check if Vercel CLI is installed
if command -v vercel &> /dev/null; then
    echo "  → Deploying to Vercel..."
    vercel --prod
else
    echo "  ⚠️  Vercel CLI not installed. Install with: npm i -g vercel"
    echo "  → Alternatively, connect your GitHub repo to Vercel for auto-deployment"
fi

cd ../..

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📋 Post-Deployment Checklist:"
echo "   1. Set environment variables in Vercel Dashboard:"
echo "      - DATABASE_URL (PostgreSQL connection string)"
echo "      - JWT_SECRET (secure random string)"
echo "      - FRONTEND_URL (your frontend URL)"
echo "      - NODE_ENV=production"
echo ""
echo "   2. Test API health: https://your-backend.vercel.app/api/health"
echo "   3. Test frontend: https://your-frontend.vercel.app"
echo ""