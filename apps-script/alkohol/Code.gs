/**
 * Kalkulačka alkoholu MAGU.
 *
 * V editoru Apps Script tento soubor pojmenujte Code.gs a vložte sem
 * celý obsah. Ukázkovou funkci myFunction smažte.
 * Výpočet je celý v Index.html, server jen stránku zobrazí.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Kalkulačka alkoholu')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}
