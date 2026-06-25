# Deployment Guide

**Trstprep V2.0 - Multi-Platform Deployment**

---

## Architecture Overview

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   User Frontend     │    │    Admin Panel      │    │     Backend API     │
│   (Vercel)          │    │    (Vercel)         │    │     (Railway)       │
│   app.trstprep.com  │    │   admin.trstprep.com│    │   api.trstprep.com  │
└─────────┬───────────┘    └─────────┬───────────┘    └─────────┬───────────┘
          │                          │                          │
          │     All API requests     │     All API requests     │
          └──────────────────────────┼──────────────────────────┘
                                     │
                          ┌──────────┴───────────┐
                          │   PostgreSQL (Supabase) │
                          │   Redis (Upstash)       │
                          └─────────────────────────┘
```

---

## Phase 1: Backend Deployment (Railway/Render)

### 1.1 Prerequisites
- Supabase project with PostgreSQL database
- Upstash Redis account (for caching/queues)
- Railway or Render account

### 1.2 Environment Variables

Set these in your Railway/Render dashboard:

```bash
# Server
NODE_ENV=production
PORT=5001

# Database
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres

# JWT (generate strong secret)
JWT_SECRET=<64-char-random-hex-string>

# CORS Origins
FRONTEND_URL=https://app.trstprep.com
ADMIN_PANEL_URL=https://admin.trstprep.com

# Optional: Admin API Key
ADMIN_API_KEY=<strong-random-secret>

# Email (configure your provider)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxx
FROM_EMAIL=noreply@trstprep.com

# SMS (configure your provider)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

### 1.3 Deploy to Railway
1. Connect GitHub repo to Railway
2. Select `apps/backend` as root directory
3. Add environment variables
4. Deploy - Railway auto-detects Node.js

---

## Phase 2: User Frontend Deployment (Vercel)

### 2.1 Prerequisites
- Vercel account
- Backend API URL from Phase 1

### 2.2 Environment Variables
Set in Vercel project settings:

```bash
VITE_API_URL=https://api.trstprep.com
VITE_APP_NAME=Trstprep
VITE_ADMIN_URL=https://admin.trstprep.com
```

### 2.3 Deploy Steps
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd apps/frontend
vercel --prod
```

### 2.4 Custom Domain
1. In Vercel dashboard, add domain `app.trstprep.com`
2. Update DNS records per Vercel instructions
3. Wait for SSL certificate provisioning

---

## Phase 3: Admin Panel Deployment (Vercel)

### 3.1 Environment Variables
Set in Vercel project settings (separate project):

```bash
VITE_API_URL=https://api.trstprep.com
VITE_ADMIN_URL=https://admin.trstprep.com
VITE_ADMIN_API_KEY=<same-as-backend-ADMIN_API_KEY>
```

### 3.2 Deploy Steps
```bash
# Deploy admin panel
cd apps/admin-panel
vercel --prod
```

### 3.3 Custom Domain
1. In Vercel dashboard, add domain `admin.trstprep.com`
2. Update DNS records
3. Verify X-Robots-Tag header is set (noindex, nofollow)

---

## Phase 4: Post-Deployment Checklist

### Security
- [ ] Database password rotated in Supabase
- [ ] JWT_SECRET is 64+ characters
- [ ] ADMIN_API_KEY set in both backend and admin panel
- [ ] CORS restricted to production domains only
- [ ] HTTPS enabled on all domains
- [ .env files NOT committed to git

### Testing
- [ ] User can register/login at app.trstprep.com
- [ ] Admin can login at admin.trstprep.com
- [ ] Admin API returns 403 when accessed from user frontend
- [ ] /admin/* redirects to admin panel URL
- [ ] All API endpoints respond correctly
- [ ] Email notifications working
- [ ] SMS OTP working

### Monitoring
- [ ] Error logging configured (Sentry/LogRocket)
- [ ] API health endpoint monitored (/api/health)
- [ ] Database backups automated
- [ ] SSL certificate expiry alerts set

---

## Troubleshooting

### CORS Errors
- Verify `FRONTEND_URL` and `ADMIN_PANEL_URL` match deployed domains exactly
- Check CORS headers in browser dev tools

### Admin Panel 403 Errors
- Verify `X-Admin-API-Key` header matches backend `ADMIN_API_KEY`
- Check admin user has `role: 'admin'` in database

### Frontend Build Failures
- Ensure all environment variables are set in Vercel
- Check `VITE_API_URL` uses HTTPS in production

---

## Quick Deploy Commands

```bash
# Deploy all
cd apps/backend && vercel --prod
cd ../frontend && vercel --prod
cd ../admin-panel && vercel --prod
```
