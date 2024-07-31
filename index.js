/** @format */

"use strict";
const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const { exec, execSync } = require("child_process");
const fs = require("fs");

const SLEEP_TIME = 2000;
const VIEWPORT = { width: 1122, height: 793 };
const APP_URL = "https://www.yourapp.com";
const PAGE_SELECTOR = ".page-selector";
const DATA = "some data you want to pass to the application";

async function createPDF() {
  let browser = null;

  // Make sure you have the ghostscript binaries
  // opt is the default folder where AWS unpack zip files provided as layers
  // more info: https://github.com/shelfio/ghostscript-lambda-layer
  execCmd("/opt/bin/gs --version");

  try {
    const data = DATA;

    chromium.setHeadlessMode = true;

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.setViewport(VIEWPORT);

    page.on("pageerror", (exception) => {
      console.log("exception on page", exception);
    });

    // Add data to window.transferData variable so your application can access it
    await page.evaluateOnNewDocument((d) => (window.transferData = d), data);

    await page.goto(APP_URL, {
      waitUntil: ["domcontentloaded", "networkidle0"],
    });

    await page.emulateMediaType("screen");
    await page.waitForSelector(PAGE_SELECTOR);

    // You may need to add a sleep function in case waitUntil and waitForSelector don't work as expected
    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    await sleep(SLEEP_TIME);

    let headless_pdf = await page.pdf({ format: "A3", landscape: true });

    const fileBasePath = `/tmp/${getTimeStamp()}`;

    fs.writeFileSync(`${fileBasePath}.pdf`, headless_pdf);

    generatePdfGhostscript(`${fileBasePath}.pdf`, `${fileBasePath}_ghostscript.pdf`);

    await browser.close();
  } catch (ex) {
    console.log(ex);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
    console.timeEnd("Request processing");
  }
}

function execCmd(cmd, log = "") {
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return callback(error);
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }
    if (stdout) {
      console.log(cmd, log, " stdout ", stdout);
    }
  });
}

function getTimeStamp() {
  const currentDate = new Date();
  const timeStamp =
    currentDate.getFullYear() +
    "_" +
    (Number(currentDate.getMonth()) + 1) +
    "_" +
    currentDate.getDate() +
    "_" +
    currentDate.getHours() +
    "-" +
    currentDate.getMinutes() +
    "-" +
    currentDate.getMilliseconds();
  return timeStamp;
}

function ghostscriptCommand(inputFilePath, outputFilePath, optimization) {
  return `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/${optimization} -dNOPAUSE -dQUIET -dBATCH -sOutputFile=${outputFilePath} ${inputFilePath}`;
}

function generatePdfGhostscript(inputFilePath, outputFilePath) {
  execSync(ghostscriptCommand(inputFilePath, outputFilePath, "prepress"));
  return fs.readFileSync(outputFilePath);
}
