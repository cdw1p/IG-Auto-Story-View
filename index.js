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
  refreshFeed: 10 * 1000,
  refreshStory: 10 * 1000 * 10
}

/**
 * Browser options
 */
const browserHide = false
const browserNoMedia = true
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
let elmIndex = 1
let elmSelector = {
  notificationPopup: 'button[tabindex="0"]:nth-child(2)',
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
 * Intercepting request (block image)
 */
async function interceptRequestNoMedia(page) {
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    if (req.resourceType() === 'image' && browserNoMedia) {
      req.abort()
    } else {
      req.continue()
    }
  })
}

/**
 * Access Instagram homepage
 */
async function accessInstagram(page) {
  await page.goto('https://www.instagram.com', browserPageOpt)
}

/**
 * Main function
 */
async function main() {
  const { browser, page } = await runBrowser()
  await interceptRequestNoMedia(page)
  try {
    let totalStoriesView = 0, prevStoriesUrl = 'none'
    await accessInstagram(page)
    try {
      await page.waitForSelector(elmSelector.notificationPopup, browserPageTmt)
      await page.tap(elmSelector.notificationPopup)
      printLog('INFO: Anda berhasil sudah login...', 'green')
      printLog('INFO: Memulai proses otomasi...\n-', 'bold')
      while (true) {
        try {
          await page.waitForSelector(`li:nth-child(${elmIndex + 2}) button:nth-child(1)`, browserPageTmt)
          await page.tap(`li:nth-child(${elmIndex + 2}) button:nth-child(1)`)
          await delay(delayTime.skipStories)
          while (true) {
            try {
              await page.waitForSelector(elmSelector.storiesNext, browserPageTmt)
              await page.waitForSelector(elmSelector.storiesLove, browserPageTmt)
              const currentUrl = await page.url()
              if (currentUrl.match(/stories/)) {
                if (currentUrl !== prevStoriesUrl) {
                  elmIndex = 1, totalStoriesView = 0, prevStoriesUrl = currentUrl
                  await page.tap(elmSelector.storiesLove)
                  await delay(delayTime.skipStories)
                  await page.tap(elmSelector.storiesNext)
                  await delay(delayTime.skipStories)
                  printLog(`INFO: Melihat & React stories -> ${currentUrl}`, 'bold')
                }
              } else {
                throw new Error('Bukan halaman stories')
              }
            } catch (err) {
              totalStoriesView = totalStoriesView + 1
              const currentUrl = await page.url()
              if (currentUrl.match(/live/)) {
                printLog(`INFO: Skip stories -> ${currentUrl}`, 'red')
                elmIndex = elmIndex + 1
              }
              if (totalStoriesView >= 2) {
                printLog('-- [ REFRESHING ] --\n', 'yellow')
                await delay(delayTime.refreshStory)
              }
              await accessInstagram(page)
              break
            }
          }
        } catch (err) {
          await accessInstagram(page)
          await delay(delayTime.refreshFeed)
        }
      }
    } catch (err) {
      await browser.close()
      throw new Error('Session tidak valid, silahkan login kembali')
    }
  } catch (err) {
    if (err.message.match(/Navigation timeout/)) {
      await browser.close()
      printLog('ERROR: Tidak dapat terhubung ke Instagram', 'red')
      main()
    } else {
      printLog(`ERROR: ${err.message}`, 'red')
    }
  }
}

/**
 * Run main function
 */
main()