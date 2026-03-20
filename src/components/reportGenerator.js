import { saveAs } from "file-saver";
import { attendanceCollection } from "../firebase";
import { getDocs } from "firebase/firestore";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
  AlignmentType,
} from "docx";

const isInRange = (dateStr, startDate, endDate) => {
  if (!startDate && !endDate) return true;
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
};

const fmtDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-");
  return new Date(+y, +m - 1, +d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
};

const getDateTotal = (dateData) =>
  Object.values(dateData.attendees).reduce((s, arr) => s + arr.length, 0);

const monthLabel = (key) =>
  new Date(key + "-01T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });

const monthShort = (key) =>
  new Date(key + "-01T00:00:00").toLocaleDateString("en-US", { month: "long" }).toUpperCase();

// ── helpers for docx building ──────────────────────────────────────────────

const centered = (runs, spacing = {}) =>
  new Paragraph({ children: runs, alignment: AlignmentType.CENTER, spacing });

const bold = (text, size = 24, color = "000000") =>
  new TextRun({ text, bold: true, size, color });

const heading = (text, color = "1F3864") =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color, allCaps: true })],
    spacing: { before: 400, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" } },
  });

const bullet = (text, size = 22) =>
  new Paragraph({
    children: [new TextRun({ text, size })],
    bullet: { level: 0 },
    spacing: { after: 80 },
  });

const statLine = (label, value, size = 22) =>
  new Paragraph({
    children: [
      new TextRun({ text: label, size }),
      new TextRun({ text: String(value), size, bold: true }),
    ],
    spacing: { after: 80 },
  });

const borderSet = (size = 3) => ({
  top: { style: BorderStyle.SINGLE, size },
  bottom: { style: BorderStyle.SINGLE, size },
  left: { style: BorderStyle.SINGLE, size },
  right: { style: BorderStyle.SINGLE, size },
  insideVertical: { style: BorderStyle.SINGLE, size: Math.max(1, size - 1) },
  insideHorizontal: { style: BorderStyle.SINGLE, size: Math.max(1, size - 1) },
});

const headerCell = (text, widthPct, fill = "1F3864") =>
  new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 20, color: "FFFFFF" })],
      alignment: AlignmentType.CENTER,
    })],
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { fill },
  });

const dataCell = (text, widthPct, align = AlignmentType.LEFT, bold2 = false) =>
  new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: String(text), size: 20, bold: bold2 })],
      alignment: align,
    })],
    width: { size: widthPct, type: WidthType.PERCENTAGE },
  });

// ── narrative generator ────────────────────────────────────────────────────

const buildNarrative = (monthName, stats, prevStats) => {
  const { totalEvents, highestEntry, lowestEntry, avgAttendance } = stats;

  let para = `${monthName} recorded a total of ${totalEvents} service${totalEvents !== 1 ? "s" : ""}, ` +
    `with attendance ranging from ${lowestEntry.total} to ${highestEntry.total} across the period. `;

  if (prevStats) {
    if (avgAttendance > prevStats.avgAttendance) {
      para += `Compared to the previous month, overall participation showed a noticeable improvement, ` +
        `reflecting growing engagement among members. `;
    } else {
      para += `Participation levels were relatively similar to the previous month, with some variation across different services. `;
    }
  } else {
    para += `Members showed varying levels of participation across services, with some events drawing significantly larger crowds than others. `;
  }

  para += `The month highlighted both areas of strong engagement and the continued need to encourage consistent attendance across all services and programs.`;
  return para;
};

// ── CSV export ─────────────────────────────────────────────────────────────

