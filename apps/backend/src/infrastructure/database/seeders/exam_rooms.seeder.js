import BaseSeeder from './BaseSeeder.js';

export default class ExamRoomsSeeder extends BaseSeeder {
  static table = 'exam_rooms';
  static fixtureFile = 'exam_rooms.json';
  static columns = [
    'id', 'exam_name', 'exam_type', 'exam_date', 'room_code',
    'description', 'is_active', 'created_by',
  ];

  static conflictTarget() {
    return 'id';
  }
}
