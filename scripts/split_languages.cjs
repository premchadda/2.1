const fs = require('fs');
const extractText = (html, cls) => {
  if (!html) return '';
  const regex = new RegExp(`<span class="${cls}"[^>]*>([\\s\\S]*?)</span>`, 'g');
  let match;
  let text = '';
  while ((match = regex.exec(html)) !== null) {
    text += match[1].trim() + ' ';
  }
  return text ? text.trim() : (cls === 'eqt' ? html.trim() : '');
};
const data = JSON.parse(fs.readFileSync('questions_uploadable.json', 'utf8'));
const separated = data.map(q => {
  return {
    ...q,
    questionText: extractText(q.questionText, 'eqt'),
    questionTextHi: extractText(q.questionText, 'hqt'),
    optionA: extractText(q.optionA, 'eqt'),
    optionAHi: extractText(q.optionA, 'hqt'),
    optionB: extractText(q.optionB, 'eqt'),
    optionBHi: extractText(q.optionB, 'hqt'),
    optionC: extractText(q.optionC, 'eqt'),
    optionCHi: extractText(q.optionC, 'hqt'),
    optionD: extractText(q.optionD, 'eqt'),
    optionDHi: extractText(q.optionD, 'hqt')
  };
});
fs.writeFileSync('questions_uploadable.json', JSON.stringify(separated, null, 2));
console.log('Separated languages successfully.');