const generateCSVReport = (label, attendanceData) => {
  const sortedDates = Object.keys(attendanceData).sort();
  let csv = `Service/Event,Date,Attendance\n`;
  sortedDates.forEach((date, i) => {
    const { serviceName, attendees } = attendanceData[date];
    const total = Object.values(attendees).reduce((s, arr) => s + arr.length, 0);
    csv += `"${serviceName || ""}","${fmtDate(date)}",${total}\n`;
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, `${label.replace(/\s+/g, "_")}_Attendance_Report.csv`);
};

// ── main entry ─────────────────────────────────────────────────────────────

const generateReport = async (serviceName, format = "word", startDate = null, endDate = null) => {
  const querySnapshot = await getDocs(attendanceCollection);
  let attendanceData = {};

  querySnapshot.forEach((doc) => {
    const entry = doc.data();
    const { date, category, name, serviceName: svc } = entry;
    if (!isInRange(date, startDate, endDate)) return;
    if (serviceName && svc !== serviceName) return;

    if (!attendanceData[date]) {
      attendanceData[date] = { serviceName: svc, attendees: {} };
    }
    if (!attendanceData[date].attendees[category]) {
      attendanceData[date].attendees[category] = [];
    }
    attendanceData[date].attendees[category].push(name);
  });

  if (Object.keys(attendanceData).length === 0) {
    alert("No attendance data found for the selected period.");
    return;
  }

  const sortedDates = Object.keys(attendanceData).sort();

  if (format === "csv") {
    const label = serviceName || "All_Services";
    generateCSVReport(label, attendanceData);
    return;
  }

  // ── group dates by month ───────────────────────────────────────────────

  const monthMap = {};
  sortedDates.forEach((date) => {
    const key = date.slice(0, 7); // "YYYY-MM"
    if (!monthMap[key]) monthMap[key] = [];
    monthMap[key].push(date);
  });
  const months = Object.keys(monthMap).sort();

  // ── month stats ────────────────────────────────────────────────────────

  const monthStats = {};
  months.forEach((key) => {
    const dates = monthMap[key];
    const entries = dates.map((d) => ({
      date: d,
      serviceName: attendanceData[d].serviceName,
      total: getDateTotal(attendanceData[d]),
    }));
    const highestEntry = entries.reduce((a, b) => b.total > a.total ? b : a);
    const lowestEntry  = entries.reduce((a, b) => b.total < a.total ? b : a);
    const avgAttendance = Math.round(entries.reduce((s, e) => s + e.total, 0) / entries.length);
    monthStats[key] = { totalEvents: dates.length, entries, highestEntry, lowestEntry, avgAttendance };
  });

  // ── title line ─────────────────────────────────────────────────────────

  const titleLine = months.length === 1
    ? monthLabel(months[0]).toUpperCase()
    : months.length === 2
      ? `${monthShort(months[0])} - ${monthShort(months[1])} ${months[0].slice(0, 4)}`
      : `${monthShort(months[0])} - ${monthShort(months[months.length - 1])} ${months[0].slice(0, 4)}`;

  const totalEvents = sortedDates.length;
  const allTotals   = sortedDates.map((d) => getDateTotal(attendanceData[d]));
  const overallHigh = Math.max(...allTotals);
  const overallLow  = Math.min(...allTotals);

  // ── build document children ────────────────────────────────────────────

  const children = [];

  // Header
  children.push(centered([bold("THE UNIVERSAL RADIANT FAMILY", 28)], { after: 40 }));
  children.push(centered([bold("ZONE 1 BRANCH", 26)], { after: 40 }));
  children.push(centered([bold("STATE OF BRANCH MEMBERSHIP REPORT", 26)], { after: 40 }));
  children.push(centered([bold(titleLine, 26)], { after: 400 }));

  // Per-month sections
  months.forEach((key, idx) => {
    const stats    = monthStats[key];
    const prev     = idx > 0 ? monthStats[months[idx - 1]] : null;
    const name     = monthShort(key); // e.g. "JANUARY"
    const nameProp = monthLabel(key).split(" ")[0]; // e.g. "January"

    // Admin team report heading
    children.push(heading(`${name} ADMIN TEAM REPORT`));

    // Narrative
    children.push(new Paragraph({
      children: [new TextRun({ text: buildNarrative(nameProp, stats, prev), size: 22 })],
      spacing: { after: 240 },
    }));

    // Attendance records
    children.push(heading(`${name} ATTENDANCE RECORDS`));

    children.push(new Paragraph({
      children: [
        new TextRun({ text: "Highest Attendance:", bold: true, size: 22 }),
        new TextRun({ text: ` ${stats.highestEntry.serviceName || "—"} (${fmtDate(stats.highestEntry.date)}) - `, size: 22 }),
        new TextRun({ text: `${stats.highestEntry.total} attendees`, bold: true, size: 22 }),
      ],
      spacing: { after: 120 },
    }));

    children.push(new Paragraph({
      children: [
        new TextRun({ text: "Lowest Attendance:", bold: true, size: 22 }),
        new TextRun({ text: ` ${stats.lowestEntry.serviceName || "—"} (${fmtDate(stats.lowestEntry.date)}) - `, size: 22 }),
        new TextRun({ text: `${stats.lowestEntry.total} attendees`, bold: true, size: 22 }),
      ],
      spacing: { after: 240 },
    }));
  });

  // Current Statistics
  children.push(heading(`CURRENT BRANCH MEMBERSHIP STATISTICS (${titleLine})`));
  children.push(statLine("Total number of recorded events: ", totalEvents));
  children.push(new Paragraph({ text: "", spacing: { after: 120 } }));

  months.forEach((key) => {
    const stats   = monthStats[key];
    const name    = monthShort(key);
    children.push(new Paragraph({
      children: [new TextRun({ text: name, bold: true, size: 22 })],
      spacing: { before: 160, after: 80 },
    }));
    children.push(statLine("Total events recorded: ", stats.totalEvents));
    children.push(statLine("Highest attendance: ", stats.highestEntry.total));
    children.push(statLine("Lowest attendance: ", stats.lowestEntry.total));
  });

  // Overall observations — no category breakdown
  const firstMonth  = monthShort(months[0]);
  const lastMonth   = months.length > 1 ? monthShort(months[months.length - 1]) : null;
  const improved    = months.length > 1 && monthStats[months[months.length - 1]].avgAttendance > monthStats[months[0]].avgAttendance;

  children.push(new Paragraph({ text: "", spacing: { after: 120 } }));
  children.push(heading(`OVERALL OBSERVATIONS FROM ${titleLine}`));

  if (improved && lastMonth) {
    children.push(bullet(`Attendance improved more noticeably in ${lastMonth}`));
  }
  children.push(bullet(`Special meetings and conferences attracted the highest numbers`));
  children.push(bullet(`Participation was stronger in major themed gatherings than in some regular services`));
  children.push(bullet(`Overall attendance ranged from ${overallLow} (lowest) to ${overallHigh} (highest) across the period`));

  // Observations & Challenges
  children.push(new Paragraph({ text: "", spacing: { after: 120 } }));
  children.push(heading("OBSERVATIONS & CHALLENGES"));
  children.push(bullet("Attendance was uneven across meetings, with some events drawing strong numbers while others recorded much lower turnout."));
  children.push(bullet(`${firstMonth} reflected a ${improved ? "slower start" : "moderate start"}, though momentum ${improved ? "improved toward the end of the month" : "remained consistent"}.`));
  if (lastMonth) children.push(bullet(`${lastMonth} showed ${improved ? "stronger" : "similar"} participation overall, especially during larger or specially themed programs.`));
  children.push(bullet("Despite improvement, consistency across all services remains a challenge."));
  children.push(bullet("Some services recorded significantly lower attendance, suggesting fluctuating commitment levels."));

  // Recommendations
  children.push(new Paragraph({ text: "", spacing: { after: 120 } }));
  children.push(heading("RECOMMENDATIONS FOR IMPROVEMENT"));
  if (improved && lastMonth) {
    children.push(bullet(`Build on the stronger turnout recorded in ${lastMonth} by sustaining follow-up and member engagement.`));
  }
  children.push(bullet("Strengthen communication and reminders ahead of all services, not just major events."));
  children.push(bullet("Create strategies to improve consistency, for example church streaks every month."));
  children.push(bullet("Improve accountability and follow-up systems to ensure members remain connected and active."));

  // Attendance Table
  children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
  children.push(heading("ATTENDANCE LOG"));

  const tableRows = [
    new TableRow({
      children: [
        headerCell("No.", 8),
        headerCell("Date", 20),
        headerCell("Service / Event", 54),
        headerCell("Attendance", 18),
      ],
      tableHeader: true,
    }),
    ...sortedDates.map((date, idx2) => {
      const { serviceName: svc } = attendanceData[date];
      const total = getDateTotal(attendanceData[date]);
      return new TableRow({
        children: [
          dataCell(idx2 + 1, 8, AlignmentType.CENTER),
          dataCell(fmtDate(date), 20, AlignmentType.CENTER),
          dataCell(svc || "—", 54),
          dataCell(total, 18, AlignmentType.CENTER, true),
        ],
        ...(idx2 % 2 === 0 ? {} : {
          shading: { fill: "F5F5F5" }
        }),
      });
    }),
  ];

  children.push(new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: borderSet(3),
  }));

  children.push(new Paragraph({
    children: [new TextRun({
      text: `Generated by Church Attendance System on ${new Date().toLocaleString()}`,
      size: 16, italics: true, color: "888888",
    })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
  }));

  // ── pack & save ────────────────────────────────────────────────────────

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  const filename = `${titleLine.replace(/[\s-]+/g, "_")}_Report.docx`;
  saveAs(blob, filename);
};

export default generateReport;
