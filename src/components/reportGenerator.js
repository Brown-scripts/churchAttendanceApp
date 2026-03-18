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
  BorderStyle
} from "docx";

const categories = [
  "L100",
  "L200",
  "L300",
  "L400",
  "Worker",
  "Other",
  "New Member",
];

// Returns true if a date string (YYYY-MM-DD) falls within [startDate, endDate] (both YYYY-MM-DD)
const isInRange = (dateStr, startDate, endDate) => {
  if (!startDate && !endDate) return true;
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
};

const generateCSVReport = (label, attendanceData) => {
  let csvContent = `${label} Attendance Report\n\n`;

  const sortedDates = Object.keys(attendanceData).sort();
  sortedDates.forEach(date => {
    const { serviceName, attendees } = attendanceData[date];

    csvContent += `Date: ${date}\n`;
    csvContent += `Service: ${serviceName}\n\n`;
    csvContent += "Category," + categories.join(",") + ",Total\n";

    let categoryTotals = categories.map(cat => attendees[cat] ? attendees[cat].length : 0);
    let totalAttendance = categoryTotals.reduce((sum, count) => sum + count, 0);

    csvContent += "Count," + categoryTotals.join(",") + "," + totalAttendance + "\n\n";

    const maxAttendees = Math.max(...categoryTotals, 1);
    for (let i = 0; i < maxAttendees; i++) {
      let row = `Attendee ${i + 1},`;
      row += categories.map(cat => attendees[cat]?.[i] || "").join(",");
      csvContent += row + "\n";
    }

    csvContent += "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, `${label.replace(/\s+/g, "_")}_Attendance_Report.csv`);
};

// serviceName: string or null (null = all services)
// startDate / endDate: "YYYY-MM-DD" strings or null
const generateReport = async (serviceName, format = "word", startDate = null, endDate = null) => {
  const querySnapshot = await getDocs(attendanceCollection);
  let attendanceData = {};

  querySnapshot.forEach((doc) => {
    const entry = doc.data();
    const { date, category, name, serviceName: entryServiceName } = entry;

    const serviceMatch = !serviceName || entryServiceName === serviceName;
    const dateMatch = isInRange(date, startDate, endDate);

    if (serviceMatch && dateMatch) {
      const key = date;
      if (!attendanceData[key]) {
        attendanceData[key] = { serviceName: entryServiceName, totals: {}, attendees: {} };
      }
      if (!attendanceData[key].attendees[category]) {
        attendanceData[key].attendees[category] = [];
      }
      attendanceData[key].attendees[category].push(name);
    }
  });

  if (Object.keys(attendanceData).length === 0) {
    alert("No attendance data found for the selected period.");
    return;
  }

  // Build a human-readable label for the report title
  let reportLabel = serviceName || "All Services";
  if (startDate && endDate) {
    const fmt = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    reportLabel += ` — ${fmt(startDate)} to ${fmt(endDate)}`;
  } else if (startDate) {
    reportLabel += ` — From ${new Date(startDate + "T00:00:00").toLocaleDateString()}`;
  } else if (endDate) {
    reportLabel += ` — Up to ${new Date(endDate + "T00:00:00").toLocaleDateString()}`;
  }

  if (format === "csv") {
    generateCSVReport(reportLabel, attendanceData);
    return;
  }

  // Calculate overall statistics across all dates
  let overallStats = categories.map(cat => ({
    category: cat,
    total: Object.keys(attendanceData).reduce((sum, date) => {
      const attendees = attendanceData[date].attendees;
      return sum + (attendees[cat] ? attendees[cat].length : 0);
    }, 0)
  }));

  let grandTotal = overallStats.reduce((sum, stat) => sum + stat.total, 0);

  const sortedDates = Object.keys(attendanceData).sort();

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: "URF ZONE 1 CHURCH", bold: true, size: 32, color: "1F4E79" })],
            alignment: "center",
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "ATTENDANCE REPORT", bold: true, size: 28, color: "2E5984" })],
            alignment: "center",
            spacing: { after: 400 },
          }),

          // Service and period info
          ...(serviceName ? [new Paragraph({
            children: [new TextRun({ text: `Service: ${serviceName}`, bold: true, size: 24 })],
            alignment: "center",
            spacing: { after: 200 },
          })] : []),

          ...(startDate || endDate ? [new Paragraph({
            children: [new TextRun({
              text: startDate && endDate
                ? `Period: ${startDate} to ${endDate}`
                : startDate
                  ? `From: ${startDate}`
                  : `Up to: ${endDate}`,
              bold: true,
              size: 22,
              color: "2E5984",
            })],
            alignment: "center",
            spacing: { after: 200 },
          })] : []),

          new Paragraph({
            children: [new TextRun({
              text: `Report Generated: ${new Date().toLocaleDateString()}`,
              size: 20,
              italics: true,
            })],
            alignment: "center",
            spacing: { after: 400 },
          }),

          // Overall Summary Table
          new Paragraph({
            children: [new TextRun({ text: "OVERALL SUMMARY", bold: true, size: 22, color: "1F4E79" })],
            spacing: { before: 400, after: 300 },
          }),

          new Table({
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Category", bold: true, size: 20 })] })],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    shading: { fill: "D1E7DD" },
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Total Attendance", bold: true, size: 20 })] })],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    shading: { fill: "D1E7DD" },
                  }),
                ],
              }),
              ...overallStats.map(stat => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: stat.category, size: 18 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: stat.total.toString(), size: 18, bold: true })] })] }),
                ],
              })),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "GRAND TOTAL", bold: true, size: 20 })] })],
                    shading: { fill: "B6D7A8" },
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: grandTotal.toString(), bold: true, size: 20 })] })],
                    shading: { fill: "B6D7A8" },
                  }),
                ],
              }),
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 3 },
              bottom: { style: BorderStyle.SINGLE, size: 3 },
              left: { style: BorderStyle.SINGLE, size: 3 },
              right: { style: BorderStyle.SINGLE, size: 3 },
              insideVertical: { style: BorderStyle.SINGLE, size: 2 },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 2 },
            },
          }),

          // Detailed Attendance by Date
          new Paragraph({
            children: [new TextRun({ text: "DETAILED ATTENDANCE BY DATE", bold: true, size: 22, color: "1F4E79" })],
            spacing: { before: 600, after: 300 },
          }),

          ...sortedDates.map((date) => {
            const { serviceName: dateSvcName, attendees } = attendanceData[date];

            let totalAttendance = 0;
            let categoryTotals = categories.map((cat) => {
              const count = attendees[cat] ? attendees[cat].length : 0;
              totalAttendance += count;
              return count;
            });

            const tableRows = [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Position", bold: true, size: 18 })] })],
                    width: { size: 15, type: WidthType.PERCENTAGE },
                    shading: { fill: "F0F8FF" },
                  }),
                  ...categories.map((cat) =>
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: cat, bold: true, size: 18 })] })],
                      width: { size: 12, type: WidthType.PERCENTAGE },
                      shading: { fill: "F0F8FF" },
                    })
                  ),
                ],
              }),
              ...Array.from(
                { length: Math.max(...categoryTotals) || 1 },
                (_, i) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${i + 1}`, size: 16 })] })] }),
                      ...categories.map((cat) =>
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: attendees[cat]?.[i] || "", size: 16 })] })] })
                      ),
                    ],
                  })
              ),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "TOTAL", bold: true, size: 18 })] })],
                    shading: { fill: "E8F5E8" },
                  }),
                  ...categoryTotals.map((total) =>
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: total.toString(), bold: true, size: 18 })] })],
                      shading: { fill: "E8F5E8" },
                    })
                  ),
                ],
              }),
            ];

            return [
              new Paragraph({
                children: [
                  new TextRun({ text: `Date: ${date}`, bold: true, size: 20, color: "2E5984" }),
                  ...(dateSvcName && !serviceName ? [new TextRun({ text: ` | Service: ${dateSvcName}`, size: 18, color: "444444" })] : []),
                  new TextRun({ text: ` | Total: ${totalAttendance}`, bold: true, size: 18, color: "666666" }),
                ],
                spacing: { before: 400, after: 200 },
              }),
              new Table({
                rows: tableRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 2 },
                  bottom: { style: BorderStyle.SINGLE, size: 2 },
                  left: { style: BorderStyle.SINGLE, size: 2 },
                  right: { style: BorderStyle.SINGLE, size: 2 },
                  insideVertical: { style: BorderStyle.SINGLE, size: 1 },
                  insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
                },
              }),
              new Paragraph({ text: "", spacing: { before: 200 } }),
            ];
          }).flat(),

          new Paragraph({
            children: [new TextRun({
              text: `Generated by Church Attendance Management System on ${new Date().toLocaleString()}`,
              size: 16,
              italics: true,
              color: "666666",
            })],
            alignment: "center",
            spacing: { before: 600 },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${(serviceName || "All_Services").replace(/\s+/g, "_")}_${startDate || "all"}_${endDate || "dates"}.docx`;
  saveAs(blob, filename);
};

export default generateReport;
