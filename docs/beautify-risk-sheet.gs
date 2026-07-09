/**
 * thunk - Risk Assessment beautifier.
 *
 * HOW TO USE:
 *   1. Open your Google Sheet.
 *   2. Extensions > Apps Script.
 *   3. Delete anything there, paste this whole file, click Save.
 *   4. Pick beautifyRiskSheet in the function dropdown, click Run, and Authorize.
 *   5. Back on the sheet: dark header, banded rows, and colour-coded risk scores.
 *
 * It styles the ACTIVE sheet and finds columns by their header text, so it works
 * even if the column order differs. Run it again any time; it is idempotent.
 */
function beautifyRiskSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();
  const rng = sh.getDataRange();
  const nRows = rng.getNumRows();
  const nCols = rng.getNumColumns();
  if (nRows < 2) { ss.toast('No data rows found on this sheet.'); return; }

  const INK = '#1b1b1a', RULE = '#d9d4c7', GREEN = '#0f5132';

  // Base look for the whole table.
  rng.setFontFamily('Arial').setFontSize(10).setFontColor(INK)
     .setVerticalAlignment('top').setWrap(true)
     .setBorder(true, true, true, true, true, true, RULE, SpreadsheetApp.BorderStyle.SOLID);

  // Header row: deep green, white, bold, frozen.
  const header = sh.getRange(1, 1, 1, nCols);
  header.setBackground(GREEN).setFontColor('#ffffff').setFontWeight('bold')
        .setVerticalAlignment('middle').setWrap(true);
  sh.setRowHeight(1, 48);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);

  // Alternating body rows.
  const body = sh.getRange(2, 1, nRows - 1, nCols);
  sh.getBandings().forEach(function (b) { b.remove(); });
  body.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);

  // Map header text -> 1-based column indices.
  const headers = header.getValues()[0].map(function (h) {
    return String(h).replace(/\s+/g, ' ').trim().toLowerCase();
  });
  function cols(needle) {
    const out = [];
    headers.forEach(function (h, i) { if (h.indexOf(needle) >= 0) out.push(i + 1); });
    return out;
  }

  const scoreCols = cols('(lxc)');
  const numericCols = [].concat(
    cols('desirability'), cols('likelihood'), cols('consequence'),
    cols('final l'), cols('final c'), scoreCols);

  numericCols.forEach(function (c) {
    sh.getRange(1, c, nRows, 1).setHorizontalAlignment('center');
  });

  // Emphasise the Risk-name column.
  sh.getRange(2, 1, nRows - 1, 1).setFontWeight('bold');

  // Column widths tuned by what each column holds.
  const wide = [].concat(cols('how could'), cols('existing controls'), cols('additional mitigation'));
  for (var c = 1; c <= nCols; c++) {
    var h = headers[c - 1], w = 90;
    if (wide.indexOf(c) >= 0) w = 250;
    else if (h === 'risk') w = 200;
    else if (h.indexOf('desirability') >= 0) w = 66;
    else if (h.indexOf('(lxc)') >= 0) w = 78;
    else if (h.indexOf('likelihood') >= 0 || h.indexOf('consequence') >= 0 || h === 'final l' || h === 'final c') w = 58;
    sh.setColumnWidth(c, w);
  }

  // Live colour bands on the risk-score columns: red 15+, amber 8-14, green 1-7.
  const rules = [];
  scoreCols.forEach(function (c) {
    var r = sh.getRange(2, c, nRows - 1, 1);
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThanOrEqualTo(15)
      .setBackground('#f8d7da').setFontColor('#842029').setBold(true).setRanges([r]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberBetween(8, 14)
      .setBackground('#fff3cd').setFontColor('#664d03').setBold(true).setRanges([r]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberLessThanOrEqualTo(7)
      .setBackground('#d1e7dd').setFontColor('#0f5132').setBold(true).setRanges([r]).build());
  });
  sh.setConditionalFormatRules(rules);

  sh.setTabColor(GREEN);
  ss.toast('Risk sheet styled.', 'thunk', 4);
}
