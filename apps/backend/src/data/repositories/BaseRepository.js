import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js';

// Base Repository Class
export class BaseRepository {
  constructor(collectionName) {
    this.collectionName = collectionName;
  }

  // Find all documents
  findAll() {
    return dbHelpers.find(this.collectionName, {});
  }

  // Find documents by criteria
  find(criteria = {}) {
    return dbHelpers.find(this.collectionName, criteria);
  }

  // Find one document by criteria
  findOne(criteria = {}) {
    return dbHelpers.findOne(this.collectionName, criteria);
  }

  // Find document by ID
  findById(id) {
    return dbHelpers.findById(this.collectionName, id);
  }

  // Create new document
  create(data) {
    return dbHelpers.insertOne(this.collectionName, data);
  }

  // Update document by ID
  updateById(id, data) {
    return dbHelpers.updateById(this.collectionName, id, data);
  }

  // Update documents by criteria (fetches matching IDs, then updates each)
  async updateMany(criteria, data) {
    const items = await dbHelpers.find(this.collectionName, criteria);
    const results = [];
    for (const item of items) {
      const updated = await dbHelpers.updateById(this.collectionName, item.id, data);
      results.push(updated);
    }
    return results;
  }

  // Delete document by ID
  deleteById(id) {
    return dbHelpers.deleteById(this.collectionName, id);
  }

  // Delete documents by criteria
  deleteMany(criteria) {
    return dbHelpers.deleteMany(this.collectionName, criteria);
  }

  // Count documents
  async count(criteria = {}) {
    const results = await dbHelpers.find(this.collectionName, criteria);
    return results.length;
  }

  // Check if document exists
  async exists(criteria) {
    const result = await dbHelpers.findOne(this.collectionName, criteria);
    return result !== null;
  }
}
