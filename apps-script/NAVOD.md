# Návod: aplikace MAGU v Google Apps Script

Tento návod je pro člověka, který aplikace jen vloží do Google a zapne je. Nic se neprogramuje a nic se neinstaluje.

Pracujte na počítači v prohlížeči Chrome. Musíte být přihlášení účtem, který končí na `@magu.co`. Soukromý Gmail nestačí. Když budete přihlášení jiným účtem, ostatní z magu.co se do aplikace nedostanou a do tabulky se nezapíše jejich e-mail.

Jsou tu **dvě oddělené aplikace**. Každá má vlastní projekt na script.google.com. Nedávejte je do jednoho projektu, přestaly by fungovat.

| Aplikace | Složka | Co dělá |
| --- | --- | --- |
| Hlášení závad | `apps-script/hlaseni` | Operátoři hlásí závadu. Všechna hlášení se ukládají do jedné tabulky. |
| Kalkulačka alkoholu | `apps-script/alkohol` | Stejná kalkulačka jako dosud. Tabulku nezakládá. |

Do Apps Script patří jen tyto tři soubory v dané složce: `Code.gs`, `Index.html`, `appsscript.json`. Soubor `check.js` je kontrola pro programátora, do projektu ho nevkládejte.

Soubory otevírejte jako prostý text. Ve Wordu ne. Word by pokazil uvozovky. Když soubor berete z GitHubu, otevřete ho a klikněte na **Raw**, a kopírujte až z té prosté stránky.

## 1. Založte projekt

