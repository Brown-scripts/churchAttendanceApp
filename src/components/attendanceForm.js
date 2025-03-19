import React, { useState } from "react";
import { addDoc } from "firebase/firestore";
import { attendanceCollection } from "../firebase";

const AttendanceForm = ({ fetchAttendance }) => {
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    date: "",
    serviceName: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.category || !formData.date || !formData.serviceName) {
      alert("Please fill out all fields before adding.");
      return;
    }

    try {
      await addDoc(attendanceCollection, formData);
      alert("Attendee added successfully!");
      fetchAttendance();
      setFormData({ name: "", category: "", date: "", serviceName: "" });
    } catch (error) {
      console.error("Error adding attendee:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-2xl p-6 space-y-4 w-full max-w-md mx-auto">
      <input 
        type="text" 
        name="name" 
        placeholder="Attendee Name" 
        value={formData.name} 
        onChange={handleChange} 
        required 
        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <select 
        name="category" 
        value={formData.category} 
        onChange={handleChange} 
        required 
        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select Category</option>
        <option value="L100s">L100s</option>
        <option value="Continuing Students">Continuing Students</option>
        <option value="L400s">L400s</option>
        <option value="Workers">Workers</option>
        <option value="Others">Others</option>
        <option value="New">New</option>
      </select>
      <input 
        type="date" 
        name="date" 
        value={formData.date} 
        onChange={handleChange} 
        required 
        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input 
        type="text" 
        name="serviceName" 
        placeholder="Service Name" 
        value={formData.serviceName} 
        onChange={handleChange} 
        required 
        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button 
        type="submit" 
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-all duration-300"
      >
        ➕ Add Attendee
      </button>
    </form>
  );
};

export default AttendanceForm;