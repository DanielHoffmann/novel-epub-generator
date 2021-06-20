const puppeteer = require('puppeteer')
const fs = require('fs/promises')
const path = require('path')
const { epubGen } = require('@auramarker/epub-gen')

function getChapterUrl(chapterNumber) {
  return 'https://lightnovel.world/content/495/' + (366939 + parseInt(chapterNumber)) + '.html'
}
const outputFolder = path.resolve(__dirname, 'out')

function chapterTextName(chapterIndex) {
  let chapterTitle = chapterIndex
  // chapter 661 is split into two parts with different URLs which messes up the names of the chapters
  if (chapterIndex > 662) {
    chapterTitle = chapterIndex - 1
  } else if (chapterIndex === 662) {
    chapterTitle = '661 - part 2'
  }
  // adds leading zeros to numbers, for example 5 becomes "005"
  chapterTitle = chapterTitle.toString()
  while (chapterTitle.length < 3) chapterTitle = '0' + chapterTitle
  return chapterTitle
}

let browser
async function start() {
  try {
    // opening the browser
    const b = await puppeteer.launch({
      // headless: false,
      // devtools: true,
    })
    browser = b

    // clear the output folder
    await fs.rmdir(outputFolder, { recursive: true })
    await fs.mkdir(outputFolder)

    // parses the chapeters in 8 parallel jobs
    await Promise.all([
      // for testing
      // parseChs(1, 2),

      parseChs(1, 100),
      parseChs(101, 200),
      parseChs(201, 300),
      parseChs(301, 400),
      parseChs(401, 500),
      parseChs(501, 600),
      // chapter 661 is split into two parts which messes up the numbering by one
      parseChs(601, 701),
      parseChs(702, 734),
    ])
    await browser.close()
    process.exit(0)
  } catch (e) {
    try {
      await browser.close()
    } catch (e) {}
    console.error(e)
    process.exit(1)
  }
}

async function parseChs(startChapter, endChapter) {
  const name =
    'Fields of Gold, ch' + chapterTextName(startChapter) + ' - ch' + chapterTextName(endChapter)
  const filePath = path.resolve(outputFolder, name)
  // creating the output txt file
  await fs.writeFile(filePath + '.txt', '')

  const epubChapters = []

  console.log('Parsing ' + name)
  // opening a tab in the browser
  const page = await browser.newPage()

  let currentChapter = startChapter

  while (currentChapter <= endChapter) {
    const chapterUrl = getChapterUrl(currentChapter)
    console.log('Parsing ' + chapterUrl)
    await page.goto(chapterUrl)
    await page.waitForSelector('#content_detail') // wait until the HTML element with the chapter text is in the page

    // gets the HTML element with the chapter text
    const chapterText = await page.$$eval('#content_detail', function (element) {
      // console.log(element[0].innerText)
      // debugger

      // returns only the text of the chapter out of the browser page
      return element[0].innerText
    })
    // console.log('text:' + chapterText)

    // appends to the file created beforehand
    await fs.appendFile(filePath + '.txt', chapterText)

    epubChapters.push({
      title: 'Chapter ' + chapterTextName(currentChapter),
      // this lib assumes the input is HTML, we need to replace the line breaks with HTML br tags
      data: chapterText.replace(/(\r\n|\r|\n)/g, '<br />'),
    })

    currentChapter++
  }

  // creates epub
  try {
    await epubGen({
      title: name,
      output: filePath + '.epub',
      content: epubChapters,
    })
  } catch (e) {
    console.error(e)
  }
}

start()
