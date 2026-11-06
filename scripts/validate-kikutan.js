import { readFileSync } from 'node:fs'
import { inspectKikutanData } from '../src/utils/kikutanData.js'

const [file, startArg = '1', endArg = '112', baseline] = process.argv.slice(2)
if (!file) {
  console.error('Usage: node scripts/validate-kikutan.js FILE [START END [BASELINE]]')
  process.exit(1)
}
try {
  const data = JSON.parse(readFileSync(file, 'utf8'))
  const start = Number(startArg)
  const end = Number(endArg)
  const original = baseline ? JSON.parse(readFileSync(baseline, 'utf8')) : null
  const report = inspectKikutanData(data, start, end, original)
  console.log(JSON.stringify(report, null, 2))
  if (!report.schemaValid || !report.sorted || report.missing.length || report.duplicates.length || report.baselineValid === false) process.exitCode = 1
} catch (err) {
  console.error(err.message)
  process.exitCode = 1
}
