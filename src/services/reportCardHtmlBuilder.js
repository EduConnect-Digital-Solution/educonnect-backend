const ACCENT_COLORS = {
  blue: { primary: '#2563eb', light: '#dbeafe', border: '#93c5fd' },
  green: { primary: '#16a34a', light: '#dcfce7', border: '#86efac' },
  purple: { primary: '#7c3aed', light: '#ede9fe', border: '#c4b5fd' },
  amber: { primary: '#d97706', light: '#fef3c7', border: '#fde68a' },
  slate: { primary: '#475569', light: '#f1f5f9', border: '#cbd5e1' }
};

const buildPageHtml = (student, school, template, termName, className) => {
  const colors = ACCENT_COLORS[template.accent] || ACCENT_COLORS.blue;
  const isLandscape = template.orientation === 'landscape';
  const blocks = template.blocks || [];
  const enabledBlocks = {};

  for (const block of blocks) {
    if (block.enabled !== false) {
      enabledBlocks[block.type] = true;
    }
  }

  const subjectsHtml = (student.subjects || []).map(subj => `
    <tr>
      <td style="padding:8px;border:1px solid ${colors.border};font-size:12px;">${subj.name}</td>
      <td style="padding:8px;border:1px solid ${colors.border};text-align:center;font-size:12px;">${subj.ca ?? '-'}</td>
      <td style="padding:8px;border:1px solid ${colors.border};text-align:center;font-size:12px;">${subj.exam ?? '-'}</td>
      <td style="padding:8px;border:1px solid ${colors.border};text-align:center;font-size:12px;font-weight:700;">${subj.total ?? '-'}</td>
      <td style="padding:8px;border:1px solid ${colors.border};text-align:center;font-size:12px;">${subj.grade ?? '-'}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="padding:12px;text-align:center;color:#999;">No results available</td></tr>';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Report Card</title>
  <style>
    @page { margin: 15mm; size: ${isLandscape ? 'A4 landscape' : 'A4'}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 14px; line-height: 1.5; }
    .page { width: 100%; padding: 10px; }
    ${enabledBlocks.header ? `
    .header { text-align: center; padding: 15px 0; border-bottom: 3px solid ${colors.primary}; margin-bottom: 15px; }
    .header h1 { color: ${colors.primary}; font-size: 22px; margin-bottom: 4px; }
    .header p { color: #64748b; font-size: 13px; }
    ` : ''}
    ${enabledBlocks['student-info'] ? `
    .student-info { display: flex; justify-content: space-between; padding: 10px 0; margin-bottom: 15px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
    .student-info .label { color: #64748b; }
    ` : ''}
    ${enabledBlocks['results-table'] ? `
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th { background: ${colors.primary}; color: #fff; padding: 10px 8px; font-size: 12px; text-align: center; font-weight: 600; }
    tr:nth-child(even) { background: ${colors.light}; }
    .summary-row td { padding: 8px; font-size: 13px; font-weight: 600; border-top: 2px solid ${colors.primary}; }
    ` : ''}
    ${enabledBlocks.traits ? `
    .traits { margin-bottom: 15px; }
    .traits h3 { color: ${colors.primary}; font-size: 14px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .traits table td { padding: 6px 12px; font-size: 12px; border: 1px solid #e2e8f0; }
    ` : ''}
    ${enabledBlocks.comments ? `
    .comments { margin-bottom: 15px; }
    .comments h3 { color: ${colors.primary}; font-size: 14px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .comments .box { min-height: 60px; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; font-size: 12px; }
    ` : ''}
    ${enabledBlocks.attendance ? `
    .attendance { margin-bottom: 15px; }
    .attendance h3 { color: ${colors.primary}; font-size: 14px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .attendance table td { padding: 6px 12px; font-size: 12px; border: 1px solid #e2e8f0; }
    ` : ''}
    ${enabledBlocks.signatures ? `
    .signatures { display: flex; justify-content: space-between; margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
    .signatures .sig-line { width: 30%; }
    .signatures .sig-line .line { border-top: 1px solid #94a3b8; margin-top: 30px; padding-top: 5px; font-size: 11px; color: #64748b; text-align: center; }
    ` : ''}
  </style>
</head>
<body>
  <div class="page">
    ${enabledBlocks.header ? `
    <div class="header">
      <h1>${school.name || 'School Name'}</h1>
      <p>${school.address || ''} ${school.city || ''}</p>
      <p style="margin-top:6px;font-weight:600;">Academic Report Card — ${termName || ''}</p>
    </div>
    ` : ''}

    ${enabledBlocks['student-info'] ? `
    <div class="student-info">
      <div><span class="label">Student:</span> ${student.name || ''}</div>
      <div><span class="label">Admission No:</span> ${student.admissionNo || ''}</div>
      <div><span class="label">Class:</span> ${className || ''}</div>
      <div><span class="label">Term:</span> ${termName || ''}</div>
    </div>
    ` : ''}

    ${enabledBlocks['results-table'] ? `
    <table>
      <thead>
        <tr>
          <th>Subject</th>
          <th>CA</th>
          <th>Exam</th>
          <th>Total</th>
          <th>Grade</th>
        </tr>
      </thead>
      <tbody>
        ${subjectsHtml}
        <tr class="summary-row">
          <td colspan="3" style="text-align:right;">Total Score</td>
          <td style="text-align:center;">${student.totalScore ?? '-'}</td>
          <td></td>
        </tr>
        <tr class="summary-row">
          <td colspan="3" style="text-align:right;">Average</td>
          <td style="text-align:center;">${student.average ?? '-'}</td>
          <td></td>
        </tr>
        <tr class="summary-row">
          <td colspan="3" style="text-align:right;">GPA</td>
          <td style="text-align:center;">${student.gradePointAverage ?? '-'}</td>
          <td></td>
        </tr>
        <tr class="summary-row">
          <td colspan="3" style="text-align:right;">Position</td>
          <td style="text-align:center;">${student.position ?? '-'}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
    ` : ''}

    ${enabledBlocks.traits && student.traits ? `
    <div class="traits">
      <h3>Affective Traits</h3>
      <table style="width:60%;">
        ${Object.entries(student.traits).map(([trait, val]) =>
          `<tr><td>${trait}</td><td style="text-align:center;">${val}</td></tr>`
        ).join('')}
      </table>
    </div>
    ` : ''}

    ${enabledBlocks.comments ? `
    <div class="comments">
      <h3>Class Teacher's Comment</h3>
      <div class="box">${student.comment || ''}</div>
    </div>
    ` : ''}

    ${enabledBlocks.attendance && student.attendance ? `
    <div class="attendance">
      <h3>Attendance Summary</h3>
      <table style="width:50%;">
        <tr><td>Days Present</td><td style="text-align:center;">${student.attendance.present ?? '-'}</td></tr>
        <tr><td>Days Absent</td><td style="text-align:center;">${student.attendance.absent ?? '-'}</td></tr>
      </table>
    </div>
    ` : ''}

    ${enabledBlocks.signatures ? `
    <div class="signatures">
      <div class="sig-line"><div class="line">Class Teacher</div></div>
      <div class="sig-line"><div class="line">Head Teacher</div></div>
      <div class="sig-line"><div class="line">Parent / Guardian</div></div>
    </div>
    ` : ''}
  </div>
</body>
</html>`;
};

module.exports = { buildPageHtml };
