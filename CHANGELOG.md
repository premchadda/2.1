# Changelog

## 2026-03-31 - Repository Audit Fixes

### Critical Fixes
- Fixed adminApi.js localStorage authentication contradiction
- Fixed missing ActivityOrderReport export
- Deleted duplicate insecure AuthContext
- Fixed hardcoded localhost URLs in .env files
- Fixed password hash exposure in UserRepository
- Fixed Vite proxy hardcoded to localhost
- Fixed localStorage usage in AdminLayout logout
- Fixed localStorage fallback in ComingSoonManager

### High Severity Fixes
- Removed mock response fallback in ContentManagement
- Added environment variable validation
- Removed password output from seed files
- Created shared-hooks package
- Removed VITE_ADMIN_API_KEY exposure
- Removed console.log from apiBase.js
- Added WebSocket reconnection backoff
- Deleted seedData.js duplicate

### Medium Severity Fixes
- Created docker-compose.yml
- Created .env.example files
- Removed debug logging from dataService
- Cleaned temp files from dev-tools
- Removed duplicate knip report

---
