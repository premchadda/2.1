import fs from 'fs';

// Fix Settings.jsx "Unlock all" p tag indentation
const settingsPath = 'apps/frontend/src/pages/dashboard/Settings.jsx';
let settingsContent = fs.readFileSync(settingsPath, 'utf8');
settingsContent = settingsContent.replace(
  '                <p className="text-xs text-slate-300 mb-3 leading-relaxed">\n                  Unlock all',
  '              <p className="text-xs text-slate-300 mb-3 leading-relaxed">Unlock all'
);
fs.writeFileSync(settingsPath, settingsContent, 'utf8');
console.log('Fixed Settings.jsx indentation');
