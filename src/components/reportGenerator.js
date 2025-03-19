import { saveAs } from "file-saver";
import { db, attendanceCollection } from "../firebase";
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
const categories = ["L100s", "Continuing Students", "L400s", "Workers", "Others", "New"];

const generateReport = async (serviceName) => {
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

  // Generate the Word document for the selected service
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: `${serviceName} Attendance Report`, bold: true, size: 36 })],
            spacing: { after: 300 },
          }),
          ...Object.keys(attendanceData).map((date) => {
            const { attendees } = attendanceData[date];

            // Calculate totals
            let totalAttendance = 0;
            let categoryTotals = categories.map((cat) => {
              const count = attendees[cat] ? attendees[cat].length : 0;
              totalAttendance += count;
              return count;
            });

            // Table Header Row
            let tableRows = [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Category", bold: true })] })],
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    shading: { fill: "E0E0E0" },
                  }),
                  ...categories.map((cat) =>
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: cat, bold: true })] })],
                      width: { size: 15, type: WidthType.PERCENTAGE },
                      shading: { fill: "E0E0E0" },
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
                        children: [new Paragraph({ children: [new TextRun({ text: `Attendee ${i + 1}` })] })],
                      }),
                      ...categories.map((cat) =>
                        new TableCell({
                          children: [new Paragraph({ children: [new TextRun(attendees[cat]?.[i] || "-")] })],
                        })
                      ),
                    ],
                  })
              ),
              // Total Row
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Total", bold: true })] })],
                    shading: { fill: "E0E0E0" },
                  }),
                  ...categoryTotals.map((total) =>
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: total.toString(), bold: true })] })],
                      shading: { fill: "E0E0E0" },
                    })
                  ),
                ],
              }),
            ];

            return [
              new Paragraph({
                children: [
                  new TextRun({ text: `Service: ${serviceName} - Total: ${totalAttendance}`, bold: true, size: 28 }),
                ],
                spacing: { before: 300, after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: `Date: ${date}`, bold: true, size: 24 }),
                ],
                spacing: { after: 200 },
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
              new Paragraph({ text: "", spacing: { before: 300 } }),
            ];
          }).flat(),
        ],
      },
    ],
  });

  // Save the document
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${serviceName}_Attendance_Report.docx`);
};

export default generateReport;
