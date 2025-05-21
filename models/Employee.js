import mongoose from "mongoose";

const EmployeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      min: 2,
      max: 100,
    },
    email: {
      type: String,
      max: 50,
      unique: true,
    },
    department: {
        type: String,
        min: 5,
    },
    employeeId: {
        type: String,
        min: 4
    },
    faceImg: {
        type: [Number],
    }
  },
  { timestamps: true }
);

const Employee = mongoose.model("Employee", EmployeeSchema);
export default Employee;
