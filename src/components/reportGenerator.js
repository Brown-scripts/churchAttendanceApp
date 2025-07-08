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

// Categories for the report
const categories = [
  "L100",
  "L200",
  "L300",
  "L400",
  "Worker",
  "Other",
  "New Member",
];

const generateCSVReport = async (serviceName, attendanceData) => {
  // Create CSV content
  let csvContent = `${serviceName} Attendance Report\n\n`;

  Object.keys(attendanceData).forEach(date => {
    const { attendees } = attendanceData[date];

    csvContent += `Date: ${date}\n`;
    csvContent += `Service: ${serviceName}\n\n`;

    // Add headers
    csvContent += "Category," + categories.join(",") + ",Total\n";

    // Calculate totals
    let categoryTotals = categories.map(cat => attendees[cat] ? attendees[cat].length : 0);
    let totalAttendance = categoryTotals.reduce((sum, count) => sum + count, 0);

    // Add totals row
    csvContent += "Count," + categoryTotals.join(",") + "," + totalAttendance + "\n\n";

    // Add individual attendees
    const maxAttendees = Math.max(...categoryTotals, 1);
    for (let i = 0; i < maxAttendees; i++) {
      let row = `Attendee ${i + 1},`;
      row += categories.map(cat => attendees[cat]?.[i] || "").join(",");
      csvContent += row + "\n";
    }

    csvContent += "\n";
  });

  // Create and download CSV file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${serviceName}_Attendance_Report.csv`);
};



const generateReport = async (serviceName, format = "word") => {
  // Fetch all attendance data
  const querySnapshot = await getDocs(attendanceCollection);
  let attendanceData = {};

  // Organize data by date and category, and filter by the serviceName
  querySnapshot.forEach((doc) => {
    const entry = doc.data();
    const { date, category, name, serviceName: entryServiceName } = entry;

    if (entryServiceName === serviceName) {
      if (!attendanceData[date]) {
        attendanceData[date] = { serviceName: entryServiceName, totals: {}, attendees: {} };
      }
      if (!attendanceData[date].attendees[category]) {
        attendanceData[date].attendees[category] = [];
      }

      attendanceData[date].attendees[category].push(name);
    }
  });

  // If no data is available for the selected service, return early
  if (Object.keys(attendanceData).length === 0) {
    alert(`No attendance data found for service: ${serviceName}`);
    return;
  }

  // Generate report based on format
  if (format === "csv") {
    generateCSVReport(serviceName, attendanceData);
    return;
  }

  // Calculate overall statistics
  let overallStats = categories.map(cat => ({
    category: cat,
    total: Object.keys(attendanceData).reduce((sum, date) => {
      const attendees = attendanceData[date].attendees;
      return sum + (attendees[cat] ? attendees[cat].length : 0);
    }, 0)
  }));

  let grandTotal = overallStats.reduce((sum, stat) => sum + stat.total, 0);

  // Generate the enhanced Word document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Church Header
          new Paragraph({
            children: [new TextRun({
              text: "URF ZONE 1 CHURCH",
              bold: true,
              size: 32,
              color: "1F4E79"
            })],
            alignment: "center",
            spacing: { after: 200 },
          }),

          new Paragraph({
            children: [new TextRun({
              text: "ATTENDANCE REPORT",
              bold: true,
              size: 28,
              color: "2E5984"
            })],
            alignment: "center",
            spacing: { after: 400 },
          }),

          // Service and Date Info
          new Paragraph({
            children: [new TextRun({
              text: `Service: ${serviceName}`,
              bold: true,
              size: 24
            })],
            alignment: "center",
            spacing: { after: 200 },
          }),

          new Paragraph({
            children: [new TextRun({
              text: `Report Generated: ${new Date().toLocaleDateString()}`,
              size: 20,
              italics: true
            })],
            alignment: "center",
            spacing: { after: 400 },
          }),

          // Overall Summary Table
          new Paragraph({
            children: [new TextRun({
              text: "OVERALL SUMMARY",
              bold: true,
              size: 22,
              color: "1F4E79"
            })],
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
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: stat.category, size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: stat.total.toString(), size: 18, bold: true })] })],
                  }),
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
            children: [new TextRun({
              text: "DETAILED ATTENDANCE BY DATE",
              bold: true,
              size: 22,
              color: "1F4E79"
            })],
            spacing: { before: 600, after: 300 },
          }),

          ...Object.keys(attendanceData).map((date) => {
            const { attendees } = attendanceData[date];

            // Calculate totals for this date
            let totalAttendance = 0;
            let categoryTotals = categories.map((cat) => {
              const count = attendees[cat] ? attendees[cat].length : 0;
              totalAttendance += count;
              return count;
            });

            // Create detailed table for this date
            let tableRows = [
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
                      new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: `${i + 1}`, size: 16 })] })],
                      }),
                      ...categories.map((cat) =>
                        new TableCell({
                          children: [new Paragraph({ children: [new TextRun({ text: attendees[cat]?.[i] || "", size: 16 })] })],
                        })
                      ),
                    ],
                  })
              ),
              // Total Row for this date
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
                  new TextRun({ text: ` | Total Attendance: ${totalAttendance}`, bold: true, size: 18, color: "666666" }),
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

          // Footer
          new Paragraph({
            children: [new TextRun({
              text: `Generated by Church Attendance Management System on ${new Date().toLocaleString()}`,
              size: 16,
              italics: true,
              color: "666666"
            })],
            alignment: "center",
            spacing: { before: 600 },
          }),
        ],
      },
    ],
  });

  // Save the document
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${serviceName}_Attendance_Report.docx`);
};

export default generateReport;
