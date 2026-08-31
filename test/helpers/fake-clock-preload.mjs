import { readFileSync } from 'node:fs'

const realNow = Date.now.bind(Date)
const offsetPath = process.env.LAUNCHLOG_TEST_CLOCK_FILE

if (!offsetPath) {
  throw new Error('LAUNCHLOG_TEST_CLOCK_FILE is required')
}

Date.now = () => realNow() + Number(readFileSync(offsetPath, 'utf8'))
