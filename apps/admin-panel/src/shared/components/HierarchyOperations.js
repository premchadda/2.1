/**
 * Hierarchy Operations Utility
 * Bulk operations, cloning, importing, versioning
 */

/**
 * Recursively clone a hierarchy branch with new IDs
 */
export const cloneHierarchyBranch = (node, newParentId, level = 0) => {
  const cloned = {
    ...node,
    id: undefined,
    _id: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    parentId: newParentId,
    cloned: true,
    name: `${node.name || node.title} (Copy)`,
  };

  if (node.children) {
    cloned.children = node.children.map(child => 
      cloneHierarchyBranch(child, undefined, level + 1)
    );
  }

  return cloned;
};

/**
 * Collect all descendant node IDs from a branch
 */
export const collectBranchIds = (node, getId = item => item.id) => {
  const ids = [getId(node)];
  
  if (node.children) {
    node.children.forEach(child => {
      ids.push(...collectBranchIds(child, getId));
    });
  }
  
  return ids;
};

/**
 * Bulk delete handler with batching for large branches
 */
export const bulkDeleteBranch = async (node, deleteFn, batchSize = 50) => {
  const allIds = collectBranchIds(node);
  
  // Delete children first (reverse order)
  const reversedIds = allIds.reverse();
  
  for (let i = 0; i < reversedIds.length; i += batchSize) {
    const batch = reversedIds.slice(i, i + batchSize);
    await Promise.all(batch.map(id => deleteFn(id)));
  }
  
  return allIds;
};

/**
 * Import CSV structure
 */
export const importFromCSV = (csvText) => {
  const lines = csvText.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = values[idx]?.trim() || '';
    });
    return obj;
  });
};

/**
 * Import JSON hierarchy
 */
export const importFromJSON = (jsonText) => {
  return JSON.parse(jsonText);
};

/**
 * Generate version snapshot
 */
export const createVersionSnapshot = (hierarchyData, label = '') => {
  return {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    label,
    data: JSON.parse(JSON.stringify(hierarchyData)),
    checksum: btoa(JSON.stringify(hierarchyData).length),
  };
};

export default {
  cloneHierarchyBranch,
  collectBranchIds,
  bulkDeleteBranch,
  importFromCSV,
  importFromJSON,
  createVersionSnapshot,
};