const puppeteer = require('puppeteer')
const moment = require('moment')
const delay = require('delay')
const fs = require('fs-extra')
require('colors')

/**
 * Global options
 */
const delayTime = {
  skipStories: 3 * 1000,
  refreshFeed: 60 * 1000,
  refreshStory: 60 * 30 * 1000
}

/**
 * Browser options
 */
const browserHide = false
const browserPageOpt = { waitUntil: 'networkidle0' }
const browserPageTmt = { timeout: 500 }
const browserOptions = {
  headless: browserHide,
  args: [
    '--ignore-certifcate-errors',
    '--ignore-certifcate-errors-spki-list',
    '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"'
  ]
}

/**
 * Instagram selector
 */
const elmSelector = {
  notificationPopup: 'button[tabindex="0"]:nth-child(2)',
  storiesCheck: 'li[tabindex="-1"] button:nth-child(1)',
  storiesNext: 'button[aria-label="Next"]',
  storiesLove: 'span div[role="button"]'
}

/**
 * Checking session files
 */
function checkSession() {
  return new Promise(async (resolve, reject) => {
    try {
      const cookies = JSON.parse(await fs.readFile('./cookies.json'))
      if (cookies.length !== 0) {
        resolve(true)
      } else {
        resolve(false)
      }
    } catch (err) {
      resolve(false)
    }
  })
}

/**
 * Generate console log with timestamp
 */
function printLog(str, color) {
  const date = moment().format('HH:mm:ss')
  console.log(`(${date}) ${str}`[color])
}

/**
 * Run browser instance
 */
async function runBrowser() {
  const browser = await puppeteer.launch(browserOptions)
  const browserPage = await browser.newPage()
  await browserPage.setViewport({ width: 1920, height: 1080 })
  const resCheckSession = await checkSession()
  if (resCheckSession) {
    printLog('INFO: Session ditemukan, mencoba akses Instagram...', 'green')
    await browserPage.setCookie(...JSON.parse(await fs.readFile('./cookies.json')))
    return { browser, page: browserPage }
  } else {
    printLog('INFO: Session tidak ditemukan...', 'red')
  }
}

/**
 * Main function
 */
async function main() {
  try {
    let totalStoriesView = 0
    const { browser, page } = await runBrowser()
    await page.goto('https://www.instagram.com/', browserPageOpt)
    try {
      await page.waitForSelector(elmSelector.notificationPopup, browserPageTmt)
      await page.tap(elmSelector.notificationPopup)
      printLog('INFO: Anda berhasil sudah login...\n', 'green')
      while (true) {
        try {
          await page.waitForSelector(elmSelector.storiesCheck, browserPageTmt)
          await page.tap(elmSelector.storiesCheck)
          await delay(delayTime.skipStories)
          while (true) {
            try {
              await page.waitForSelector(elmSelector.storiesNext, browserPageTmt)
              await page.waitForSelector(elmSelector.storiesLove, browserPageTmt)
              await page.tap(elmSelector.storiesLove)
              await page.tap(elmSelector.storiesNext)
              const currentUrl = await page.url()
              if (currentUrl.match(/stories/)) {
                totalStoriesView = 0
                printLog(`INFO: Melihat & React stories -> ${currentUrl}`, 'blue')
                printLog('-', 'bold')
                await delay(delayTime.skipStories)
              } else {
                throw new Error('Stories tidak ditemukan')
              }
            } catch (err) {
              totalStoriesView = totalStoriesView + 1
              printLog('INFO: Stories selesai dilihat...', 'blue')
              printLog('-- [ Refreshing ] --\n', 'yellow')
              if (totalStoriesView >= 3) {
                printLog('-- [ Delay Feed ] --\n', 'yellow')
                await delay(delayTime.refreshStory)
              }
              await page.goto('https://www.instagram.com/', browserPageOpt)
              break
            }
          }
        } catch (err) {
          await delay(delayTime.refreshFeed)
        }
      }
    } catch (err) {
      await browser.close()
      throw new Error('Session tidak valid, silahkan login kembali')
    }
  } catch (err) {
    printLog(`ERROR: ${err.message}`, 'red')
  }
}

/**
 * Run main function
 */
main()