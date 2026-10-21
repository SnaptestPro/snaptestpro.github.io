# Paper Format Word (Test_4 format) — v1

## Kya hai
Naya button **📘 Paper Format Word** (sidebar + top toolbar). Paper me jo questions
select hain, unhe Savyasachi "Test_4" format me auto-layout karke `.docx` download karta hai.
Naya alag module: `paper-format-word.js`. Koi purana function nahi chheda
(`exportToWord`, `exportBookletToWord`, `printPaperBooklet` jaise ke taise).

## Output structure (v1.1)
A4 landscape, Word **Narrow margins (0.5")**. Booklet pages questions ke hisaab se khud banti hain:
**4, 8, 12 ... 40 pages** (= N/2 Word pages). Har Word page = 2 half-pages, har half-page me 2 columns.

Imposition (N pages, sheet s = 0..N/4-1): front `[N-2s | 1+2s]`, back `[2+2s | N-1-2s]`.
N = 8: `[8|1] [2|7] [6|3] [4|5]`. N = 4: `[4|1] [2|3]`.

- MCQ: Page 1 se aage, column 1 pehle poora, phir column 2. Page 1 par header box + instruction.
- Subjective (`qType = subjective`): aakhri page(s), single column.
- Beech ke bache pages blank. Page numbers print nahi hote.
- 40 page se zyada ho to confirm aata hai.

## Header kahan se aata hai
- Title: `SnapBrand.plain()` (institute ka naam), fallback "SAVYASACHI COACHING"
- Test: `#subject`, M.M: `#maxMarks`, DATE: `#testDate`, Instruction: `#instructions`
- CLASS: click karne par prompt poochta hai (yaad rakhta hai)

## Pagination
Question ki height estimate hoti hai (fixed 13pt line-height + text-width estimate +
fraction/root ka extra) aur ~5% safety margin (`SAFETY = 1.05`). Jagah kam padne par confirm
aata hai ("N question nahi aa rahe"). Constants file ke upar: `SAFETY`, `LH`, `SZ`.

## Test
- docx 9.6.1 aur 8.5.0 (browser wali) dono se file bani, 4 pages, XSD validation pass (9.6.1).
- v1.1: 30/100/160 MCQ (+subjective) se N = 4/8/16 pages bane, validation pass, columns ~89% bhare, imposition sahi.
- NOTE: LibreOffice docx.js ke fraction/root (OMML) ko blank dikhata hai, isliye math wale
  questions ki real height Microsoft Word me hi check honi chahiye.

## Deploy
Replace/add: `paper-format-word.js` (new), `question-generator.html` (2 buttons + 1 script line).
