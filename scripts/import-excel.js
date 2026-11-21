/**
 * Converts the results workbook into data/students.json.
 *
 *   npm run import                       -> reads data/source/Foundation_School_Results.xlsx
 *   npm run import -- path/to/file.xlsx  -> reads a different file
 *
 * It reads the RESULTS sheet (the values Excel has already calculated), then
 * re-derives grade points, GPA and graduation status using the rules on the
 * "Grading Scale" tab and reports any disagreement with the sheet's own status.
 */
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const SRC = process.argv[2] || path.join(__dirname, '..', 'data', 'source', 'Foundation_School_Results.xlsx');
const OUT = path.join(__dirname, '..', 'data', 'students.json');

const SUBJECTS = [
  'Vision & Emphasis of LCC',
  'Now That You Are Born Again',
  'Salvation, Grace and Sin',
  'Who is Jesus',
  'Identity of Christ / Scripture Memory',
];
const PASS_MARK = 50; // percent, per subject

const BANDS = [
  [80, 'A', 4.0], [75, 'B+', 3.5], [70, 'B', 3.0], [65, 'C+', 2.5],
  [60, 'C', 2.0], [55, 'D+', 1.5], [50, 'D', 1.0], [45, 'E', 0.5], [0, 'F', 0.0],
];
const band = (pct) => BANDS.find(([min]) => pct >= min);

const raw = (cell) => {
  let v = cell.value;
  if (v && typeof v === 'object' && 'result' in v) v = v.result;
  if (v && typeof v === 'object' && 'error' in v) return null;
  return v === '' || v === undefined ? null : v;
};

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const ws = wb.getWorksheet('RESULTS');
  if (!ws) throw new Error('Sheet "RESULTS" not found');

  const students = [];
  const mismatches = [];

  ws.eachRow((row, n) => {
    if (n < 5) return;
    const id = raw(row.getCell(1));
    if (typeof id !== 'number') return; // skips blank + summary rows
    const name = String(raw(row.getCell(2)) || '').trim();

    const subjects = SUBJECTS.map((subject, i) => {
      const v = raw(row.getCell(3 + i));
      // The sheet shows 0% for students with no marks entered at all (every mark cell is blank).
      // That means "no score recorded", not "scored zero", so it is treated as missing.
      if (typeof v !== 'number' || v <= 0) return { subject, score: null, letter: null, points: null };
      const score = Math.round(v * 1000) / 10; // 0.835 -> 83.5
      const [, letter, points] = band(score);
      return { subject, score, letter, points };
    });

    const done = subjects.filter((s) => s.score !== null);
    const failed = done.filter((s) => s.score < PASS_MARK).length;
    let status, reason = '';
    if (done.length < SUBJECTS.length) {
      const missing = SUBJECTS.length - done.length;
      status = 'incomplete';
      reason = `${missing} subject${missing > 1 ? 's have' : ' has'} no recorded score`;
      if (failed) reason += `, and ${failed} recorded score${failed > 1 ? 's are' : ' is'} below the pass mark`;
    } else if (done.every((s) => s.score >= PASS_MARK)) {
      status = 'graduated';
    } else {
      status = 'not_eligible';
      reason = `${failed} subject${failed > 1 ? 's' : ''} below the ${PASS_MARK}% pass mark`;
    }

    const complete = done.length === SUBJECTS.length;
    const gpa = complete ? Math.round((done.reduce((a, s) => a + s.points, 0) / 5) * 100) / 100 : null;
    const average = complete ? Math.round((done.reduce((a, s) => a + s.score, 0) / 5) * 10) / 10 : null;

    const sheetStatus = raw(row.getCell(11));
    if ((sheetStatus === 'Eligible for Graduation') !== (status === 'graduated')) mismatches.push(`${id} ${name}`);

    students.push({ id: String(id), name, status, reason, gpa, average, subjects });
  });

  if (mismatches.length) console.warn('WARNING: status differs from the sheet for:', mismatches);

  fs.writeFileSync(OUT, JSON.stringify(students, null, 2));
  const count = (s) => students.filter((x) => x.status === s).length;
  console.log(`Wrote ${students.length} students -> ${path.relative(process.cwd(), OUT)}`);
  console.log(`  graduated: ${count('graduated')}  not eligible: ${count('not_eligible')}  incomplete: ${count('incomplete')}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
