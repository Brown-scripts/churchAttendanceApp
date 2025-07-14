import React, { useEffect } from "react";
import { db } from "../firebase";
import { collection, setDoc, doc } from "firebase/firestore";

const members = [
  // LEVEL 100s
  { name: "Jacqueline", category: "L100" },
  { name: "Felbertha Baduwaa Baidoo", category: "L100" },
  { name: "Abigail Asare Obensua", category: "L100" },
  { name: "Ernestina Adutwumwaa Gyimah", category: "L100" },
  { name: "Nana Abena Boah", category: "L100" },
  { name: "Agormeda Nathaniel Tetteh", category: "L100" },
  { name: "Josephine Amoakoh", category: "L100" },
  { name: "Eugenia Nana Adomah", category: "L100" },
  { name: "Juanita Ewoenam Geli", category: "L100" },
  { name: "Reindolf Kusi", category: "L100" },
  { name: "Faustus", category: "L100" },
  { name: "Beverlyn", category: "L100" },
  { name: "Gertrude", category: "L100" },

  // LEVEL 200s
  { name: "Abigail Ayamga", category: "L200" },
  { name: "Janet Serwaa Kodua", category: "L200" },
  { name: "Vera Ablorh", category: "L200" },
  { name: "Augustine Mensah", category: "L200" },
  { name: "Prince Tengey", category: "L200" },
  { name: "Gilbert Sam", category: "L200" },
  { name: "Allswell", category: "L200" },

  // LEVEL 300s
  { name: "Mariam Hamidu", category: "L300" },
  { name: "Yaa Dedaa Anyan Anum", category: "L300" },
  { name: "Charity Boateng", category: "L300" },
  { name: "Harris Amoahful", category: "L300" },
  { name: "Elliot Ampadu", category: "L300" },
  { name: "Claudia Ahmed", category: "L300" },
  { name: "Solace Nyametsease Boateng", category: "L300" },
  { name: "Derrick Hagan", category: "L300" },
  { name: "Christabel Afful", category: "L300" },
  { name: "Sam Llyod", category: "L300" },
  { name: "Augustina Korsaa", category: "L300" },
  { name: "Daniel Saijah", category: "L300" },
  { name: "Kwesi Effah", category: "L300" },
  { name: "Bright Opoku-Ware", category: "L300" },
  { name: "Barimah Appiagyei", category: "L300" },

  // LEVEL 400s
  { name: "Princella Fosua Akowuah", category: "L400" },
  { name: "Akorfa Agbanu", category: "L400" },
  { name: "Gideon Hagan", category: "L400" },
  { name: "Esther Gyaabah", category: "L400" },
  { name: "Elizabeth Boakyewaah", category: "L400" },
  { name: "Sandra Nanor", category: "L400" },
  { name: "Nicole Brown", category: "L400" },
  { name: "Nissi Abena Dansoa", category: "L400" },
  { name: "Ethel Nyamador", category: "L400" },
  { name: "Millicent Boateng", category: "L400" },
  { name: "Dela Dell Dokosi", category: "L400" },

  // WORKERS
  { name: "Ruby Selasee Amegatsey-Blebu", category: "Worker" },
  { name: "Eyram Afi", category: "Worker" },
  { name: "Andra Sika Kwapong", category: "Worker" },
  { name: "Christabel Aduful", category: "Worker" },
  { name: "Betty Odoi", category: "Worker" },
  { name: "Global Jet Emmanuel Ankrah", category: "Worker" },
  { name: "David Komeng", category: "Worker" },
  { name: "Dora Akorli Kwasi", category: "Worker" },
  { name: "Deacon Prince Pius", category: "Worker" },
  { name: "Pastor Prince Sarfo", category: "Worker" },
  { name: "Pastor Gina Quartey", category: "Worker" },
  { name: "Louisa Seshie", category: "Worker" },
  { name: "Victor Godswill", category: "Worker" },
  { name: "Addo Kwasi Nyarko", category: "Worker" },
  { name: "Lydia Benewaah", category: "Worker" },
  { name: "Princess Ayebea Ofori- Hanson", category: "Worker" },
  { name: "Rossetta Adwoa Tsiquaye", category: "Worker" },
];

export default function UploadMembers() {
  useEffect(() => {
    const upload = async () => {
      const membershipCollection = collection(db, "membership");

      for (const member of members) {
        const id = `${member.name.replace(/\s+/g, "_")}_${member.category}`;
        const docRef = doc(membershipCollection, id);
        await setDoc(docRef, member); // overwrite or create
      }

      console.log("✅ 63 members uploaded with duplicate prevention.");
    };

    upload();
  }, []);

  return (
    <div>
      Uploading <strong>THE UNIVERSAL RADIANT FAMILY</strong> <br />
      <em>ZONE 1 COMMITTED (SUNDAY ATTENDANCE MEMBERSHIP) - JUNE 2025</em> to Firestore...
    </div>
  );
}


// app
// import React from "react";
// import UploadMembers from "./components/UploadMembers"; // Make sure the path matches where you saved the file

// function App() {
//   return <UploadMembers />;
// }

// export default App;