1. Otevřete [script.google.com](https://script.google.com).
2. Zkontrolujte vpravo nahoře, že jste účet `@magu.co`.
3. Klikněte na **Nový projekt**.
4. Vlevo nahoře projekt pojmenujte.
   - Pro hlášení: `MAGU hlášení závad`
   - Pro kalkulačku: `MAGU kalkulačka alkoholu`

Nejdřív dokončete celou jednu aplikaci, včetně nasazení. Teprve pak založte druhý projekt a opakujte postup s druhou složkou.

## 2. Zobrazte soubor s nastavením

1. Vlevo klikněte na ozubené kolečko **Nastavení projektu**.
2. Zaškrtněte **Zobrazit soubor manifestu „appsscript.json“ v editoru**.
3. Vraťte se do **Editor** (ikona `<>`).
4. V seznamu souborů vlevo se objeví `appsscript.json`.

## 3. Vložte tři soubory

U každého souboru: otevřete ho, označte celý obsah, zkopírujte, v Apps Script smažte to, co tam je, a vložte zkopírované. Pak počkejte, až se projekt sám uloží.

### appsscript.json

Otevřete `appsscript.json` a nahraďte celý jeho obsah obsahem souboru `appsscript.json` ze správné složky. Tento soubor říká, že aplikace běží v české časové zóně, spouští se pod vaším účtem a pustí jen lidi z magu.co.

### Code.gs

Otevřete `Code.gs`. Smažte ukázkovou funkci, která tam je od Googlu, a vložte celý soubor `Code.gs` ze správné složky.

U hlášení závad nechte řádek `var SHEET_ID = '';` prázdný, pokud ještě nemáte vlastní tabulku. Skript ji založí sám. Vlastní tabulka se řeší až v kapitole 6.

### Index.html

1. U položky **Soubory** klikněte na **+** a zvolte **HTML**.
2. Název zadejte přesně `Index`. Bez `.html` a bez mezery. Apps Script koncovku doplní sám. Když soubor pojmenujete `Index.html`, vznikne špatný název `Index.html.html` a stránka nepůjde.
3. Smažte ukázkový obsah a vložte celý soubor `Index.html` ze správné složky.

## 4. Nasaďte webovou aplikaci

1. Vpravo nahoře **Nasadit** → **Nové nasazení**.
2. Vedle výběru typu klikněte na ozubené kolečko a zvolte **Webová aplikace**.
3. Popis může být `první verze`.
4. **Spouštět jako:** `Já` a v závorce váš účet `@magu.co`.
5. **Kdo má přístup:** `Kdokoli v rámci magu.co`.
6. Když větu „v rámci magu.co“ nevidíte, jste přihlášení špatným účtem. Nasazení zavřete, přihlaste se účtem magu.co a začněte znovu.
7. Klikněte **Nasadit**.
8. Google se zeptá na povolení.
   - U hlášení závad povolte přístup k tabulkám Google a zobrazení e-mailové adresy. Bez e-mailu by ve sloupci E-mail nezůstalo, kdo hlášení poslal.
   - Kalkulačka přístup k tabulkám nepotřebuje.
9. Zkopírujte **Adresu webové aplikace**. Musí končit na `/exec`.

Adresa, která končí na `/dev`, je jen vaše zkušební. Ostatním nefunguje. Používejte adresu `/exec`.

Odkaz pošlete lidem v magu.co. Oni nic neschvalují. Aplikace běží pod vaším účtem a Google ji otevře jen lidem z domény magu.co.

## 5. Přidejte ikonu na iPhone

1. Na iPhonu otevřete Safari. Když se Google zeptá na účet, zvolte účet `@magu.co`.
2. Vložte adresu `/exec`.
3. Dole klepněte na ikonu sdílení (čtvereček se šipkou nahoru).
4. Klepněte na **Přidat na plochu** a pak na **Přidat**.

Stejný postup zopakujte pro druhou aplikaci. Na ploše pak jsou dvě ikony.

## 6. Tabulka s hlášeními

Tato kapitola platí jen pro hlášení závad.

- Jakmile někdo uloží první hlášení, nebo na obrazovce Záznamy klepne na **Otevřít tabulku**, na Disku účtu, který aplikaci nasadil, vznikne tabulka **MAGU – Hlášení závad**. Leží v kořeni Disku (Můj disk).
- List se jmenuje **Hlášení**.
- Sloupce jsou: Čas, Operátor, E-mail, Stroj, Typ, Část, Problém, Kdo řešil, Poznámka.
- Jméno operátora se napoprvé předvyplní e-mailem. Člověk ho může přepsat. Telefon si jméno pamatuje.
- E-mail doplňuje skript sám podle účtu, který je na telefonu přihlášený. Do tabulky nejde podstrčit cizí adresu.
- Hlášení se ukládají a v aplikaci se čtou, i když tabulku nikomu jinému nesdílíte. Skript do ní sahá vaším účtem.
- Tlačítko **Otevřít tabulku** otevře tabulku jako běžný soubor na Disku. To ostatním půjde, až ji nasdílíte: v tabulce **Sdílet** → obecný přístup → lidé v doméně magu.co → role **Čtenář**. Právo upravovat si nechte jen vy, ať někdo omylem nesmaže řádky.
- Když tabulku už máte a chcete psát do ní: z její adresy zkopírujte dlouhý kód mezi `/d/` a `/edit`. V `Code.gs` ho vložte mezi apostrofy, například `var SHEET_ID = 'sem-ten-kod';`. Uložte a nasaďte novou verzi podle kapitoly 8. List **Hlášení** skript doplní, když v tabulce není.

Když se hlášení nepodaří odeslat, třeba kvůli signálu, zůstane v tom telefonu. Při příštím otevření aplikace se odešle samo. Na začátku průvodce je pak věta, kolik hlášení ještě čeká. Tlačítko **Smazat neodeslané** maže jen tuto frontu v telefonu. Řádky, které už jsou v tabulce, nesmaže.

## 7. Kalkulačka

Založte druhý projekt a zopakujte kapitoly 1 až 5 se soubory ze složky `apps-script/alkohol`.

Vzhled, texty i výpočet jsou stejné jako na současné stránce. Stejné jsou i konstanty kalibrace z 29. 9. 2026. Kalkulačka nic neukládá.

## 8. Pozdější úprava

Když v souboru něco změníte, samotné uložení nestačí. Odkaz `/exec` pouští poslední nasazenou verzi, ne rozpracovaný text.

1. **Nasadit** → **Spravovat nasazení**.
2. U webové aplikace klikněte na tužku.
3. U položky **Verze** zvolte **Nová verze**.
4. Klikněte **Nasadit**.

Adresa `/exec` se tím nemění. Ikony na telefonech měnit nemusíte. Stránku v Safari zavřete a otevřete znovu, ať se nenačte starší kopie.

Když po úpravě `appsscript.json` z něj zmizí řádky `oauthScopes`, vložte soubor znovu a nasaďte další novou verzi. Bez rozsahu `userinfo.email` zůstane sloupec E-mail prázdný.

## 9. Až obě nové adresy fungují

Staré stránky na GitHub Pages jsou veřejné na internetu. Až obě adresy `/exec` ověříte přímo na telefonu, GitHub Pages vypněte, ať hlášení nezůstane na veřejné adrese.

Na GitHubu v tomto repozitáři: **Settings** → **Pages** → **Build and deployment** → **None** → **Save**.

Než je vypnete, udělejte na staré stránce hlášení v každém telefonu, kde se používala, toto: **Záznamy** → **Export CSV**. Staré záznamy jsou jen v tom telefonu. Do nové tabulky se samy nepřenášejí, protože nová aplikace běží na jiné adrese a telefon mezi adresami paměť nesdílí.

Ikonu si iPhone zkopíruje ve chvíli, kdy ji přidáte na plochu. Ikony přidané před vypnutím Pages zůstanou. Kdo si ikonu přidá až potom, může ji mít bez obrázku.

Zatím GitHub Pages nevypínejte. Nejdřív musí na telefonech fungovat obě nové adresy.

## Když něco nefunguje

- **Google napíše, že k aplikaci nemáte přístup.** Účet není v doméně magu.co, nebo je u nasazení omylem „Jen já“. V kapitole 4 musí být „Kdokoli v rámci magu.co“.
- **Ve sloupci E-mail je prázdno.** Nasazení musí být „Spouštět jako: Já“ a „Kdokoli v rámci magu.co“. Člověk u telefonu musí být přihlášený účtem `@magu.co`. V `appsscript.json` musí být rozsah `userinfo.email`. Po opravě nasaďte novou verzi a povolení znovu potvrďte.
- **Hlášení se neukládá a na telefonu zůstává chybová hláška.** V Apps Script vlevo otevřete **Provedení**. U červeného řádku je důvod.
- **Tlačítko Otevřít tabulku nic neukáže, nebo napíše, že chybí přístup.** Tabulku nasdílejte podle kapitoly 6. Samotné ukládání hlášení přitom funguje i bez sdílení. Soubor najdete na Disku účtu, který aplikaci nasadil.
- **Stránka je prázdná.** HTML soubor se musí jmenovat `Index`, ne `Index.html`. V `Code.gs` musí být `createTemplateFromFile('Index')` u hlášení a `createHtmlOutputFromFile('Index')` u kalkulačky.
