const files1 = [
  '000_baseline_functions.sql',
  '000-enable_rls_policies.sql',
  '001_create_admin_feature_tables.sql'
];

const files2 = [
  '000_baseline_functions.sql',
  '000a_enable_rls_policies.sql',
  '001_create_admin_feature_tables.sql'
];

const sort = arr => [...arr].sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));

console.log('Sorted hyphens:', sort(files1));
console.log('Sorted letters:', sort(files2));
