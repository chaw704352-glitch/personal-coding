/**
 * Paste this into a Google Apps Script project bound to the Google Sheet
 * you want to log to, then deploy it as a Web App (see README.md).
 *
 * It appends a row of [date, hawks, eagles, total, timestamp saved] each
 * time the app's "Save Today's Count" button is used.
 */
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  var data = JSON.parse(e.postData.contents);

  // Add a header row once, if the sheet is empty.
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Date", "Hawks", "Eagles", "Total", "Saved At"]);
  }

  sheet.appendRow([
    data.date,
    data.hawks,
    data.eagles,
    data.total,
    new Date(),
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}
