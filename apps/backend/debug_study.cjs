const fs = require('fs')

const filePath = 'e:\\Tech\\Testprep\\Trstprep V2.1\\apps\\backend\\src\\api\\routes\\study.js'
let content = fs.readFileSync(filePath, 'utf8')

content = content.replace(
  "const chapters = await dbHelpers.find('chapters', { subjectId, isActive: true })",
  "const chapters = await dbHelpers.find('chapters', { subjectId, isActive: true }); console.log('RESOLVED CHAPTERS FOR subjectId:', subjectId, chapters.length)"
)

content = content.replace(
  "chaptersCount = chapters.length",
  "chaptersCount = chapters.length; console.log('COUNTS CHAPTERS FOR subjectId:', subjectId, chapters.length);"
)

fs.writeFileSync(filePath, content, 'utf8')
