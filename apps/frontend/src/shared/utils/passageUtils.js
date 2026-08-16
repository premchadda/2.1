export function groupQuestionsByPassage(questions) {
  const groups = []
  const passageMap = new Map()

  questions.forEach((q, index) => {
    const passageKey = q.passageId || q.passage_id || q.comprehensionId || q.comprehension_id || null
    const passageText = q.passage || q.comprehension || q.passageText || null

    if (passageKey || passageText) {
      const key = passageKey || passageText?.substring(0, 60)
      if (!passageMap.has(key)) {
        const group = {
          id: key,
          passage: passageText || '',
          title: q.passageTitle || q.comprehensionTitle || `Passage ${groups.length + 1}`,
          questions: [],
        }
        passageMap.set(key, group)
        groups.push(group)
      }
      passageMap.get(key).questions.push({ ...q, _originalIndex: index })
    } else {
      groups.push({
        id: `_standalone_${index}`,
        passage: null,
        title: null,
        questions: [{ ...q, _originalIndex: index }],
      })
    }
  })

  return groups
}
