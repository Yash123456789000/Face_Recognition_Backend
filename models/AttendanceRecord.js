import mongoose from "mongoose";

const AttendanceRecordSchema = new mongoose.Schema(
  {
    employeeId: {
        type: String,
        min: 4
    },
    time: {
      type: String,
    },
    type: {
      type: String,
    },
    location: {
      type: String,
      min: 5,
    },
    deviceId: {
        type: String,
        min: 5,
    },
  },
  { timestamps: true }
);

const AttendanceRecord = mongoose.model("AttendanceRecord", AttendanceRecordSchema);
export default AttendanceRecord;
