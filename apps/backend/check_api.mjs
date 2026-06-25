import http from 'http'

http.get('http://localhost:5001/api/study/quantitative-aptitude', (res) => {
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data)
      console.log('Success:', parsed.success)
      console.log('Stats:', {
        topics: parsed.data.topics,
        chaptersCount: parsed.data.chaptersCount,
        videos: parsed.data.videos,
        pdf: parsed.data.pdf,
        tests: parsed.data.tests,
      })
      console.log('Parts count:', parsed.data.parts?.length)
      console.log('Chapters count:', parsed.data.chapters?.length)
      if (parsed.data.parts?.[0]) {
        console.log('First part units:', parsed.data.parts[0].units?.length)
      }
    } catch (e) {
      console.error('Parse error:', e)
      console.log('Raw data:', data.slice(0, 500))
    }
  })
}).on('error', console.error)
