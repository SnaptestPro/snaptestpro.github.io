# Paper Format Word (Test_4 format) — v1

## Kya hai
Naya button **📘 Paper Format Word** (sidebar + top toolbar). Paper me jo questions
select hain, unhe Savyasachi "Test_4" format me auto-layout karke `.docx` download karta hai.
Naya alag module: `paper-format-word.js`. Koi purana function nahi chheda
(`exportToWord`, `exportBookletToWord`, `printPaperBooklet` jaise ke taise).

## Output structure
A4 landscape, 4 Word pages. Har page = 2 half-pages, har half-page me 2 columns.
Booklet (fold) order:

| Word page | Left half | Right half |
|---|---|---|
| 1 | Page 8 (subjective) | Page 1 (header box + instruction + MCQ) |
| 2 | Page 2 | Page 7 |
| 3 | Page 6 | Page 3 |
| 4 | Page 4 | Page 5 |

- MCQ: Page 1 -> 7, har page me column 1 pehle poora bharta hai, phir column 2 (max 14 columns).
- Subjective (`qType = subjective`): Page 8, ek column list.
- Page numbers print nahi hote.

## Header kahan se aata hai
- Title: `SnapBrand.plain()` (institute ka naam), fallback "SAVYASACHI COACHING"
- Test: `#subject`, M.M: `#maxMarks`, DATE: `#testDate`, Instruction: `#instructions`
- CLASS: click karne par prompt poochta hai (yaad rakhta hai)

## Pagination
Question ki height estimate hoti hai (fixed 13pt line-height + text-width estimate +
fraction/root ka extra) aur ~8% safety margin (`SAFETY`). Jagah kam padne par confirm
aata hai ("N question nahi aa rahe"). Constants file ke upar: `SAFETY`, `LH`, `SZ`.

## Test
- docx 9.6.1 aur 8.5.0 (browser wali) dono se file bani, 4 pages, XSD validation pass (9.6.1).
- LibreOffice render: columns ~86% tak bhare (non-math questions), imposition order sahi.
- NOTE: LibreOffice docx.js ke fraction/root (OMML) ko blank dikhata hai, isliye math wale
  questions ki real height Microsoft Word me hi check honi chahiye.

## Deploy
Replace/add: `paper-format-word.js` (new), `question-generator.html` (2 buttons + 1 script line).
