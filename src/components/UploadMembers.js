import React, { useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";

const members = [
  { name: "Gertrude", category: "L100" },
  { name: "Josephine", category: "L100" },
  { name: "Eugenia", category: "L100" },
  { name: "Reindolf", category: "L100" },
  { name: "Abigail", category: "L100" },

  { name: "Thelma", category: "L200" },
  { name: "Janet", category: "L200" },
  { name: "Isaac Zogli", category: "L200" },
  { name: "Ella", category: "L200" },
  { name: "Rhoda", category: "L200" },
  { name: "Gerald", category: "L200" },

  { name: "Yaa", category: "L300" },
  { name: "Kelvin Martey", category: "L300" },
  { name: "Christabel Afful", category: "L300" },
  { name: "Gloria", category: "L300" },
  { name: "Kwesi Effah", category: "L300" },
  { name: "Barimah", category: "L300" },
  { name: "Benedicta", category: "L300" },

  { name: "Akorfa", category: "L400" },
  { name: "Theola", category: "L400" },
  { name: "Emmanuel Dadzie", category: "L400" },
  { name: "Dell", category: "L400" },

  { name: "Mavis", category: "Worker" },
  { name: "Global", category: "Worker" },
  { name: "Ruby", category: "Worker" },
  { name: "Kwasi", category: "Worker" },
  { name: "Ayebea", category: "Worker" },
  { name: "Christabel", category: "Worker" },
  { name: "Victor", category: "Worker" },
];

export default function UploadMembers() {
  useEffect(() => {
    const upload = async () => {
      const membershipCollection = collection(db, "membership");
      for (const member of members) {
        await addDoc(membershipCollection, member);
      }
      console.log("✅ Members uploaded successfully.");
    };

    upload();
  }, []);

  return <div>Uploading members to Firestore...</div>;
}
